import { useState } from "react";
import { api } from "../api.js";
import { C, F } from "../theme.js";
import { Card, LoadBar, Avatar, Btn, SectionLabel, Empty } from "./UI.jsx";

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 900, fontFamily: F }}>{title}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.muted }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6, fontFamily: F }}>{label}</div>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, type = "text" }) => (
  <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, fontFamily: F, boxSizing: "border-box" }}/>
);

const Select = ({ value, onChange, options }) => (
  <select value={value || ""} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, fontFamily: F }}>
    <option value="">-- 請選擇 --</option>
    {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
  </select>
);

export default function Members({ members, units, reload }) {
  const [modal, setModal]   = useState(null); // "member" | "unit" | null
  const [form, setForm]     = useState({});
  const [unitForm, setUnitForm] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const setU = (k) => (v) => setUnitForm(f => ({ ...f, [k]: v }));

  const saveMember = async () => {
    setSaving(true);
    try {
      if (form.id) await api.updateMember(form.id, form);
      else         await api.createMember(form);
      await reload(); setModal(null);
    } finally { setSaving(false); }
  };

  const saveUnit = async () => {
    setSaving(true);
    try {
      if (unitForm.id) await api.updateUnit(unitForm.id, unitForm);
      else             await api.createUnit(unitForm);
      await reload(); setModal(null);
    } finally { setSaving(false); }
  };

  const delMember = async (id) => {
    if (!window.confirm("確定刪除成員？")) return;
    await api.deleteMember(id); reload();
  };

  // Group members by unit
  const byUnit = units.map(u => ({
    unit: u,
    members: members.filter(m => m.unit_id === u.id),
  }));
  const unassigned = members.filter(m => !m.unit_id);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: C.text, fontFamily: F }}>人員負荷總覽</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" onClick={() => { setUnitForm({}); setModal("unit"); }}>新增單位</Btn>
          <Btn onClick={() => { setForm({}); setModal("member"); }}>新增人員</Btn>
        </div>
      </div>

      {/* Unit cards */}
      <SectionLabel>單位評估（含人員）</SectionLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:16 }}>
        {units.map((u, i) => {
          const unitMembers = members.filter(m => m.unit_id === u.id);
          const avgLoad     = unitMembers.length ? Math.round(unitMembers.reduce((a,m)=>a+m.load,0)/unitMembers.length) : 0;
          const totalTasks  = unitMembers.reduce((a,m)=>a+m.task_count,0);
          const loadColor   = avgLoad>=80 ? C.danger : avgLoad>=60 ? C.warn : C.accent;
          return (
            <Card key={i} style={{ borderLeft:`5px solid ${loadColor}`, padding:"20px" }}>
              {/* 單位標題列 */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:900, color:C.text, fontFamily:F }}>{u.name}</div>
                  {u.note && <div style={{ fontSize:12, color:C.warn, fontFamily:F, marginTop:2 }}>{u.note}</div>}
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                    {[
                      { label:"編制", v:u.headcount, warn:false },
                      { label:"可用", v:u.available, warn:u.available<=1 },
                      { label:"任務", v:totalTasks,  warn:false },
                    ].map(s=>(
                      <div key={s.label} style={{ background:C.bg, borderRadius:8, padding:"6px 10px", textAlign:"center", minWidth:48 }}>
                        <div style={{ fontSize:18, fontWeight:900, color:s.warn?C.danger:C.text, fontFamily:F }}>{s.v}</div>
                        <div style={{ fontSize:10, color:C.muted, fontFamily:F }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <Btn variant="secondary" onClick={()=>{ setUnitForm({...u}); setModal("unit"); }} style={{ padding:"5px 12px", fontSize:12, flexShrink:0 }}>編輯</Btn>
                </div>
              </div>
              <div style={{ marginBottom:12 }}><LoadBar load={avgLoad}/></div>

              {/* 所屬人員 */}
              {unitMembers.length > 0 ? (
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                  <div style={{ fontSize:11, color:C.muted, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:F, marginBottom:8 }}>所屬人員</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:8 }}>
                    {unitMembers.map((m,j)=>(
                      <div key={j} style={{ display:"flex", alignItems:"center", gap:10,
                        background:C.bg, borderRadius:10, padding:"10px 12px" }}>
                        <Avatar name={m.name} size={34}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text, fontFamily:F }}>{m.name}</div>
                          <div style={{ fontSize:11, color:C.muted, fontFamily:F }}>{m.role_type} · {m.seniority}年</div>
                          <div style={{ marginTop:4, height:4, background:C.border, borderRadius:2 }}>
                            <div style={{ width:`${Math.min(m.load,100)}%`, height:"100%", borderRadius:2,
                              background:m.load>=90?C.danger:m.load>=60?C.warn:C.accent }}/>
                          </div>
                        </div>
                        <div style={{ textAlign:"center", flexShrink:0 }}>
                          <div style={{ fontSize:16, fontWeight:900, color:C.text, fontFamily:F }}>{m.task_count}</div>
                          <div style={{ fontSize:9, color:C.muted, fontFamily:F }}>件</div>
                        </div>
                        <div style={{ display:"flex", gap:4 }}>
                          <button onClick={()=>{ setForm({...m}); setModal("member"); }}
                            style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6,
                              padding:"4px 8px", fontSize:11, cursor:"pointer", color:C.muted, fontFamily:F }}>編輯</button>
                          <button onClick={()=>delMember(m.id)}
                            style={{ background:"none", border:`1px solid ${C.dangerLight}`, borderRadius:6,
                              padding:"4px 8px", fontSize:11, cursor:"pointer", color:C.danger, fontFamily:F }}>刪</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10,
                  fontSize:13, color:C.muted, fontFamily:F }}>尚無人員</div>
              )}
            </Card>
          );
        })}
      </div>

      {/* 未分配人員 */}
      {unassigned.length > 0 && (
        <Card style={{ borderLeft:`5px solid ${C.border}` }}>
          <div style={{ fontSize:15, fontWeight:800, color:C.muted, fontFamily:F, marginBottom:10 }}>未分配單位</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:8 }}>
            {unassigned.map((m,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:C.bg, borderRadius:10, padding:"10px 12px" }}>
                <Avatar name={m.name} size={34}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text, fontFamily:F }}>{m.name}</div>
                </div>
                <button onClick={()=>{ setForm({...m}); setModal("member"); }}
                  style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", fontSize:11, cursor:"pointer", color:C.muted, fontFamily:F }}>編輯</button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {members.length === 0 && <Empty label="尚無人員資料"/>}

      {/* Member modal */}
      {modal === "member" && (
        <Modal title={form.id ? "編輯人員" : "新增人員"} onClose={() => setModal(null)}>
          <Field label="姓名"><Input value={form.name} onChange={set("name")} placeholder="姓名"/></Field>
          <Field label="Email"><Input value={form.email} onChange={set("email")} placeholder="email（用於提醒）"/></Field>
          <Field label="所屬單位">
            <Select value={form.unit_id} onChange={v => set("unit_id")(v ? +v : null)}
              options={units.map(u => ({ value: u.id, label: u.name }))}/>
          </Field>
          <Field label="年資（年）"><Input type="number" value={form.seniority} onChange={v => set("seniority")(+v)} placeholder="0"/></Field>
          <Field label="工作性質">
            <Select value={form.role_type} onChange={set("role_type")}
              options={["臨床專責", "行政兼任", "研究支援"]}/>
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={saveMember} style={{ flex: 1 }}>{saving ? "儲存中..." : "儲存"}</Btn>
            <Btn variant="secondary" onClick={() => setModal(null)} style={{ flex: 1 }}>取消</Btn>
          </div>
        </Modal>
      )}

      {/* Unit modal */}
      {modal === "unit" && (
        <Modal title={unitForm.id ? "編輯單位" : "新增單位"} onClose={() => setModal(null)}>
          <Field label="單位名稱"><Input value={unitForm.name} onChange={setU("name")} placeholder="例：放腫科"/></Field>
          <Field label="編制人數"><Input type="number" value={unitForm.headcount} onChange={v => setU("headcount")(+v)} placeholder="0"/></Field>
          <Field label="可用人力"><Input type="number" value={unitForm.available} onChange={v => setU("available")(+v)} placeholder="0"/></Field>
          <Field label="備註說明"><Input value={unitForm.note} onChange={setU("note")} placeholder="如：人員外借、值班限制等"/></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={saveUnit} style={{ flex: 1 }}>{saving ? "儲存中..." : "儲存"}</Btn>
            <Btn variant="secondary" onClick={() => setModal(null)} style={{ flex: 1 }}>取消</Btn>
          </div>
        </Modal>
      )}

      <style>{`
        .unit-grid { grid-template-columns: repeat(3, 1fr) !important; }
        @media (max-width: 768px) {
          .unit-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const MemberRow = ({ m, onEdit, onDelete }) => (
  <Card style={{ padding: "16px 20px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
      <Avatar name={m.name} size={44}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, fontFamily: F }}>{m.name}</div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: F }}>{m.role_type} {m.seniority ? `· ${m.seniority}年` : ""}</div>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {[{ v: m.task_count, label: "任務" }, { v: m.completed_count, label: "完成", color: C.accent }, { v: `${Math.round(m.completed_count / Math.max(m.task_count,1) * 100)}%`, label: "完成率", color: C.blue }].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color || C.text, fontFamily: F, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: F }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
    <LoadBar load={m.load}/>
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <Btn variant="secondary" onClick={onEdit} style={{ padding: "5px 14px", fontSize: 13 }}>編輯</Btn>
      <Btn variant="danger" onClick={onDelete} style={{ padding: "5px 14px", fontSize: 13 }}>刪除</Btn>
    </div>
  </Card>
);
