from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Optional, List
from pydantic import BaseModel
import os

from database import engine, get_db, Base, SessionLocal
from models import Meeting, Unit, Member, Task, Comment, PriorityEnum, StatusEnum
from scheduler import start_scheduler

# ── Startup ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
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
    name: str; headcount: int = 0; available: int = 0; note: str = ""

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

class TaskPatch(BaseModel):
    title: Optional[str] = None; description: Optional[str] = None
    unit_id: Optional[int] = None; owner_id: Optional[int] = None
    assistant_id: Optional[int] = None; due_date: Optional[date] = None
    priority: Optional[PriorityEnum] = None; status: Optional[StatusEnum] = None
    blocked_reason: Optional[str] = None
    manpower_needed: Optional[int] = None; manpower_current: Optional[int] = None

class CommentIn(BaseModel):
    content: str; author_id: Optional[int] = None

# ── Helpers ───────────────────────────────────────────────────────────────────
def is_overdue(task: Task) -> bool:
    return bool(task.due_date and task.due_date < date.today() and task.status != StatusEnum.done)

def member_dict(m: Member, db: Session) -> dict:
    tasks = db.query(Task).filter(Task.owner_id == m.id).all()
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == StatusEnum.done)
    overdue   = sum(1 for t in tasks if is_overdue(t))
    load = min(100, total * 8 + overdue * 15)
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
        "created_at": str(t.created_at),
        "owner_name": t.owner.name if t.owner else None,
        "unit_name": t.unit.name if t.unit else None,
        "meeting_label": f"第{t.meeting.session_no}次" if t.meeting else None,
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
    for k, v in data.model_dump(exclude_none=True).items(): setattr(t, k, v)
    db.commit(); db.refresh(t); return task_dict(t)

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
        load      = min(100, total * 8 + overdue * 15)
        result.append({
            "id": u.id, "name": u.name,
            "headcount": u.headcount, "available": u.available,
            "tasks": total, "completed": completed,
            "overdue": overdue, "load": load, "note": u.note,
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
                                    TableStyle, Spacer, HRFlowable, KeepTogether)
    from reportlab.graphics.shapes import Drawing, Rect, String, Line
    from reportlab.graphics import renderPDF

    _register_fonts()
    CN     = "STSong-Light"
    CNB    = "STSong-Light"
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
    all_tasks   = db.query(Task).all()
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
        return ParagraphStyle("s", fontName=CNB if bold else CN,
            fontSize=size, textColor=color, alignment=align, leading=size*1.5)

    def p(txt, size=10, align=0, color=DARK, bold=False):
        return Paragraph(txt, ps(size, align, color, bold))

    CW = [W*0.33, W*0.12, W*0.24, W*0.14, W*0.17]

    def task_table(tasks, show_reason=False):
        header = [p("任務名稱",9,bold=True,color=colors.white),
                  p("主責人", 9,bold=True,color=colors.white),
                  p("主責單位",9,bold=True,color=colors.white),
                  p("截止日", 9,bold=True,color=colors.white),
                  p("狀態",   9,bold=True,color=colors.white)]
        data = [header]
        red_rows = []
        for i, t in enumerate(tasks, 1):
            label  = "逾期" if is_overdue(t) else t.status.value
            reason = f"\n※{t.blocked_reason[:28]}" if show_reason and t.blocked_reason else ""
            uname  = (t.unit.name if t.unit else "—").replace("（","\n（")
            sc = RED if is_overdue(t) else (AMBER if t.status==StatusEnum.blocked else DARK)
            data.append([
                p(t.title[:22]+("…" if len(t.title)>22 else ""),9),
                p(t.owner.name if t.owner else "—",9),
                p(uname,8),
                p(str(t.due_date) if t.due_date else "—",9),
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
        for r in red_rows:
            style.append(("BACKGROUND",(0,r),(-1,r),colors.HexColor("#F5E8E8")))
        tbl.setStyle(TableStyle(style))
        return tbl

    def sec(title, color=BROWN):
        return [Spacer(1,0.35*cm), p(f"▌ {title}",12,bold=True,color=color), Spacer(1,0.15*cm)]

    # ── 圖表：任務狀態圓餅 ─────────────────────────────────────────────────────
    def status_pie_drawing():
        total = len(all_tasks)
        if total == 0:
            return None
        slices = [
            ("完成",   len(done_t),    GREEN),
            ("進行中", len(inprog_t),  BLUE),
            ("卡關",   len(blocked_t), AMBER),
            ("逾期",   len(overdue_t), RED),
            ("未開始", len(all_tasks)-len(done_t)-len(inprog_t)-len(blocked_t)-len(overdue_t), GREY),
        ]
        slices = [(l,v,c) for l,v,c in slices if v>0]
        import math
        d = Drawing(180,160)
        cx,cy,r = 80,80,65
        angle = 0
        for label,val,col in slices:
            sweep = val/total*360
            # 繪製扇形（用多邊形近似）
            pts = [cx,cy]
            steps = max(int(sweep/3),2)
            for k in range(steps+1):
                a = math.radians(angle + k*sweep/steps)
                pts += [cx+r*math.cos(a), cy+r*math.sin(a)]
            from reportlab.graphics.shapes import Polygon
            d.add(Polygon(pts, fillColor=col, strokeColor=colors.white, strokeWidth=1.5))
            # 標籤
            mid_a = math.radians(angle + sweep/2)
            lx = cx + (r+18)*math.cos(mid_a)
            ly = cy + (r+18)*math.sin(mid_a)
            pct = int(val/total*100)
            if pct >= 8:
                d.add(String(lx,ly,f"{pct}%",fontName=CN,fontSize=8,
                    fillColor=DARK,textAnchor="middle"))
            angle += sweep
        # 圖例
        lx0,ly0 = 155,145
        for i,(label,val,col) in enumerate(slices):
            lyi = ly0 - i*14
            d.add(Rect(lx0,lyi,10,10,fillColor=col,strokeColor=None))
            d.add(String(lx0+13,lyi+1,f"{label} {val}",fontName=CN,fontSize=8,fillColor=DARK))
        return d

    # ── 圖表：各單位任務橫條圖 ────────────────────────────────────────────────
    def unit_bar_drawing(units_data):
        if not units_data:
            return None
        n = len(units_data)
        dh = max(n*28+40, 100)
        d = Drawing(W*2.83, dh)  # 轉 pt
        max_v = max((u["total"] for u in units_data), default=1)
        BAR_W = W*2.83 - 160
        for i,u in enumerate(units_data):
            y = dh - 30 - i*28
            # 底色軌道
            d.add(Rect(120,y,BAR_W,16,fillColor=colors.HexColor("#EDE5DC"),strokeColor=None))
            # 完成 bar
            if u["total"] > 0:
                done_w   = (u["completed"]/max_v)*BAR_W
                remain_w = (u["total"]/max_v)*BAR_W - done_w
                d.add(Rect(120,y,done_w,16,fillColor=GREEN,strokeColor=None))
                d.add(Rect(120+done_w,y,remain_w,16,fillColor=AMBER,strokeColor=None))
                if u["overdue"] > 0:
                    ov_w = (u["overdue"]/max_v)*BAR_W
                    d.add(Rect(120+done_w+remain_w-ov_w,y,ov_w,16,fillColor=RED,strokeColor=None))
            # 單位名
            name = u["name"].replace("（","(").replace("）",")")
            if len(name)>8: name = name[:8]+"…"
            d.add(String(115,y+4,name,fontName=CN,fontSize=8,fillColor=DARK,textAnchor="end"))
            # 數字
            d.add(String(120+BAR_W+4,y+4,f"{u['total']}件",fontName=CN,fontSize=8,fillColor=DARK))
        # 圖例
        gy = 8
        for col,lab in [(GREEN,"完成"),(AMBER,"進行中"),(RED,"逾期")]:
            d.add(Rect(120,gy,10,10,fillColor=col,strokeColor=None))
            d.add(String(133,gy+1,lab,fontName=CN,fontSize=8,fillColor=DARK))
            gy += 0 ; pass
        for j,(col,lab) in enumerate([(GREEN,"完成"),(AMBER,"進行中"),(RED,"逾期")]):
            d.add(Rect(120+j*70,8,10,10,fillColor=col,strokeColor=None))
            d.add(String(133+j*70,9,lab,fontName=CN,fontSize=8,fillColor=DARK))
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
        ("FONTNAME",(0,0),(-1,-1),CNB),
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

    doc.build(story)
    buf.seek(0)
    filename = f"癌症醫院週報_{today}.pdf"
    return StreamingResponse(buf,media_type="application/pdf",
        headers={"Content-Disposition":f"attachment; filename*=UTF-8''{filename.encode().hex()}"})

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
    {"name":"癌症防治中心",      "headcount":6, "available":4,"note":"統籌兩院癌症防治業務"},
    {"name":"放腫科（彰濱）",    "headcount":5, "available":2,"note":"設備值班限制可用人力"},
    {"name":"放腫科（彰秀）",    "headcount":5, "available":2,"note":""},
    {"name":"血液腫瘤科（彰濱）","headcount":4, "available":2,"note":""},
    {"name":"血液腫瘤科（彰秀）","headcount":4, "available":2,"note":""},
    {"name":"一般外科（彰濱）",  "headcount":6, "available":2,"note":""},
    {"name":"內科（彰秀）",      "headcount":8, "available":3,"note":"住院醫師輪訓中"},
    {"name":"醫務管理組",        "headcount":4, "available":3,"note":"癌症醫院行政窗口"},
]

DEMO_MEMBERS = [
    {"name":"劉大智","email":"liu@show.org.tw",   "unit":3,"seniority":10,"role_type":"臨床專責"},  # 彰濱血腫
    {"name":"李芃逸","email":"lee_pf@show.org.tw","unit":2,"seniority":8, "role_type":"臨床專責"},  # 彰秀放腫
    {"name":"李岳聰","email":"lee_yc@show.org.tw","unit":5,"seniority":6, "role_type":"臨床專責"},  # 彰濱一般外
    {"name":"林伯儒","email":"lin@show.org.tw",   "unit":1,"seniority":9, "role_type":"臨床專責"},  # 彰濱放腫/癌症中心
    {"name":"陳明志","email":"chen@show.org.tw",  "unit":6,"seniority":12,"role_type":"臨床專責"},  # 彰秀內科
    {"name":"張景明","email":"chang@show.org.tw", "unit":4,"seniority":11,"role_type":"臨床專責"},  # 彰秀血腫/癌症中心
    {"name":"吳雅媚","email":"wu@show.org.tw",    "unit":0,"seniority":7, "role_type":"行政兼任"},  # 彰秀癌症中心
    {"name":"孔玲鈞","email":"kong@show.org.tw",  "unit":0,"seniority":5, "role_type":"行政兼任"},  # 彰濱癌症中心
    {"name":"杜祐儀","email":"du@show.org.tw",    "unit":7,"seniority":5, "role_type":"行政兼任"},  # 彰秀經管/秘書
    {"name":"王心怡","email":"wang@show.org.tw",  "unit":7,"seniority":3, "role_type":"行政兼任"},  # 彰秀經管
]

DEMO_MEETINGS = [
    {"title":"癌症醫院會議 2026年第1次","session_no":1,"date_offset":-88},
    {"title":"癌症醫院會議 2026年第2次（延期4/17）","session_no":2,"date_offset":-3},
]

DEMO_TASKS = [
    # 第1次會議
    {"title":"各癌別疾病照護品質認證改善計畫","meeting":0,"unit":0,"owner":6,"priority":"高","status":"進行中","due_offset":3, "blocked_reason":"","manpower_needed":3,"manpower_current":2},
    {"title":"放腫科收入業務分析報告",         "meeting":0,"unit":2,"owner":1,"priority":"高","status":"完成",  "due_offset":-60,"blocked_reason":"","manpower_needed":1,"manpower_current":1},
    {"title":"彰化兩院癌症新診斷人數統計",     "meeting":0,"unit":0,"owner":7,"priority":"中","status":"完成",  "due_offset":-55,"blocked_reason":"","manpower_needed":2,"manpower_current":2},
    {"title":"品質指標遜於同儕項目改善計畫",   "meeting":0,"unit":6,"owner":4,"priority":"高","status":"卡關",  "due_offset":-5, "blocked_reason":"需各科提供2024實際數值，內科尚未完整回覆","manpower_needed":4,"manpower_current":2},
    {"title":"癌症防治策進計畫去年度執行報告", "meeting":0,"unit":0,"owner":6,"priority":"中","status":"完成",  "due_offset":-58,"blocked_reason":"","manpower_needed":2,"manpower_current":2},
    {"title":"健康台灣深耕計畫執行追蹤",       "meeting":0,"unit":0,"owner":7,"priority":"中","status":"進行中","due_offset":7,  "blocked_reason":"","manpower_needed":2,"manpower_current":2},
    # 第2次會議（延期）
    {"title":"會議運作調整方案研擬",           "meeting":1,"unit":7,"owner":8,"priority":"高","status":"進行中","due_offset":14, "blocked_reason":"","manpower_needed":2,"manpower_current":2},
    {"title":"交辦任務期限管控機制建立",       "meeting":1,"unit":7,"owner":9,"priority":"高","status":"未開始","due_offset":30, "blocked_reason":"","manpower_needed":1,"manpower_current":0},
    {"title":"議程精實化作業規範",             "meeting":1,"unit":7,"owner":8,"priority":"中","status":"未開始","due_offset":30, "blocked_reason":"","manpower_needed":1,"manpower_current":0},
    {"title":"彰濱放腫科業務擴展規劃",         "meeting":1,"unit":1,"owner":3,"priority":"高","status":"進行中","due_offset":21, "blocked_reason":"","manpower_needed":2,"manpower_current":1},
    {"title":"跨科轉介標準流程建立",           "meeting":1,"unit":0,"owner":6,"priority":"高","status":"進行中","due_offset":10, "blocked_reason":"","manpower_needed":3,"manpower_current":2},
    {"title":"癌症個管師制度建立",             "meeting":1,"unit":0,"owner":5,"priority":"高","status":"卡關",  "due_offset":-2, "blocked_reason":"人力不足，需跨單位協調，候補人選尚未確認","manpower_needed":3,"manpower_current":1},
    {"title":"5月份會議議程預備",             "meeting":1,"unit":7,"owner":8,"priority":"低","status":"未開始","due_offset":21, "blocked_reason":"","manpower_needed":1,"manpower_current":0},
    {"title":"各單位人力盤點表彙整",           "meeting":1,"unit":7,"owner":9,"priority":"中","status":"進行中","due_offset":7,  "blocked_reason":"","manpower_needed":1,"manpower_current":1},
    {"title":"血腫科臨床試驗執行追蹤",         "meeting":1,"unit":3,"owner":0,"priority":"中","status":"進行中","due_offset":14, "blocked_reason":"","manpower_needed":2,"manpower_current":2},
    {"title":"MDT多專科會議標準化",           "meeting":1,"unit":0,"owner":5,"priority":"中","status":"未開始","due_offset":45, "blocked_reason":"","manpower_needed":2,"manpower_current":0},
    {"title":"放腫科QCC品質改善計畫",         "meeting":1,"unit":1,"owner":3,"priority":"中","status":"進行中","due_offset":10, "blocked_reason":"","manpower_needed":2,"manpower_current":2},
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
                   available=u["available"], note=u["note"])
        db.add(obj); db.flush(); units.append(obj)

    members = []
    for m in DEMO_MEMBERS:
        obj = Member(name=m["name"], email=m["email"], unit_id=units[m["unit"]].id,
                     seniority=m["seniority"], role_type=m["role_type"])
        db.add(obj); db.flush(); members.append(obj)

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
