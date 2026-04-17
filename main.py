from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, text
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Optional, List
from pydantic import BaseModel
import os

from database import engine, get_db, Base, SessionLocal
from models import Meeting, Unit, Member, Task, Comment, Agenda, PriorityEnum, StatusEnum
from scheduler import start_scheduler

# ── Startup ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # ── 欄位 migration（舊資料庫補新欄位）────────────────────────────────────
    db = SessionLocal()
    try:
        # tasks 表新欄位
        for col, definition in [
            ("progress_pct",  "INTEGER DEFAULT 0"),
            ("progress_note", "TEXT DEFAULT ''"),
            ("depends_on_id", "INTEGER"),
        ]:
            try:
                db.execute(text(f"ALTER TABLE tasks ADD COLUMN {col} {definition}"))
                db.commit()
            except Exception:
                db.rollback()
        # agendas table
        try:
            db.execute(text("CREATE TABLE IF NOT EXISTS agendas (id SERIAL PRIMARY KEY, meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE, title VARCHAR(200) NOT NULL, order_no INTEGER DEFAULT 1, note TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW())"))
            db.commit()
        except Exception: db.rollback()
        # tasks 表新欄位（agenda_id）
        try:
            db.execute(text("ALTER TABLE tasks ADD COLUMN agenda_id INTEGER REFERENCES agendas(id) ON DELETE SET NULL"))
            db.commit()
        except Exception: db.rollback()
        # units 表新欄位
        for col, definition in [
            ("campus", "VARCHAR(20) DEFAULT ''"),
        ]:
            try:
                db.execute(text(f"ALTER TABLE units ADD COLUMN {col} {definition}"))
                db.commit()
            except Exception:
                db.rollback()
        # 首次啟動若 DB 空則預載 Demo
        if db.query(Task).count() == 0 and db.query(Unit).count() == 0:
            _seed_demo(db)
    finally:
        db.close()
    start_scheduler()
    yield

app = FastAPI(title="癌症醫院專案儀表板", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Schemas ───────────────────────────────────────────────────────────────────
class MeetingIn(BaseModel):
    title: str; date: date; session_no: int

class UnitIn(BaseModel):
    name: str; headcount: int = 0; available: int = 0; note: str = ""; campus: str = ""

class MemberIn(BaseModel):
    name: str; email: Optional[str] = None; unit_id: Optional[int] = None
    seniority: int = 0; role_type: str = ""

class TaskIn(BaseModel):
    title: str; description: str = ""
    meeting_id: Optional[int] = None; unit_id: Optional[int] = None
    owner_id: Optional[int] = None; assistant_id: Optional[int] = None
    due_date: Optional[date] = None
    priority: PriorityEnum = PriorityEnum.medium
    status: StatusEnum = StatusEnum.not_started
    blocked_reason: str = ""; manpower_needed: int = 0; manpower_current: int = 0
    progress_pct: int = 0; progress_note: str = ""
    depends_on_id: Optional[int] = None
    agenda_id: Optional[int] = None

class TaskPatch(BaseModel):
    title: Optional[str] = None; description: Optional[str] = None
    unit_id: Optional[int] = None; owner_id: Optional[int] = None
    assistant_id: Optional[int] = None; due_date: Optional[date] = None
    priority: Optional[PriorityEnum] = None; status: Optional[StatusEnum] = None
    blocked_reason: Optional[str] = None
    manpower_needed: Optional[int] = None; manpower_current: Optional[int] = None
    progress_pct: Optional[int] = None; progress_note: Optional[str] = None
    depends_on_id: Optional[int] = None
    agenda_id: Optional[int] = None

class AgendaIn(BaseModel):
    meeting_id: int; title: str; order_no: int = 1; note: str = ""

class CommentIn(BaseModel):
    content: str; author_id: Optional[int] = None

# ── Helpers ───────────────────────────────────────────────────────────────────
def is_overdue(task: Task) -> bool:
    return bool(task.due_date and task.due_date < date.today() and task.status != StatusEnum.done)

def member_dict(m: Member, db: Session) -> dict:
    tasks = db.query(Task).filter(Task.owner_id == m.id).all()
    total     = len(tasks)
    completed = sum(1 for t in tasks if t.status == StatusEnum.done)
    overdue   = sum(1 for t in tasks if is_overdue(t))
    active    = [t for t in tasks if t.status != StatusEnum.done]
    # 負荷 = 目前負責中任務的人力需求總和（manpower_needed 為此任務佔用的人力單位）
    manpower_demand = sum(t.manpower_needed or 1 for t in active)
    load = min(100, manpower_demand * 20 + overdue * 10)
    return {
        "id": m.id, "name": m.name, "email": m.email,
        "unit_id": m.unit_id, "seniority": m.seniority, "role_type": m.role_type,
        "unit_name": m.unit.name if m.unit else None,
        "task_count": total, "completed_count": completed, "load": load,
    }

def task_dict(t: Task) -> dict:
    return {
        "id": t.id, "title": t.title, "description": t.description,
        "meeting_id": t.meeting_id, "unit_id": t.unit_id,
        "owner_id": t.owner_id, "assistant_id": t.assistant_id,
        "due_date": str(t.due_date) if t.due_date else None,
        "priority": t.priority, "status": t.status,
        "blocked_reason": t.blocked_reason,
        "manpower_needed": t.manpower_needed,
        "manpower_current": t.manpower_current,
        "progress_pct": t.progress_pct or 0,
        "progress_note": t.progress_note or "",
        "created_at": str(t.created_at),
        "owner_name": t.owner.name if t.owner else None,
        "unit_name": t.unit.name if t.unit else None,
        "meeting_label": f"第{t.meeting.session_no}次" if t.meeting else None,
        "agenda_id":        t.agenda_id,
        "agenda_title":     t.agenda.title if t.agenda else None,
        "depends_on_id":    t.depends_on_id,
        "depends_on_title": t.depends_on.title if t.depends_on else None,
        "depends_on_done":  t.depends_on.status == StatusEnum.done if t.depends_on else True,
        "overdue": is_overdue(t),
    }

# ── Meetings ──────────────────────────────────────────────────────────────────
@app.get("/api/meetings")
def list_meetings(db: Session = Depends(get_db)):
    return db.query(Meeting).order_by(Meeting.date.desc()).all()

@app.post("/api/meetings")
def create_meeting(data: MeetingIn, db: Session = Depends(get_db)):
    m = Meeting(**data.model_dump()); db.add(m); db.commit(); db.refresh(m); return m

@app.delete("/api/meetings/{mid}")
def delete_meeting(mid: int, db: Session = Depends(get_db)):
    m = db.query(Meeting).filter(Meeting.id == mid).first()
    if not m: raise HTTPException(404)
    db.delete(m); db.commit(); return {"ok": True}

@app.patch("/api/meetings/{mid}")
def update_meeting(mid: int, data: MeetingIn, db: Session = Depends(get_db)):
    m = db.query(Meeting).filter(Meeting.id == mid).first()
    if not m: raise HTTPException(404)
    for k, v in data.model_dump().items(): setattr(m, k, v)
    db.commit(); db.refresh(m); return m

# ── Agendas ──────────────────────────────────────────────────────────────────
@app.get("/api/agendas")
def list_agendas(meeting_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Agenda)
    if meeting_id: q = q.filter(Agenda.meeting_id == meeting_id)
    return q.order_by(Agenda.meeting_id, Agenda.order_no).all()

@app.post("/api/agendas")
def create_agenda(data: AgendaIn, db: Session = Depends(get_db)):
    a = Agenda(**data.model_dump()); db.add(a); db.commit(); db.refresh(a); return a

@app.patch("/api/agendas/{aid}")
def update_agenda(aid: int, data: AgendaIn, db: Session = Depends(get_db)):
    a = db.query(Agenda).filter(Agenda.id == aid).first()
    if not a: raise HTTPException(404)
    for k, v in data.model_dump().items(): setattr(a, k, v)
    db.commit(); db.refresh(a); return a

@app.delete("/api/agendas/{aid}")
def delete_agenda(aid: int, db: Session = Depends(get_db)):
    a = db.query(Agenda).filter(Agenda.id == aid).first()
    if not a: raise HTTPException(404)
    db.delete(a); db.commit(); return {"ok": True}

# ── Meeting detail（含議程+任務）──────────────────────────────────────────────
@app.get("/api/meetings/{mid}/detail")
def meeting_detail(mid: int, db: Session = Depends(get_db)):
    m = db.query(Meeting).filter(Meeting.id == mid).first()
    if not m: raise HTTPException(404)
    agendas = db.query(Agenda).filter(Agenda.meeting_id == mid).order_by(Agenda.order_no).all()
    tasks   = db.query(Task).filter(Task.meeting_id == mid).all()
    total   = len(tasks)
    done    = sum(1 for t in tasks if t.status == StatusEnum.done)
    overdue = sum(1 for t in tasks if is_overdue(t))
    return {
        "id": m.id, "title": m.title, "date": str(m.date), "session_no": m.session_no,
        "task_count": total, "done_count": done, "overdue_count": overdue,
        "completion_rate": int(done/total*100) if total else 0,
        "agendas": [{"id":a.id,"title":a.title,"order_no":a.order_no,"note":a.note} for a in agendas],
        "tasks": [task_dict(t) for t in tasks],
    }

# ── Batch task update ─────────────────────────────────────────────────────────
class BatchPatch(BaseModel):
    ids: List[int]
    status: Optional[StatusEnum] = None
    priority: Optional[PriorityEnum] = None
    owner_id: Optional[int] = None
    due_date: Optional[date] = None

@app.patch("/api/tasks/batch")
def batch_update(data: BatchPatch, db: Session = Depends(get_db)):
    patch = {k:v for k,v in data.model_dump().items() if k != "ids" and v is not None}
    updated = 0
    for tid in data.ids:
        t = db.query(Task).filter(Task.id == tid).first()
        if t:
            for k, v in patch.items(): setattr(t, k, v)
            updated += 1
    db.commit()
    return {"ok": True, "updated": updated}

# ── Units ─────────────────────────────────────────────────────────────────────
@app.get("/api/units")
def list_units(db: Session = Depends(get_db)):
    return db.query(Unit).all()

@app.post("/api/units")
def create_unit(data: UnitIn, db: Session = Depends(get_db)):
    u = Unit(**data.model_dump()); db.add(u); db.commit(); db.refresh(u); return u

@app.patch("/api/units/{uid}")
def update_unit(uid: int, data: UnitIn, db: Session = Depends(get_db)):
    u = db.query(Unit).filter(Unit.id == uid).first()
    if not u: raise HTTPException(404)
    for k, v in data.model_dump().items(): setattr(u, k, v)
    db.commit(); db.refresh(u); return u

# ── Members ───────────────────────────────────────────────────────────────────
@app.get("/api/members")
def list_members(unit_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Member)
    if unit_id: q = q.filter(Member.unit_id == unit_id)
    return [member_dict(m, db) for m in q.all()]

@app.post("/api/members")
def create_member(data: MemberIn, db: Session = Depends(get_db)):
    m = Member(**data.model_dump()); db.add(m); db.commit(); db.refresh(m); return m

@app.patch("/api/members/{mid}")
def update_member(mid: int, data: MemberIn, db: Session = Depends(get_db)):
    m = db.query(Member).filter(Member.id == mid).first()
    if not m: raise HTTPException(404)
    for k, v in data.model_dump().items(): setattr(m, k, v)
    db.commit(); db.refresh(m); return m

@app.delete("/api/members/{mid}")
def delete_member(mid: int, db: Session = Depends(get_db)):
    m = db.query(Member).filter(Member.id == mid).first()
    if not m: raise HTTPException(404)
    db.delete(m); db.commit(); return {"ok": True}

# ── Tasks ─────────────────────────────────────────────────────────────────────
@app.get("/api/tasks")
def list_tasks(
    status: Optional[str] = None, unit_id: Optional[int] = None,
    owner_id: Optional[int] = None, meeting_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Task)
    if status:     q = q.filter(Task.status == status)
    if unit_id:    q = q.filter(Task.unit_id == unit_id)
    if owner_id:   q = q.filter(Task.owner_id == owner_id)
    if meeting_id: q = q.filter(Task.meeting_id == meeting_id)
    return [task_dict(t) for t in q.order_by(Task.due_date).all()]

@app.post("/api/tasks")
def create_task(data: TaskIn, db: Session = Depends(get_db)):
    t = Task(**data.model_dump()); db.add(t); db.commit(); db.refresh(t)
    return task_dict(t)

@app.get("/api/tasks/{tid}")
def get_task(tid: int, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == tid).first()
    if not t: raise HTTPException(404)
    return task_dict(t)

@app.patch("/api/tasks/{tid}")
def update_task(tid: int, data: TaskPatch, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == tid).first()
    if not t: raise HTTPException(404)
    patch = data.model_dump(exclude_none=True)
    progress_updated = "progress_pct" in patch or "progress_note" in patch
    for k, v in patch.items(): setattr(t, k, v)
    db.commit(); db.refresh(t)
    # 有回報進度時，通知秘書（ALERT_FROM_EMAIL 對應杜祐儀）
    if progress_updated and t.owner:
        from scheduler import send_reminder
        import os
        notify_email = os.environ.get("NOTIFY_TO_EMAIL", os.environ.get("ALERT_FROM_EMAIL", ""))
        if notify_email:
            send_reminder(
                notify_email,
                f"【進度回報】{t.title}",
                f"{t.owner.name} 回報任務進度：\n\n"
                f"任務：{t.title}\n"
                f"進度：{t.progress_pct}%\n"
                f"說明：{t.progress_note or '（無說明）'}\n"
                f"目前狀態：{t.status.value}\n\n"
                f"截止日期：{t.due_date or '未設定'}"
            )
    return task_dict(t)

@app.delete("/api/tasks/{tid}")
def delete_task(tid: int, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == tid).first()
    if not t: raise HTTPException(404)
    db.delete(t); db.commit(); return {"ok": True}

# ── Comments ──────────────────────────────────────────────────────────────────
@app.get("/api/tasks/{tid}/comments")
def list_comments(tid: int, db: Session = Depends(get_db)):
    return db.query(Comment).filter(Comment.task_id == tid).order_by(Comment.created_at).all()

@app.post("/api/tasks/{tid}/comments")
def add_comment(tid: int, data: CommentIn, db: Session = Depends(get_db)):
    c = Comment(task_id=tid, **data.model_dump()); db.add(c); db.commit(); db.refresh(c); return c

# ── Dashboard ─────────────────────────────────────────────────────────────────
@app.get("/api/dashboard/stats")
def stats(db: Session = Depends(get_db)):
    all_tasks = db.query(Task).all()
    total     = len(all_tasks)
    completed = sum(1 for t in all_tasks if t.status == StatusEnum.done)
    in_prog   = sum(1 for t in all_tasks if t.status == StatusEnum.in_progress)
    blocked   = sum(1 for t in all_tasks if t.status == StatusEnum.blocked)
    overdue   = sum(1 for t in all_tasks if is_overdue(t))
    return {
        "total": total, "completed": completed, "in_progress": in_prog,
        "blocked": blocked, "overdue": overdue,
        "completion_rate": round(completed / total * 100, 1) if total else 0,
    }

@app.get("/api/dashboard/monthly")
def monthly(db: Session = Depends(get_db)):
    rows = (
        db.query(
            extract("year",  Task.created_at).label("year"),
            extract("month", Task.created_at).label("month"),
            func.count(Task.id).label("count"),
        )
        .filter(Task.status == StatusEnum.done)
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )
    return [{"year": int(r.year), "month": int(r.month), "count": r.count}
            for r in rows if r.year is not None]

@app.get("/api/dashboard/unit-loads")
def unit_loads(db: Session = Depends(get_db)):
    result = []
    for u in db.query(Unit).all():
        tasks     = db.query(Task).filter(Task.unit_id == u.id).all()
        total     = len(tasks)
        completed = sum(1 for t in tasks if t.status == StatusEnum.done)
        overdue   = sum(1 for t in tasks if is_overdue(t))
        active    = [t for t in tasks if t.status != StatusEnum.done]
        # 人力從實際人員計算
        all_members   = db.query(Member).filter(Member.unit_id == u.id).all()
        headcount     = len(all_members)
        available     = sum(1 for m in all_members if m.role_type == "臨床專責")
        # 負荷 = 在辦任務人力需求 / 可用人力（以100%為上限）
        demand = sum(t.manpower_needed or 1 for t in active)
        if available > 0:
            load = min(100, int(demand / available * 100))
        else:
            load = min(100, total * 10)
        result.append({
            "id": u.id, "name": u.name,
            "headcount": headcount, "available": available,
            "tasks": total, "completed": completed,
            "overdue": overdue, "load": load, "note": u.note, "campus": u.campus or "",
        })
    return result

# ── Weekly Report PDF ─────────────────────────────────────────────────────────
from fastapi.responses import StreamingResponse
from io import BytesIO

def _register_fonts():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    try:
        pdfmetrics.getFont("STSong-Light")
    except Exception:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

@app.get("/api/report/weekly")
def weekly_report(db: Session = Depends(get_db)):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Table,
                                    TableStyle, Spacer, HRFlowable)
    from reportlab.graphics.shapes import Drawing, Rect, String, Polygon

    _register_fonts()
    CN     = "STSong-Light"
    BROWN  = colors.HexColor("#6B4226")
    DARK   = colors.HexColor("#2E1F14")
    RED    = colors.HexColor("#8B2E2E")
    AMBER  = colors.HexColor("#B07030")
    GREEN  = colors.HexColor("#4A6741")
    BG1    = colors.HexColor("#FBF6F0")
    BG2    = colors.HexColor("#F0E6D8")
    BORDER = colors.HexColor("#DEC9B4")
    GREY   = colors.HexColor("#888278")
    BLUE   = colors.HexColor("#2D4A8B")

    today       = date.today()
    try:
        all_tasks = db.query(Task).all()
        # 確保新欄位有預設值（舊資料庫欄位可能為 None）
        for t in all_tasks:
            if t.progress_pct is None: t.progress_pct = 0
            if t.progress_note is None: t.progress_note = ""
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, f"DB query error: {e}")
    overdue_t   = [t for t in all_tasks if is_overdue(t)]
    inprog_t    = [t for t in all_tasks if t.status == StatusEnum.in_progress]
    blocked_t   = [t for t in all_tasks if t.status == StatusEnum.blocked and not is_overdue(t)]
    done_t      = [t for t in all_tasks if t.status == StatusEnum.done]
    upcoming_t  = [t for t in all_tasks
                   if t.due_date and 0 <= (t.due_date - today).days <= 14
                   and t.status != StatusEnum.done and not is_overdue(t)]

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=1.8*cm, bottomMargin=2*cm)
    W = A4[0] - 3.6*cm

    def ps(size=10, align=0, color=DARK, bold=False):
        return ParagraphStyle("s", fontName=CN,
            fontSize=size, textColor=color, alignment=align, leading=size*1.5)

    def p(txt, size=10, align=0, color=DARK, bold=False):
        return Paragraph(txt, ps(size, align, color, bold))

    # 任務表格欄位寬
    CW = [W*0.30, W*0.11, W*0.20, W*0.13, W*0.12, W*0.14]

    def shorten_unit(name, maxlen=12):
        name = name.replace("（彰秀）","(秀)").replace("（彰濱）","(濱)")
        return name[:maxlen]+("…" if len(name)>maxlen else "")

    def task_table(tasks, show_reason=False):
        header = [p("任務名稱",9,bold=True,color=colors.white),
                  p("主責人", 9,bold=True,color=colors.white),
                  p("主責單位",9,bold=True,color=colors.white),
                  p("截止日", 9,bold=True,color=colors.white),
                  p("進度",   9,bold=True,color=colors.white),
                  p("狀態",   9,bold=True,color=colors.white)]
        data = [header]
        red_rows = []
        for i, t in enumerate(tasks, 1):
            label  = "逾期" if is_overdue(t) else t.status.value
            reason = ""
            if show_reason and t.blocked_reason:
                br = t.blocked_reason[:28] + ("…" if len(t.blocked_reason)>28 else "")
                reason = f"\n{br}"
            uname  = shorten_unit(t.unit.name if t.unit else "—")
            sc     = RED if is_overdue(t) else (AMBER if t.status==StatusEnum.blocked else DARK)
            pct    = t.progress_pct or 0
            pnote  = (t.progress_note or "")[:10]
            prog   = f"{pct}%" + (f"\n{pnote}" if pnote else "")
            pc     = GREEN if pct>=80 else (AMBER if pct>=40 else DARK)
            data.append([
                p(t.title[:20]+("…" if len(t.title)>20 else ""),9),
                p(t.owner.name if t.owner else "—",9),
                p(uname,9),
                p(str(t.due_date) if t.due_date else "—",9),
                p(prog,8,color=pc),
                p(label+reason,9,color=sc),
            ])
            if is_overdue(t): red_rows.append(i)
        tbl = Table(data, colWidths=CW, repeatRows=1)
        style = [
            ("FONTNAME",(0,0),(-1,-1),CN),
            ("FONTSIZE",(0,0),(-1,-1),9),
            ("BACKGROUND",(0,0),(-1,0),BROWN),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),[BG1,BG2]),
            ("GRID",(0,0),(-1,-1),0.3,BORDER),
            ("VALIGN",(0,0),(-1,-1),"TOP"),
            ("TOPPADDING",(0,0),(-1,-1),5),
            ("BOTTOMPADDING",(0,0),(-1,-1),5),
            ("LEFTPADDING",(0,0),(-1,-1),5),
        ]
        for r in red_rows: style.append(("BACKGROUND",(0,r),(-1,r),colors.HexColor("#F5E8E8")))
        tbl.setStyle(TableStyle(style))
        return tbl

    def sec(title, color=BROWN):
        return [Spacer(1,0.35*cm), p(f"▌ {title}",12,bold=True,color=color), Spacer(1,0.15*cm)]

    # ── 圓餅圖 ─────────────────────────────────────────────────────────────────
    def status_pie_drawing():
        import math
        total = len(all_tasks)
        if total == 0: return None
        slices = [
            ("完成",   len(done_t),    GREEN),
            ("進行中", len(inprog_t),  BLUE),
            ("逾期",   len(overdue_t), RED),
            ("卡關",   len(blocked_t), AMBER),
            ("未開始", total-len(done_t)-len(inprog_t)-len(overdue_t)-len(blocked_t), GREY),
        ]
        slices = [(l,v,c) for l,v,c in slices if v>0]
        DW, DH = W, 170
        d = Drawing(DW, DH)
        cx, cy, r = 90, 88, 70
        angle = 0
        for label, val, col in slices:
            sweep = val/total*360
            pts = [cx, cy]
            steps = max(int(sweep/3), 3)
            for k in range(steps+1):
                a = math.radians(angle + k*sweep/steps)
                pts += [cx + r*math.cos(a), cy + r*math.sin(a)]
            from reportlab.graphics.shapes import Polygon
            d.add(Polygon(pts, fillColor=col, strokeColor=colors.white, strokeWidth=1.5))
            pct = int(val/total*100)
            if pct >= 10:
                mid_a = math.radians(angle + sweep/2)
                lx = cx + r*0.6*math.cos(mid_a)
                ly = cy + r*0.6*math.sin(mid_a) - 5
                d.add(String(lx, ly, f"{pct}%", fontName=CN, fontSize=9,
                             fillColor=colors.white, textAnchor="middle"))
            angle += sweep
        # 右側圖例
        leg_x = cx + r + 30
        for i, (label, val, col) in enumerate(slices):
            ly = DH - 24 - i*24
            d.add(Rect(leg_x, ly, 12, 12, fillColor=col, strokeColor=None))
            d.add(String(leg_x+16, ly+2, f"{label}  {val}", fontName=CN, fontSize=9, fillColor=DARK))
        return d

    # ── 橫條圖 ─────────────────────────────────────────────────────────────────
    def unit_bar_drawing(units_data):
        if not units_data: return None
        n   = len(units_data)
        dh  = max(n*26+30, 80)
        d   = Drawing(W, dh)
        max_v  = max((u["total"] for u in units_data), default=1)
        NAME_W = 135
        NUM_W  = 32
        BAR_W  = W - NAME_W - NUM_W - 4
        for i, u in enumerate(units_data):
            y = dh - 20 - i*26
            d.add(Rect(NAME_W, y, BAR_W, 14, fillColor=colors.HexColor("#EDE5DC"), strokeColor=None))
            if u["total"] > 0:
                scale  = BAR_W / max_v
                done_w = u["completed"] * scale
                ov_w   = u["overdue"]   * scale
                act_w  = (u["total"] - u["completed"] - u["overdue"]) * scale
                d.add(Rect(NAME_W,           y, done_w, 14, fillColor=GREEN, strokeColor=None))
                d.add(Rect(NAME_W+done_w,    y, act_w,  14, fillColor=AMBER, strokeColor=None))
                if ov_w > 0:
                    d.add(Rect(NAME_W+done_w+act_w, y, ov_w, 14, fillColor=RED, strokeColor=None))
            name = shorten_unit(u["name"], 16)
            d.add(String(NAME_W-4, y+3, name, fontName=CN, fontSize=8, fillColor=DARK, textAnchor="end"))
            d.add(String(NAME_W+BAR_W+4, y+3, f"{u['total']}件", fontName=CN, fontSize=8, fillColor=DARK))
        # 圖例（只畫一次）
        for j, (col, lab) in enumerate([(GREEN,"完成"),(AMBER,"進行中"),(RED,"逾期")]):
            gx = NAME_W + j*68
            d.add(Rect(gx, 2, 10, 10, fillColor=col, strokeColor=None))
            d.add(String(gx+13, 3, lab, fontName=CN, fontSize=8, fillColor=DARK))
        return d

    story = []

    # 封面
    story += [
        Spacer(1,0.3*cm),
        p("彰濱秀傳癌症醫院",15,align=1,bold=True,color=BROWN),
        Spacer(1,0.1*cm),
        p("專案追蹤週報",26,align=1,bold=True,color=DARK),
        Spacer(1,0.15*cm),
        p(f"報告日期：{today.strftime('%Y 年 %m 月 %d 日')}",11,align=1,color=GREY),
        Spacer(1,0.35*cm),
        HRFlowable(width=W,color=BROWN,thickness=2),
        Spacer(1,0.25*cm),
    ]

    # 總覽數字
    story += sec("任務總覽")
    summary = Table(
        [[p("總任務",10,1,bold=True), p("進行中",10,1,bold=True),
          p("卡關",10,1,bold=True),  p("逾期",10,1,bold=True), p("已完成",10,1,bold=True)],
         [p(str(len(all_tasks)),26,1,bold=True,color=BROWN),
          p(str(len(inprog_t)),26,1,bold=True,color=BLUE),
          p(str(len(blocked_t)+len(overdue_t)),26,1,bold=True,color=AMBER),
          p(str(len(overdue_t)),26,1,bold=True,color=RED),
          p(str(len(done_t)),26,1,bold=True,color=GREEN)]],
        colWidths=[W/5]*5)
    summary.setStyle(TableStyle([
        ("FONTNAME",(0,0),(-1,-1),CN),
        ("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("BACKGROUND",(0,0),(-1,0),BG2),
        ("GRID",(0,0),(-1,-1),0.5,BORDER),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
    ]))
    story.append(summary)

    # 圖表區：圓餅 + 說明
    pie = status_pie_drawing()
    if pie:
        story += [Spacer(1,0.3*cm)]
        story += sec("任務狀態圖表")
        story.append(pie)

    # 逾期任務
    if overdue_t:
        story += sec("逾期任務（需立即處理）",RED)
        story.append(task_table(overdue_t,show_reason=True))

    # 卡關任務
    if blocked_t:
        story += sec("卡關任務",AMBER)
        story.append(task_table(blocked_t,show_reason=True))

    # 近14天到期
    if upcoming_t:
        story += sec("近 14 天即將到期")
        story.append(task_table(sorted(upcoming_t,key=lambda t:t.due_date)))

    # 進行中
    if inprog_t:
        story += sec("進行中任務")
        story.append(task_table(inprog_t))

    # 各單位統計 + 橫條圖
    story += sec("各單位任務統計")
    units = db.query(Unit).all()
    udata_list = []
    utbl_data  = [[p("單位",9,bold=True,color=colors.white),
                   p("任務",9,bold=True,color=colors.white),
                   p("完成",9,bold=True,color=colors.white),
                   p("逾期",9,bold=True,color=colors.white),
                   p("完成率",9,bold=True,color=colors.white),
                   p("負荷",9,bold=True,color=colors.white)]]
    for u in units:
        ut  = [t for t in all_tasks if t.unit_id == u.id]
        uc  = sum(1 for t in ut if t.status==StatusEnum.done)
        uo  = sum(1 for t in ut if is_overdue(t))
        rate = f"{int(uc/len(ut)*100)}%" if ut else "—"
        load = min(100,len(ut)*8+uo*15)
        lc   = RED if load>=80 else (AMBER if load>=60 else GREEN)
        udata_list.append({"name":u.name,"total":len(ut),"completed":uc,"overdue":uo,"load":load})
        utbl_data.append([
            p(u.name,9), p(str(len(ut)),9,1), p(str(uc),9,1,GREEN),
            p(str(uo),9,1,RED if uo else DARK),
            p(rate,9,1), p(f"{load}%",9,1,lc),
        ])
    unit_tbl = Table(utbl_data,colWidths=[W*0.36,W*0.1,W*0.1,W*0.1,W*0.14,W*0.2],repeatRows=1)
    unit_tbl.setStyle(TableStyle([
        ("FONTNAME",(0,0),(-1,-1),CN),
        ("BACKGROUND",(0,0),(-1,0),BROWN),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[BG1,BG2]),
        ("GRID",(0,0),(-1,-1),0.3,BORDER),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),5),
    ]))
    story.append(unit_tbl)

    # 橫條圖
    bar_d = unit_bar_drawing([u for u in udata_list if u["total"]>0])
    if bar_d:
        story += [Spacer(1,0.3*cm)]
        story += sec("各單位任務量圖表")
        story.append(bar_d)

    story += [
        Spacer(1,0.6*cm),
        HRFlowable(width=W,color=BORDER,thickness=0.5),
        Spacer(1,0.15*cm),
        p(f"本報告由彰濱秀傳癌症醫院專案追蹤系統自動產生　{today}",8,align=1,color=GREY),
    ]

    try:
        doc.build(story)
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, f"PDF build error: {e}")
    buf.seek(0)
    filename = f"癌症醫院週報_{today}.pdf"
    return StreamingResponse(buf,media_type="application/pdf",
        headers={"Content-Disposition":f"attachment; filename*=UTF-8''{filename.encode().hex()}"})

# ── Backup Export / Import ────────────────────────────────────────────────────
from fastapi.responses import JSONResponse
from fastapi import UploadFile, File
import json as json_lib

@app.get("/api/backup/export")
def export_backup(db: Session = Depends(get_db)):
    """匯出所有資料為 JSON"""
    meetings = db.query(Meeting).all()
    units    = db.query(Unit).all()
    members  = db.query(Member).all()
    tasks    = db.query(Task).all()
    comments = db.query(Comment).all()

    data = {
        "version": "1.0",
        "exported_at": str(date.today()),
        "meetings": [{"id":m.id,"title":m.title,"date":str(m.date),"session_no":m.session_no} for m in meetings],
        "units":    [{"id":u.id,"name":u.name,"headcount":u.headcount,"available":u.available,"note":u.note} for u in units],
        "members":  [{"id":m.id,"name":m.name,"email":m.email,"unit_id":m.unit_id,
                      "seniority":m.seniority,"role_type":m.role_type} for m in members],
        "tasks":    [{"id":t.id,"title":t.title,"description":t.description,
                      "meeting_id":t.meeting_id,"unit_id":t.unit_id,
                      "owner_id":t.owner_id,"assistant_id":t.assistant_id,
                      "due_date":str(t.due_date) if t.due_date else None,
                      "priority":t.priority.value if t.priority else None,
                      "status":t.status.value if t.status else None,
                      "blocked_reason":t.blocked_reason,
                      "manpower_needed":t.manpower_needed,
                      "manpower_current":t.manpower_current,
                      "progress_pct":t.progress_pct or 0,
                      "progress_note":t.progress_note or ""} for t in tasks],
        "comments": [{"id":c.id,"task_id":c.task_id,"author_id":c.author_id,
                      "content":c.content,"created_at":str(c.created_at)} for c in comments],
    }
    filename = f"癌症醫院備份_{date.today()}.json"
    return JSONResponse(content=data, headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{filename.encode().hex()}"
    })

@app.post("/api/backup/import")
async def import_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """匯入備份 JSON，覆蓋現有資料"""
    try:
        raw = await file.read()
        data = json_lib.loads(raw)
    except Exception as e:
        raise HTTPException(400, f"JSON 解析失敗：{e}")

    from datetime import datetime
    status_map   = {v.value:v for v in StatusEnum}
    priority_map = {v.value:v for v in PriorityEnum}

    try:
        # 清空
        db.query(Comment).delete()
        db.query(Task).delete()
        db.query(Member).delete()
        db.query(Unit).delete()
        db.query(Meeting).delete()
        db.commit()

        # 建立 id 對照表（舊 id → 新物件）
        meet_map, unit_map, mem_map = {}, {}, {}

        for m in data.get("meetings", []):
            obj = Meeting(title=m["title"], session_no=m["session_no"],
                          date=datetime.strptime(m["date"], "%Y-%m-%d").date())
            db.add(obj); db.flush()
            meet_map[m["id"]] = obj.id

        for u in data.get("units", []):
            obj = Unit(name=u["name"], headcount=u.get("headcount",0),
                       available=u.get("available",0), note=u.get("note",""))
            db.add(obj); db.flush()
            unit_map[u["id"]] = obj.id

        for m in data.get("members", []):
            obj = Member(name=m["name"], email=m.get("email"),
                         unit_id=unit_map.get(m.get("unit_id")),
                         seniority=m.get("seniority",0), role_type=m.get("role_type",""))
            db.add(obj); db.flush()
            mem_map[m["id"]] = obj.id

        _dep_map = {}  # old_task_id -> old_depends_on_id
        for t in data.get("tasks", []):
            due = None
            if t.get("due_date") and t["due_date"] != "None":
                try: due = datetime.strptime(t["due_date"], "%Y-%m-%d").date()
                except: pass
            obj = Task(
                title=t["title"], description=t.get("description",""),
                meeting_id=meet_map.get(t.get("meeting_id")),
                unit_id=unit_map.get(t.get("unit_id")),
                owner_id=mem_map.get(t.get("owner_id")),
                assistant_id=mem_map.get(t.get("assistant_id")),
                due_date=due,
                priority=priority_map.get(t.get("priority"), PriorityEnum.medium),
                status=status_map.get(t.get("status"), StatusEnum.not_started),
                blocked_reason=t.get("blocked_reason",""),
                manpower_needed=t.get("manpower_needed",0),
                manpower_current=t.get("manpower_current",0),
            )
            db.add(obj); db.flush()
            # comments 用舊 task id 對照
            task_map_entry = (t["id"], obj.id)
            mem_map[f"task_{t['id']}"] = obj.id  # 借用 mem_map 存 task id 對照

        # 建 task id 對照
        task_id_map = {}
        all_tasks_after = db.query(Task).all()
        # 用 title 粗略對照（備份匯入後 id 重新分配）
        # 更正確：在上面 flush 後直接記錄
        # 重新做：在 task 迴圈中記錄
        db.rollback()

        # ── 重新做，正確記錄 task id ──
        db.query(Comment).delete()
        db.query(Task).delete()
        db.query(Member).delete()
        db.query(Unit).delete()
        db.query(Meeting).delete()
        db.commit()

        meet_map, unit_map, mem_map, task_map = {}, {}, {}, {}

        for m in data.get("meetings", []):
            obj = Meeting(title=m["title"], session_no=m["session_no"],
                          date=datetime.strptime(m["date"], "%Y-%m-%d").date())
            db.add(obj); db.flush(); meet_map[m["id"]] = obj.id

        for u in data.get("units", []):
            obj = Unit(name=u["name"], headcount=u.get("headcount",0),
                       available=u.get("available",0), note=u.get("note",""))
            db.add(obj); db.flush(); unit_map[u["id"]] = obj.id

        for m in data.get("members", []):
            obj = Member(name=m["name"], email=m.get("email"),
                         unit_id=unit_map.get(m.get("unit_id")),
                         seniority=m.get("seniority",0), role_type=m.get("role_type",""))
            db.add(obj); db.flush(); mem_map[m["id"]] = obj.id

        for t in data.get("tasks", []):
            due = None
            if t.get("due_date") and t["due_date"] not in (None, "None", "null"):
                try: due = datetime.strptime(str(t["due_date"]), "%Y-%m-%d").date()
                except: pass
            obj = Task(
                title=t["title"], description=t.get("description",""),
                meeting_id=meet_map.get(t.get("meeting_id")),
                unit_id=unit_map.get(t.get("unit_id")),
                owner_id=mem_map.get(t.get("owner_id")),
                assistant_id=mem_map.get(t.get("assistant_id")),
                due_date=due,
                priority=priority_map.get(t.get("priority"), PriorityEnum.medium),
                status=status_map.get(t.get("status"), StatusEnum.not_started),
                blocked_reason=t.get("blocked_reason",""),
                manpower_needed=t.get("manpower_needed",0),
                manpower_current=t.get("manpower_current",0),
                progress_pct=t.get("progress_pct",0),
                progress_note=t.get("progress_note",""),
            )
            db.add(obj); db.flush()
            task_map[t["id"]] = obj.id
            _dep_map[t["id"]] = t.get("depends_on_id")

        # 還原相依性（second pass）
        for old_id, old_dep in _dep_map.items():
            if old_dep and old_dep in task_map and old_id in task_map:
                t_obj = db.query(Task).filter(Task.id == task_map[old_id]).first()
                if t_obj: t_obj.depends_on_id = task_map[old_dep]
        db.flush()

        for c in data.get("comments", []):
            new_task_id = task_map.get(c.get("task_id"))
            if not new_task_id: continue
            obj = Comment(task_id=new_task_id,
                          author_id=mem_map.get(c.get("author_id")),
                          content=c.get("content",""))
            db.add(obj)

        db.commit()
        counts = {
            "meetings": len(data.get("meetings",[])),
            "units": len(data.get("units",[])),
            "members": len(data.get("members",[])),
            "tasks": len(data.get("tasks",[])),
            "comments": len(data.get("comments",[])),
        }
        return {"ok": True, "message": f"備份匯入成功：{counts['tasks']} 件任務、{counts['members']} 位人員", "counts": counts}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"匯入失敗：{e}")

# ── Manual notification trigger ───────────────────────────────────────────────
@app.post("/api/notify/run")
def run_notify():
    from scheduler import check_and_notify
    check_and_notify()
    return {"ok": True, "message": "提醒已發送"}

# ── Serve React ───────────────────────────────────────────────────────────────
if os.path.exists("static"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

    @app.get("/logo.jpg")
    def serve_logo():
        return FileResponse("static/logo.jpg", media_type="image/jpeg")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse("static/index.html")

# ── Demo Data ─────────────────────────────────────────────────────────────────

DEMO_UNITS = [
    {"name":"癌症防治中心（彰秀）","headcount":0,"available":0,"note":"彰秀院區癌症防治業務統籌","campus":"彰秀"},
    {"name":"癌症防治中心（彰濱）","headcount":0,"available":0,"note":"彰濱院區癌症防治業務統籌","campus":"彰濱"},
    {"name":"放腫科（彰濱）",      "headcount":0,"available":0,"note":"設備值班限制可用人力",     "campus":"彰濱"},
    {"name":"放腫科（彰秀）",      "headcount":0,"available":0,"note":"",                        "campus":"彰秀"},
    {"name":"血液腫瘤科（彰濱）",  "headcount":0,"available":0,"note":"",                        "campus":"彰濱"},
    {"name":"血液腫瘤科（彰秀）",  "headcount":0,"available":0,"note":"",                        "campus":"彰秀"},
    {"name":"一般外科（彰濱）",    "headcount":0,"available":0,"note":"",                        "campus":"彰濱"},
    {"name":"內科（彰秀）",        "headcount":0,"available":0,"note":"住院醫師輪訓中",           "campus":"彰秀"},
    {"name":"醫務管理組",          "headcount":0,"available":0,"note":"癌症醫院行政窗口",         "campus":"兩院"},
    {"name":"護理部（彰秀）",      "headcount":0,"available":0,"note":"臨床排班影響可用人力",     "campus":"彰秀"},
    {"name":"護理部（彰濱）",      "headcount":0,"available":0,"note":"",                        "campus":"彰濱"},
    {"name":"病理科",              "headcount":0,"available":0,"note":"人員外借院本部",           "campus":"兩院"},
    {"name":"影像科",              "headcount":0,"available":0,"note":"",                        "campus":"兩院"},
    {"name":"社工科",              "headcount":0,"available":0,"note":"",                        "campus":"兩院"},
]

DEMO_MEMBERS = [
    # 實際出席人員（index 0-9）
    {"name":"劉大智","email":"liu@show.org.tw",   "unit":4,"seniority":10,"role_type":"臨床專責"},
    {"name":"李芃逸","email":"lee_pf@show.org.tw","unit":3,"seniority":8, "role_type":"臨床專責"},
    {"name":"李岳聰","email":"lee_yc@show.org.tw","unit":6,"seniority":6, "role_type":"臨床專責"},
    {"name":"林伯儒","email":"lin@show.org.tw",   "unit":2,"seniority":9, "role_type":"臨床專責"},
    {"name":"陳明志","email":"chen@show.org.tw",  "unit":7,"seniority":12,"role_type":"臨床專責"},
    {"name":"張景明","email":"chang@show.org.tw", "unit":5,"seniority":11,"role_type":"臨床專責"},
    {"name":"吳雅媚","email":"wu@show.org.tw",    "unit":0,"seniority":7, "role_type":"行政兼任"},
    {"name":"孔玲鈞","email":"kong@show.org.tw",  "unit":1,"seniority":5, "role_type":"行政兼任"},
    {"name":"杜祐儀","email":"du@show.org.tw",    "unit":8,"seniority":5, "role_type":"行政兼任"},
    {"name":"王心怡","email":"wang@show.org.tw",  "unit":8,"seniority":3, "role_type":"行政兼任"},
    # 測試人員（index 10-24）
    {"name":"測試人A","email":"testA@demo.com","unit":0, "seniority":5,"role_type":"臨床專責"},
    {"name":"測試人B","email":"testB@demo.com","unit":1, "seniority":3,"role_type":"臨床專責"},
    {"name":"測試人C","email":"testC@demo.com","unit":2, "seniority":8,"role_type":"臨床專責"},
    {"name":"測試人D","email":"testD@demo.com","unit":3, "seniority":6,"role_type":"臨床專責"},
    {"name":"測試人E","email":"testE@demo.com","unit":8, "seniority":2,"role_type":"行政兼任"},
    {"name":"測試人F","email":"testF@demo.com","unit":9, "seniority":4,"role_type":"臨床專責"},
    {"name":"測試人G","email":"testG@demo.com","unit":10,"seniority":3,"role_type":"臨床專責"},
    {"name":"測試人H","email":"testH@demo.com","unit":11,"seniority":7,"role_type":"臨床專責"},
    {"name":"測試人I","email":"testI@demo.com","unit":12,"seniority":5,"role_type":"臨床專責"},
    {"name":"測試人J","email":"testJ@demo.com","unit":13,"seniority":2,"role_type":"行政兼任"},
    {"name":"測試人K","email":"testK@demo.com","unit":4, "seniority":6,"role_type":"臨床專責"},
    {"name":"測試人L","email":"testL@demo.com","unit":5, "seniority":4,"role_type":"臨床專責"},
    {"name":"測試人M","email":"testM@demo.com","unit":6, "seniority":3,"role_type":"臨床專責"},
    {"name":"測試人N","email":"testN@demo.com","unit":7, "seniority":9,"role_type":"臨床專責"},
    {"name":"測試人O","email":"testO@demo.com","unit":9, "seniority":5,"role_type":"行政兼任"},
]

DEMO_MEETINGS = [
    {"title":"癌症醫院會議 2026年第1次","session_no":1,"date_offset":-88},
    {"title":"癌症醫院會議 2026年第2次（延期4/17）","session_no":2,"date_offset":-3},
]

DEMO_TASKS = [
    # 第1次會議
    {"title":"各癌別疾病照護品質認證改善計畫","meeting":0,"unit":0,"owner":6,"priority":"高","status":"進行中","due_offset":3, "blocked_reason":"","manpower_needed":3,"manpower_current":2},
    {"title":"放腫科收入業務分析報告",         "meeting":0,"unit":3,"owner":1,"priority":"高","status":"完成",  "due_offset":-60,"blocked_reason":"","manpower_needed":1,"manpower_current":1},
    {"title":"彰化兩院癌症新診斷人數統計",     "meeting":0,"unit":0,"owner":7,"priority":"中","status":"完成",  "due_offset":-55,"blocked_reason":"","manpower_needed":2,"manpower_current":2},
    {"title":"品質指標遜於同儕項目改善計畫",   "meeting":0,"unit":7,"owner":4,"priority":"高","status":"卡關",  "due_offset":-5, "blocked_reason":"需各科提供2024實際數值，內科尚未完整回覆","manpower_needed":4,"manpower_current":2},
    {"title":"癌症防治策進計畫去年度執行報告", "meeting":0,"unit":0,"owner":6,"priority":"中","status":"完成",  "due_offset":-58,"blocked_reason":"","manpower_needed":2,"manpower_current":2},
    {"title":"健康台灣深耕計畫執行追蹤",       "meeting":0,"unit":1,"owner":7,"priority":"中","status":"進行中","due_offset":7,  "blocked_reason":"","manpower_needed":2,"manpower_current":2},
    # 第2次會議（延期）
    {"title":"會議運作調整方案研擬",           "meeting":1,"unit":8,"owner":8,"priority":"高","status":"進行中","due_offset":14, "blocked_reason":"","manpower_needed":2,"manpower_current":2},
    {"title":"交辦任務期限管控機制建立",       "meeting":1,"unit":8,"owner":9,"priority":"高","status":"未開始","due_offset":30, "blocked_reason":"","manpower_needed":1,"manpower_current":0},
    {"title":"議程精實化作業規範",             "meeting":1,"unit":8,"owner":8,"priority":"中","status":"未開始","due_offset":30, "blocked_reason":"","manpower_needed":1,"manpower_current":0},
    {"title":"彰濱放腫科業務擴展規劃",         "meeting":1,"unit":2,"owner":3,"priority":"高","status":"進行中","due_offset":21, "blocked_reason":"","manpower_needed":2,"manpower_current":1},
    {"title":"跨科轉介標準流程建立",           "meeting":1,"unit":0,"owner":6,"priority":"高","status":"進行中","due_offset":10, "blocked_reason":"","manpower_needed":3,"manpower_current":2},
    {"title":"癌症個管師制度建立",             "meeting":1,"unit":1,"owner":5,"priority":"高","status":"卡關",  "due_offset":-2, "blocked_reason":"人力不足，需跨單位協調，候補人選尚未確認","manpower_needed":3,"manpower_current":1},
    {"title":"5月份會議議程預備",             "meeting":1,"unit":8,"owner":8,"priority":"低","status":"未開始","due_offset":21, "blocked_reason":"","manpower_needed":1,"manpower_current":0},
    {"title":"各單位人力盤點表彙整",           "meeting":1,"unit":8,"owner":9,"priority":"中","status":"進行中","due_offset":7,  "blocked_reason":"","manpower_needed":1,"manpower_current":1},
    {"title":"血腫科臨床試驗執行追蹤",         "meeting":1,"unit":4,"owner":0,"priority":"中","status":"進行中","due_offset":14, "blocked_reason":"","manpower_needed":2,"manpower_current":2},
    {"title":"MDT多專科會議標準化",           "meeting":1,"unit":0,"owner":10,"priority":"中","status":"未開始","due_offset":45, "blocked_reason":"","manpower_needed":2,"manpower_current":0},
    {"title":"放腫科QCC品質改善計畫",         "meeting":1,"unit":2,"owner":3,"priority":"中","status":"進行中","due_offset":10, "blocked_reason":"","manpower_needed":2,"manpower_current":2},
]

DEMO_COMMENTS = {
    1:  ["品質認證評核日期訂於6月，請各科加速準備。","彰秀部分已完成初稿，彰濱尚在撰寫中。"],
    4:  ["內科已部分回覆，病理科仍待催促。","建議下次會議列為優先討論事項。"],
    7:  ["已參考他院運作模式，研擬三種方案中。"],
    10: ["跨科轉介SOP草案完成，待各科主任確認。"],
    12: ["個管師職缺已送HR，預計下季招募。"],
}

def _seed_demo(db):
    db.query(Comment).delete()
    db.query(Task).delete()
    db.query(Member).delete()
    db.query(Unit).delete()
    db.query(Meeting).delete()
    db.commit()

    today = date.today()

    meetings = []
    for m in DEMO_MEETINGS:
        obj = Meeting(title=m["title"], session_no=m["session_no"],
                      date=today + timedelta(days=m["date_offset"]))
        db.add(obj); db.flush(); meetings.append(obj)

    units = []
    for u in DEMO_UNITS:
        obj = Unit(name=u["name"], headcount=u["headcount"],
                   available=u["available"], note=u["note"],
                   campus=u.get("campus",""))
        db.add(obj); db.flush(); units.append(obj)

    members = []
    for m in DEMO_MEMBERS:
        obj = Member(name=m["name"], email=m["email"], unit_id=units[m["unit"]].id,
                     seniority=m["seniority"], role_type=m["role_type"])
        db.add(obj); db.flush(); members.append(obj)

    # 自動從人員數量計算 headcount，available = 臨床專責人數
    from collections import Counter
    unit_member_counts   = Counter(m["unit"] for m in DEMO_MEMBERS)
    unit_available_counts = Counter(m["unit"] for m in DEMO_MEMBERS if m["role_type"] == "臨床專責")
    for i, u_obj in enumerate(units):
        u_obj.headcount = unit_member_counts.get(i, 0)
        u_obj.available = unit_available_counts.get(i, 0)
    db.flush()

    tasks = []
    status_map = {"完成": StatusEnum.done, "進行中": StatusEnum.in_progress,
                  "卡關": StatusEnum.blocked, "未開始": StatusEnum.not_started}
    priority_map = {"高": PriorityEnum.high, "中": PriorityEnum.medium, "低": PriorityEnum.low}
    for t in DEMO_TASKS:
        obj = Task(
            title=t["title"], meeting_id=meetings[t["meeting"]].id,
            unit_id=units[t["unit"]].id, owner_id=members[t["owner"]].id,
            due_date=today + timedelta(days=t["due_offset"]),
            priority=priority_map[t["priority"]], status=status_map[t["status"]],
            blocked_reason=t["blocked_reason"],
            manpower_needed=t["manpower_needed"], manpower_current=t["manpower_current"],
        )
        db.add(obj); db.flush(); tasks.append(obj)

    for idx, comments in DEMO_COMMENTS.items():
        for c in comments:
            db.add(Comment(task_id=tasks[idx-1].id, content=c))

    db.commit()
    return len(tasks), len(members)

@app.post("/api/demo/load")
def load_demo(db: Session = Depends(get_db)):
    count_tasks, count_members = _seed_demo(db)
    return {"ok": True, "message": f"Demo 資料已載入：{count_tasks} 件任務、{count_members} 位人員"}

@app.delete("/api/demo/clear")
def clear_demo(db: Session = Depends(get_db)):
    db.query(Comment).delete()
    db.query(Task).delete()
    db.query(Member).delete()
    db.query(Unit).delete()
    db.query(Meeting).delete()
    db.commit()
    return {"ok": True, "message": "所有資料已清除"}
