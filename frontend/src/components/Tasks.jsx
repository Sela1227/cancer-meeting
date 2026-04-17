import { useState, useEffect } from "react";
import { api } from "../api.js";
import { C, F, priorityColor, statusStyle } from "../theme.js";
import { Card, Badge, Avatar, Btn, Empty } from "./UI.jsx";

const STATUSES   = ["未開始","進行中","卡關","完成"];
const PRIORITIES = ["高","中","低"];

const Chip = ({ children }) => (
  <span style={{ fontSize:12, color:C.muted, background:C.bg, padding:"3px 10px", borderRadius:999, fontFamily:F }}>{children}</span>
);

const Modal = ({ title, onClose, children }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:300,
    display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
    <div style={{ background:C.card, borderRadius:16, padding:28, width:"100%", maxWidth:540,
      maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
        <div style={{ fontSize:20, fontWeight:900, fontFamily:F, color:C.text }}>{title}</div>
        <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.muted }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom:14 }}>
    <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:6, fontFamily:F }}>{label}</div>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, type="text" }) => (
  <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:`1px solid ${C.border}`,
      fontSize:15, fontFamily:F, boxSizing:"border-box", background:C.card, color:C.text }}/>
);

const Textarea = ({ value, onChange, placeholder, rows=3 }) => (
  <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:`1px solid ${C.border}`,
      fontSize:14, fontFamily:F, boxSizing:"border-box", resize:"vertical",
      background:C.card, color:C.text }}/>
);

const Select = ({ value, onChange, options }) => (
  <select value={value||""} onChange={e=>onChange(e.target.value)}
    style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:`1px solid ${C.border}`,
      fontSize:15, fontFamily:F, background:C.card, color:C.text }}>
    <option value="">-- 請選擇 --</option>
    {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
  </select>
);

// ── 留言串元件 ──────────────────────────────────────────────────────────────
const CommentThread = ({ taskId, members }) => {
  const [comments, setComments]   = useState([]);
  const [newText, setNewText]     = useState("");
  const [authorId, setAuthorId]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);

  const load = async () => {
    try { setComments(await api.comments(taskId)); } catch {}
  };

  useEffect(() => { if (open) load(); }, [open, taskId]);

  const submit = async () => {
    if (!newText.trim()) return;
    setLoading(true);
    try {
      await api.addComment(taskId, { content: newText, author_id: authorId ? +authorId : null });
      setNewText(""); await load();
    } finally { setLoading(false); }
  };

  return (
    <div style={{ marginTop:12, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:"none", border:"none", cursor:"pointer", padding:0,
        fontSize:12, color:C.accentMid, fontFamily:F, fontWeight:700,
        display:"flex", alignItems:"center", gap:4,
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 2h12v9H9l-3 3v-3H2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        留言{comments.length>0 ? ` (${comments.length})` : ""}
        <span style={{ fontSize:10, color:C.muted }}>{open?"▲":"▼"}</span>
      </button>

      {open && (
        <div style={{ marginTop:10 }}>
          {comments.length===0
            ? <div style={{ fontSize:12, color:C.muted, fontFamily:F, marginBottom:8 }}>尚無留言</div>
            : comments.map((c,i) => (
              <div key={i} style={{ marginBottom:8, padding:"8px 12px",
                background:C.cardAlt, borderRadius:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  {c.author_id && <Avatar name={
                    members.find(m=>m.id===c.author_id)?.name||"?"} size={20}/>}
                  <span style={{ fontSize:11, color:C.muted, fontFamily:F }}>
                    {members.find(m=>m.id===c.author_id)?.name||"匿名"}
                    {" · "}{c.created_at?.slice(0,10)||""}
                  </span>
                </div>
                <div style={{ fontSize:13, color:C.text, fontFamily:F, lineHeight:1.5 }}>{c.content}</div>
              </div>
            ))
          }
          {/* 新增留言 */}
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
            <select value={authorId} onChange={e=>setAuthorId(e.target.value)}
              style={{ padding:"6px 10px", borderRadius:8, border:`1px solid ${C.border}`,
                fontSize:12, fontFamily:F, background:C.card, color:C.text }}>
              <option value="">匿名留言</option>
              {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <textarea value={newText} onChange={e=>setNewText(e.target.value)}
              placeholder="輸入留言..." rows={2}
              style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.border}`,
                fontSize:13, fontFamily:F, resize:"none",
                background:C.card, color:C.text }}/>
            <button onClick={submit} disabled={loading||!newText.trim()} style={{
              alignSelf:"flex-end", background:C.accent, color:"#fff", border:"none",
              padding:"6px 16px", borderRadius:8, fontSize:13, fontWeight:700,
              fontFamily:F, cursor:"pointer", opacity:loading?"0.6":"1",
            }}>{loading?"送出中...":"送出留言"}</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── 任務卡片 ────────────────────────────────────────────────────────────────
const TaskCard = ({ task, members, onEdit, onDelete, isSelected, onToggle }) => {
  const pc = priorityColor[task.priority]||C.muted;
  return (
    <Card style={{ padding:"18px 18px 18px 22px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:5, background:pc }}/>
      <div style={{ position:"absolute", top:12, right:12 }}>
        <input type="checkbox" checked={isSelected||false} onChange={onToggle}
          style={{ width:16, height:16, accentColor:C.accent, cursor:"pointer" }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:12 }}>
        <div style={{ fontSize:17, fontWeight:800, color:C.text, fontFamily:F, flex:1, lineHeight:1.4 }}>{task.title}</div>
        <Badge status={task.status} overdue={task.overdue}/>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", marginBottom:10 }}>
        {task.owner_name && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <Avatar name={task.owner_name} size={22}/>
            <span style={{ fontSize:13, color:C.muted, fontFamily:F }}>{task.owner_name}</span>
          </div>
        )}
        {task.unit_name     && <Chip>{task.unit_name}</Chip>}
        {task.meeting_label && <Chip>{task.meeting_label}</Chip>}
        {task.due_date      && (
          <span style={{ fontSize:13, fontWeight:700, color:task.overdue?C.danger:C.muted, marginLeft:"auto", fontFamily:F }}>
            {task.due_date}
          </span>
        )}
      </div>
      {/* 前置任務等待提示 */}
      {task.depends_on_id && !task.depends_on_done && (
        <div style={{ fontSize:13, color:C.warn, background:C.warnLight,
          padding:"6px 12px", borderRadius:8, fontFamily:F, marginBottom:8,
          display:"flex", alignItems:"center", gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 4v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          等待：{task.depends_on_title}
        </div>
      )}
      {task.depends_on_id && task.depends_on_done && (
        <div style={{ fontSize:12, color:C.blue, fontFamily:F, marginBottom:4 }}>
          ✓ 前置任務已完成：{task.depends_on_title}
        </div>
      )}
      {task.blocked_reason && (
        <div style={{ fontSize:13, color:C.danger, background:C.dangerLight,
          padding:"6px 12px", borderRadius:8, fontFamily:F, marginBottom:8 }}>
          卡關原因：{task.blocked_reason}
        </div>
      )}
      {task.status!=="完成" && task.status!=="未開始" && (
        <div style={{ marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:12, color:C.muted, fontFamily:F }}>{task.progress_note||"進度"}</span>
            <span style={{ fontSize:12, fontWeight:700, color:C.accentMid, fontFamily:F }}>{task.progress_pct||0}%</span>
          </div>
          <div style={{ height:6, background:C.border, borderRadius:3 }}>
            <div style={{ width:`${task.progress_pct||0}%`, height:"100%", borderRadius:3,
              background:(task.progress_pct||0)>=80?C.blue:C.accentMid, transition:"width 0.4s" }}/>
          </div>
        </div>
      )}
      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <Btn variant="secondary" onClick={()=>onEdit(task)} style={{ padding:"6px 14px", fontSize:13 }}>編輯</Btn>
        <Btn variant="danger"    onClick={()=>onDelete(task.id)} style={{ padding:"6px 14px", fontSize:13 }}>刪除</Btn>
      </div>
      <CommentThread taskId={task.id} members={members}/>
    </Card>
  );
};

// ── 主元件 ──────────────────────────────────────────────────────────────────
export default function Tasks({ tasks, units, members, meetings, reload }) {
  const [filter, setFilter]   = useState("all");
  const [campus, setCampus]   = useState("all"); // all | 彰秀 | 彰濱
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [batchModal, setBatchModal] = useState(false);
  const [batchForm, setBatchForm]   = useState({});
  const [batching, setBatching]     = useState(false);

  const toggleSelect = id => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const selectAll = () => setSelected(new Set(filtered.map(t=>t.id)));
  const clearSel  = () => setSelected(new Set());

  const batchSave = async () => {
    if (!selected.size) return;
    setBatching(true);
    try {
      const patch = { ids: [...selected] };
      if (batchForm.status)   patch.status   = batchForm.status;
      if (batchForm.priority) patch.priority  = batchForm.priority;
      if (batchForm.owner_id) patch.owner_id  = +batchForm.owner_id;
      if (batchForm.due_date) patch.due_date  = batchForm.due_date;
      await api.batchUpdate(patch);
      await reload(); setBatchModal(false); clearSel(); setBatchForm({});
    } finally { setBatching(false); }
  };

  // 院別篩選：比對 unit 的 campus（透過 units prop）
  const unitCampus = id => units.find(u=>u.id===id)?.campus || "";

  const campusFiltered = campus==="all" ? tasks
    : tasks.filter(t => {
        const uc = unitCampus(t.unit_id);
        if (campus==="兩院") return uc==="兩院";
        return uc===campus || uc==="兩院";
      });

  const filtered = filter==="all" ? campusFiltered : campusFiltered.filter(t=>
    filter==="overdue" ? t.overdue : t.status===filter);

  const openNew  = () => { setForm({}); setModal(true); };
  const openEdit = (task) => { setForm({...task}); setModal(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (form.id) await api.updateTask(form.id, form);
      else         await api.createTask(form);
      await reload(); setModal(false);
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("確定刪除？")) return;
    await api.deleteTask(id); reload();
  };

  const set = k => v => setForm(f=>({...f,[k]:v}));

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:26, fontWeight:900, color:C.text, fontFamily:F }}>任務列表</div>
        <Btn onClick={openNew}>新增任務</Btn>
      </div>
      {/* 院別篩選 */}
      <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
        {[{k:"all",l:"全部院區"},{k:"彰秀",l:"彰秀"},{k:"彰濱",l:"彰濱"},{k:"兩院",l:"兩院共用"}].map(b=>(
          <button key={b.k} onClick={()=>setCampus(b.k)} style={{
            padding:"5px 14px", borderRadius:999, border:"none", cursor:"pointer", fontFamily:F,
            fontSize:12, fontWeight:campus===b.k?800:400,
            background:campus===b.k?C.accentMid:C.cardAlt,
            color:campus===b.k?"#fff":C.muted,
          }}>{b.l}</button>
        ))}
      </div>
      {/* 狀態篩選 */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {[
          { key:"all",    label:`全部 (${campusFiltered.length})` },
          { key:"進行中", label:`進行中 (${campusFiltered.filter(t=>t.status==="進行中").length})` },
          { key:"卡關",   label:`卡關 (${campusFiltered.filter(t=>t.status==="卡關").length})` },
          { key:"overdue",label:`逾期 (${campusFiltered.filter(t=>t.overdue).length})` },
          { key:"完成",   label:`完成 (${campusFiltered.filter(t=>t.status==="完成").length})` },
        ].map(b=>(
          <button key={b.key} onClick={()=>setFilter(b.key)} style={{
            padding:"7px 16px", borderRadius:999, border:"none", cursor:"pointer", fontFamily:F,
            fontSize:13, fontWeight:filter===b.key?800:500,
            background:filter===b.key?C.accent:C.card,
            color:filter===b.key?"#fff":C.muted,
          }}>{b.label}</button>
        ))}
      </div>
      {/* 批次操作工具列 */}
      {selected.size > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
          background:C.accentLight, borderRadius:12, marginBottom:4, flexWrap:"wrap" }}>
          <span style={{ fontSize:14, fontWeight:700, color:C.accent, fontFamily:F }}>
            已選 {selected.size} 件
          </span>
          <Btn onClick={()=>setBatchModal(true)} style={{ padding:"6px 14px", fontSize:13 }}>批次修改</Btn>
          <Btn variant="secondary" onClick={clearSel} style={{ padding:"6px 14px", fontSize:13 }}>取消選取</Btn>
        </div>
      )}
      {/* 全選按鈕 */}
      {filtered.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <button onClick={selected.size===filtered.length?clearSel:selectAll} style={{
            background:"none", border:`1px solid ${C.border}`, borderRadius:6,
            padding:"4px 12px", fontSize:12, cursor:"pointer", color:C.muted, fontFamily:F,
          }}>{selected.size===filtered.length?"取消全選":"全選"}</button>
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {filtered.length
          ? filtered.map(t=><TaskCard key={t.id} task={t} members={members} onEdit={openEdit} onDelete={del} isSelected={selected.has(t.id)} onToggle={()=>toggleSelect(t.id)}/>)
          : <Empty label="沒有符合的任務"/>}
      </div>

      {/* 批次修改 Modal */}
      {batchModal && (
        <Modal title={`批次修改（${selected.size} 件任務）`} onClose={()=>setBatchModal(false)}>
          <div style={{ fontSize:13, color:C.muted, fontFamily:F, marginBottom:16 }}>
            只填想修改的欄位，空白欄位不變更。
          </div>
          <Field label="狀態">
            <Select value={batchForm.status||""} onChange={v=>setBatchForm(f=>({...f,status:v||undefined}))} options={STATUSES}/>
          </Field>
          <Field label="優先級">
            <Select value={batchForm.priority||""} onChange={v=>setBatchForm(f=>({...f,priority:v||undefined}))} options={PRIORITIES}/>
          </Field>
          <Field label="主責人">
            <Select value={batchForm.owner_id||""} onChange={v=>setBatchForm(f=>({...f,owner_id:v||undefined}))}
              options={members.map(m=>({value:m.id,label:`${m.name}（${m.unit_name||""}）`}))}/>
          </Field>
          <Field label="截止日期"><Input type="date" value={batchForm.due_date||""} onChange={v=>setBatchForm(f=>({...f,due_date:v||undefined}))}/></Field>
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <Btn onClick={batchSave} style={{ flex:1 }}>{batching?"修改中...":"確認批次修改"}</Btn>
            <Btn variant="secondary" onClick={()=>setBatchModal(false)} style={{ flex:1 }}>取消</Btn>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={form.id?"編輯任務":"新增任務"} onClose={()=>setModal(false)}>
          <Field label="任務名稱"><Input value={form.title} onChange={set("title")} placeholder="輸入任務名稱"/></Field>
          <Field label="說明"><Input value={form.description} onChange={set("description")} placeholder="說明（選填）"/></Field>
          <Field label="所屬會議">
            <Select value={form.meeting_id} onChange={v=>set("meeting_id")(v?+v:null)}
              options={meetings.map(m=>({value:m.id,label:`第${m.session_no}次 ${m.title}`}))}/>
          </Field>
          <Field label="主責單位">
            <Select value={form.unit_id} onChange={v=>set("unit_id")(v?+v:null)}
              options={units.map(u=>({value:u.id,label:u.name}))}/>
          </Field>
          <Field label="主責人">
            <Select value={form.owner_id} onChange={v=>set("owner_id")(v?+v:null)}
              options={members.map(m=>({value:m.id,label:`${m.name}（${m.unit_name||""}）`}))}/>
          </Field>
          <Field label="協助人">
            <Select value={form.assistant_id} onChange={v=>set("assistant_id")(v?+v:null)}
              options={members.map(m=>({value:m.id,label:`${m.name}（${m.unit_name||""}）`}))}/>
          </Field>
          <Field label="所屬議題">
            <Select value={form.agenda_id} onChange={v=>set("agenda_id")(v?+v:null)}
              options={meetings.flatMap(m=>
                (m.agendas||[]).map(a=>({value:a.id,label:`第${m.session_no}次｜${a.order_no}. ${a.title}`}))
              )}/>
          </Field>
          <Field label="截止日期"><Input type="date" value={form.due_date} onChange={set("due_date")}/></Field>
          <Field label="優先級">
            <Select value={form.priority} onChange={set("priority")} options={PRIORITIES}/>
          </Field>
          <Field label="進度狀態">
            <Select value={form.status} onChange={set("status")} options={STATUSES}/>
          </Field>
          {form.status==="卡關" && (
            <Field label="卡關原因">
              <Input value={form.blocked_reason} onChange={set("blocked_reason")} placeholder="說明卡關原因"/>
            </Field>
          )}
          {(form.status==="進行中"||form.status==="卡關") && (<>
            <Field label={`進度回報 ${form.progress_pct||0}%`}>
              <input type="range" min="0" max="100" step="5" value={form.progress_pct||0}
                onChange={e=>set("progress_pct")(+e.target.value)}
                style={{ width:"100%", accentColor:C.accent }}/>
            </Field>
            <Field label="進度說明">
              <Input value={form.progress_note} onChange={set("progress_note")} placeholder="簡述目前進度（回報後通知秘書）"/>
            </Field>
          </>)}
          <Field label="前置任務（完成後才能開始）">
            <Select value={form.depends_on_id} onChange={v=>set("depends_on_id")(v?+v:null)}
              options={tasks
                .filter(t=>t.id!==form.id)
                .map(t=>({value:t.id,label:`${t.title.slice(0,28)}${t.title.length>28?"…":""}（${t.status}）`}))}/>
          </Field>
          <Field label="需求人力">
            <Input type="number" value={form.manpower_needed} onChange={v=>set("manpower_needed")(+v)} placeholder="0"/>
          </Field>
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <Btn onClick={save} style={{ flex:1 }}>{saving?"儲存中...":"儲存"}</Btn>
            <Btn variant="secondary" onClick={()=>setModal(false)} style={{ flex:1 }}>取消</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
