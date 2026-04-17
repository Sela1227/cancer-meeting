import { useState } from "react";
import { api } from "../api.js";
import { C, F, statusStyle } from "../theme.js";
import { Card, Btn } from "./UI.jsx";

const DAYS   = ["日","一","二","三","四","五","六"];
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// 未來預定會議日（從會議通知取得）
const FUTURE_MEETINGS = [
  { date:"2026-05-22", label:"第3次" },
  { date:"2026-07-24", label:"第4次" },
  { date:"2026-10-02", label:"第5次" },
  { date:"2026-11-27", label:"第6次" },
];

export default function Calendar({ tasks, meetings, reload }) {
  const today = new Date();
  const [year,  setYear]    = useState(today.getFullYear());
  const [month, setMonth]   = useState(today.getMonth());
  const [selected, setSelected] = useState(null);
  const [meetModal, setMeetModal] = useState(false);
  const [meetForm, setMeetForm]   = useState({});
  const [saving, setSaving]         = useState(false);
  const [detail, setDetail]         = useState(null);   // 選中的會議詳情
  const [detailLoading, setDetailLoading] = useState(false);
  const [agendaModal, setAgendaModal] = useState(false);
  const [agendaForm, setAgendaForm]   = useState({});
  const [agendaSaving, setAgendaSaving] = useState(false);

  const loadDetail = async (mid) => {
    setDetailLoading(true);
    try { setDetail(await api.meetingDetail(mid)); }
    finally { setDetailLoading(false); }
  };

  const saveAgenda = async () => {
    setAgendaSaving(true);
    try {
      if (agendaForm.id) await api.updateAgenda(agendaForm.id, agendaForm);
      else               await api.createAgenda(agendaForm);
      if (detail) await loadDetail(detail.id);
      setAgendaModal(false); setAgendaForm({});
    } finally { setAgendaSaving(false); }
  };

  const delAgenda = async (id) => {
    if (!window.confirm("確定刪除此議題？")) return;
    await api.deleteAgenda(id);
    if (detail) loadDetail(detail.id);
  };
  const [tab, setTab]             = useState("calendar"); // calendar | meetings

  const prev = () => { if (month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); setSelected(null); };
  const next = () => { if (month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); setSelected(null); };

  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();

  const tasksForDay = day => {
    const d = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return tasks.filter(t=>t.due_date===d);
  };

  const futureMeetingForDay = day => {
    const d = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return FUTURE_MEETINGS.find(m=>m.date===d);
  };

  const pastMeetingForDay = day => {
    const d = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return meetings.find(m=>m.date===d);
  };

  const saveMeeting = async () => {
    setSaving(true);
    try {
      if (meetForm.id) await api.updateMeeting(meetForm.id, meetForm);
      else             await api.createMeeting(meetForm);
      await reload(); setMeetModal(false); setMeetForm({});
    } finally { setSaving(false); }
  };

  const delMeeting = async (id) => {
    if (!window.confirm("確定刪除此會議？相關任務不受影響。")) return;
    await api.deleteMeeting(id); reload();
  };

  const setF = k => v => setMeetForm(f=>({...f,[k]:v}));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Tab 切換 */}
      <div style={{ display:"flex", gap:8 }}>
        {[{id:"calendar",label:"月曆"},{id:"meetings",label:"會議管理"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"8px 20px", borderRadius:10, border:"none", cursor:"pointer",
            fontFamily:F, fontSize:14, fontWeight:tab===t.id?800:500,
            background:tab===t.id?C.accent:C.card,
            color:tab===t.id?"#fff":C.muted,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── 月曆視圖 ── */}
      {tab==="calendar" && (
        <Card style={{ padding:"20px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <button onClick={prev} style={{ background:"none", border:`1px solid ${C.border}`,
              borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:18, color:C.muted }}>‹</button>
            <div style={{ fontSize:20, fontWeight:900, color:C.text, fontFamily:F }}>{year} 年 {MONTHS[month]}</div>
            <button onClick={next} style={{ background:"none", border:`1px solid ${C.border}`,
              borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:18, color:C.muted }}>›</button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:4 }}>
            {DAYS.map(d=>(
              <div key={d} style={{ textAlign:"center", fontSize:12, fontWeight:700, color:C.muted, paddingBottom:6, fontFamily:F }}>{d}</div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
            {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
            {Array.from({length:daysInMonth},(_,i)=>{
              const day = i+1;
              const isToday    = day===today.getDate() && month===today.getMonth() && year===today.getFullYear();
              const dayTasks   = tasksForDay(day);
              const futureMeet = futureMeetingForDay(day);
              const pastMeet   = pastMeetingForDay(day);
              const isSelected = selected?.day===day;

              return (
                <div key={day}
                  onClick={()=>(dayTasks.length>0||futureMeet||pastMeet) && setSelected(isSelected?null:{day, tasks:dayTasks, futureMeet, pastMeet})}
                  style={{
                    background:isToday?C.accent:isSelected?C.accentLight:C.bg,
                    borderRadius:10, padding:"6px 4px", minHeight:52,
                    border:isSelected?`2px solid ${C.accent}`:isToday?"none":`1px solid ${C.border}`,
                    cursor:(dayTasks.length>0||futureMeet||pastMeet)?"pointer":"default",
                    position:"relative",
                  }}>
                  <div style={{ fontSize:14, fontWeight:isToday?900:500,
                    color:isToday?"#fff":C.text, marginBottom:3, textAlign:"center", fontFamily:F }}>{day}</div>
                  {/* 未來會議標記 */}
                  {futureMeet && (
                    <div style={{ fontSize:9, fontWeight:800, background:"#4A6741", color:"#fff",
                      borderRadius:4, padding:"1px 3px", textAlign:"center", marginBottom:2, fontFamily:F }}>
                      {futureMeet.label}
                    </div>
                  )}
                  {/* 過去會議標記 */}
                  {pastMeet && !futureMeet && (
                    <div style={{ fontSize:9, fontWeight:800,
                      background:isToday?"rgba(255,255,255,0.3)":C.accentMid+"33",
                      color:isToday?"#fff":C.accentMid,
                      borderRadius:4, padding:"1px 3px", textAlign:"center", marginBottom:2, fontFamily:F }}>
                      會議
                    </div>
                  )}
                  {/* 任務標籤（桌機）*/}
                  <div className="cal-labels">
                    {dayTasks.slice(0,2).map((t,j)=>{
                      const s = statusStyle(t.status, t.overdue);
                      return (
                        <div key={j} style={{
                          fontSize:9, fontWeight:700, fontFamily:F,
                          background:isToday?"rgba(255,255,255,0.25)":s.bg,
                          color:isToday?"#fff":s.color,
                          padding:"1px 4px", borderRadius:4, marginBottom:2,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        }}>{t.title}</div>
                      );
                    })}
                    {dayTasks.length>2 && <div style={{ fontSize:9, color:C.muted, fontFamily:F }}>+{dayTasks.length-2}</div>}
                  </div>
                  {/* 圓點（手機）*/}
                  {dayTasks.length>0 && (
                    <div className="cal-dots" style={{ display:"flex", justifyContent:"center", gap:2, marginTop:2 }}>
                      {dayTasks.slice(0,3).map((t,j)=>{
                        const s = statusStyle(t.status, t.overdue);
                        return <div key={j} style={{ width:5, height:5, borderRadius:"50%", background:isToday?"rgba(255,255,255,0.8)":s.color }}/>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 圖例 */}
          <div style={{ display:"flex", gap:14, marginTop:16, flexWrap:"wrap", alignItems:"center" }}>
            {[{label:"完成",color:C.blue},{label:"進行中",color:C.accentMid},{label:"逾期/卡關",color:C.danger}].map(l=>(
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:l.color }}/>
                <span style={{ fontSize:11, color:C.muted, fontFamily:F }}>{l.label}</span>
              </div>
            ))}
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:"#4A6741" }}/>
              <span style={{ fontSize:11, color:C.muted, fontFamily:F }}>預定會議</span>
            </div>
            <span style={{ fontSize:11, color:C.muted, fontFamily:F, marginLeft:"auto" }}>手機版點日期查看</span>
          </div>
        </Card>
      )}

      {/* 點選日期後展開 */}
      {tab==="calendar" && selected && (
        <Card style={{ padding:"16px 20px" }}>
          <div style={{ fontSize:15, fontWeight:800, color:C.text, fontFamily:F, marginBottom:12 }}>
            {month+1}/{selected.day}
          </div>
          {selected.futureMeet && (
            <div style={{ background:"#4A674122", borderRadius:10, padding:"10px 14px", marginBottom:8,
              borderLeft:"4px solid #4A6741" }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#4A6741", fontFamily:F }}>
                癌症醫院會議 2026年{selected.futureMeet.label}（預定）
              </div>
              <div style={{ fontSize:12, color:C.muted, fontFamily:F, marginTop:2 }}>12:30–13:30 彰秀南平大樓9F第一會議室</div>
            </div>
          )}
          {selected.pastMeet && (
            <div style={{ background:C.cardAlt, borderRadius:10, padding:"10px 14px", marginBottom:8,
              borderLeft:`4px solid ${C.accentMid}` }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, fontFamily:F }}>{selected.pastMeet.title}</div>
              <div style={{ fontSize:12, color:C.muted, fontFamily:F, marginTop:2 }}>第{selected.pastMeet.session_no}次會議</div>
            </div>
          )}
          {selected.tasks.map((t,i)=>{
            const s = statusStyle(t.status, t.overdue);
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                padding:"10px 14px", background:C.bg, borderRadius:10, marginBottom:8,
                borderLeft:`4px solid ${s.color}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text, fontFamily:F }}>{t.title}</div>
                  <div style={{ fontSize:12, color:C.muted, fontFamily:F, marginTop:2 }}>
                    {t.owner_name||"—"} · {t.unit_name||"—"}
                  </div>
                </div>
                <span style={{ background:s.bg, color:s.color, padding:"4px 10px",
                  borderRadius:999, fontSize:12, fontWeight:700, fontFamily:F }}>{s.label}</span>
              </div>
            );
          })}
        </Card>
      )}

      {/* ── 會議管理 ── */}
      {tab==="meetings" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:18, fontWeight:800, color:C.text, fontFamily:F }}>歷次會議</div>
            <Btn onClick={()=>{ setMeetForm({}); setMeetModal(true); }}>新增會議</Btn>
          </div>

          {meetings.length===0
            ? <Card><div style={{ color:C.muted, fontSize:14, fontFamily:F, padding:"20px", textAlign:"center" }}>尚無會議資料</div></Card>
            : [...meetings].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((m,i)=>(
              <Card key={i} style={{ padding:"18px 20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
                  <div style={{ cursor:"pointer" }} onClick={()=>detail?.id===m.id?setDetail(null):loadDetail(m.id)}>
                    <div style={{ fontSize:17, fontWeight:800, color:C.text, fontFamily:F }}>{m.title}</div>
                    <div style={{ fontSize:13, color:C.muted, fontFamily:F, marginTop:3 }}>
                      第{m.session_no}次 · {m.date}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn variant="secondary" onClick={()=>detail?.id===m.id?setDetail(null):loadDetail(m.id)}
                      style={{ padding:"6px 14px", fontSize:13 }}>
                      {detail?.id===m.id?"收起":"查看決議"}
                    </Btn>
                    <Btn variant="secondary" onClick={()=>{ setMeetForm({...m}); setMeetModal(true); }} style={{ padding:"6px 14px", fontSize:13 }}>編輯</Btn>
                    <Btn variant="danger"    onClick={()=>delMeeting(m.id)} style={{ padding:"6px 14px", fontSize:13 }}>刪除</Btn>
                  </div>
                </div>

                {/* 展開：議程 + 任務決議 */}
                {detail?.id===m.id && (
                  <div style={{ marginTop:16, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
                    {detailLoading
                      ? <div style={{ color:C.muted, fontSize:13, fontFamily:F }}>載入中...</div>
                      : <>
                        {/* 統計數字 */}
                        <div style={{ display:"flex", gap:16, marginBottom:14, flexWrap:"wrap" }}>
                          {[
                            {label:"任務總數", v:detail.task_count, color:C.text},
                            {label:"已完成",   v:detail.done_count,   color:C.blue},
                            {label:"逾期",     v:detail.overdue_count, color:C.danger},
                            {label:"完成率",   v:`${detail.completion_rate}%`, color:detail.completion_rate>=60?C.blue:C.warn},
                          ].map(s=>(
                            <div key={s.label} style={{ background:C.cardAlt, borderRadius:10, padding:"10px 16px", textAlign:"center" }}>
                              <div style={{ fontSize:22, fontWeight:900, color:s.color, fontFamily:F }}>{s.v}</div>
                              <div style={{ fontSize:11, color:C.muted, fontFamily:F }}>{s.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* 議程 */}
                        <div style={{ marginBottom:14 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:C.accentMid, fontFamily:F }}>議程</div>
                            <button onClick={()=>{ setAgendaForm({meeting_id:m.id,order_no:(detail.agendas?.length||0)+1,title:"",note:""}); setAgendaModal(true); }}
                              style={{ background:"none", border:`1px solid ${C.accent}`, borderRadius:6, padding:"3px 10px",
                                fontSize:12, cursor:"pointer", color:C.accent, fontFamily:F }}>+ 新增議題</button>
                          </div>
                          {detail.agendas?.length===0
                            ? <div style={{ fontSize:12, color:C.muted, fontFamily:F }}>尚無議題</div>
                            : detail.agendas.map((a,j)=>(
                              <div key={j} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                                background:C.bg, borderRadius:8, marginBottom:6 }}>
                                <div style={{ fontSize:13, fontWeight:700, color:C.accentMid, fontFamily:F, width:24 }}>
                                  {a.order_no}.
                                </div>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:14, fontWeight:600, color:C.text, fontFamily:F }}>{a.title}</div>
                                  {a.note && <div style={{ fontSize:12, color:C.muted, fontFamily:F }}>{a.note}</div>}
                                </div>
                                <div style={{ display:"flex", gap:4 }}>
                                  <button onClick={()=>{ setAgendaForm({...a,meeting_id:m.id}); setAgendaModal(true); }}
                                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:5, padding:"3px 8px", fontSize:11, cursor:"pointer", color:C.muted, fontFamily:F }}>編輯</button>
                                  <button onClick={()=>delAgenda(a.id)}
                                    style={{ background:"none", border:`1px solid ${C.dangerLight}`, borderRadius:5, padding:"3px 8px", fontSize:11, cursor:"pointer", color:C.danger, fontFamily:F }}>刪</button>
                                </div>
                              </div>
                            ))
                          }
                        </div>

                        {/* 任務決議 */}
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:C.accentMid, fontFamily:F, marginBottom:8 }}>任務決議</div>
                          {detail.tasks?.length===0
                            ? <div style={{ fontSize:12, color:C.muted, fontFamily:F }}>尚無任務</div>
                            : detail.tasks.map((t,j)=>{
                              const overdue = t.overdue;
                              const sc = overdue ? C.danger : t.status==="完成" ? C.blue : t.status==="卡關" ? C.warn : C.muted;
                              const bg = overdue ? C.dangerLight : t.status==="完成" ? C.blueLight : C.bg;
                              return (
                                <div key={j} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                                  background:bg, borderRadius:8, marginBottom:5,
                                  borderLeft:`3px solid ${sc}` }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:13, fontWeight:600, color:C.text, fontFamily:F }}>{t.title}</div>
                                    <div style={{ fontSize:11, color:C.muted, fontFamily:F, marginTop:1 }}>
                                      {t.owner_name||"—"} · {t.unit_name||"—"} · {t.due_date||"無截止日"}
                                    </div>
                                    {t.progress_pct>0 && (
                                      <div style={{ fontSize:11, color:C.accentMid, fontFamily:F }}>
                                        進度 {t.progress_pct}%{t.progress_note?` · ${t.progress_note}`:""}
                                      </div>
                                    )}
                                  </div>
                                  <span style={{ fontSize:12, fontWeight:700, color:sc, fontFamily:F }}>
                                    {overdue?"逾期":t.status}
                                  </span>
                                </div>
                              );
                            })
                          }
                        </div>
                      </>
                    }
                  </div>
                )}
              </Card>
            ))
          }

          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.muted, fontFamily:F, marginBottom:10 }}>預定未來會議</div>
            {FUTURE_MEETINGS.map((m,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                background:C.cardAlt, borderRadius:12, marginBottom:8,
                borderLeft:`4px solid #4A6741` }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:"#4A6741", flexShrink:0 }}/>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text, fontFamily:F }}>
                    癌症醫院會議 2026年{m.label}
                  </div>
                  <div style={{ fontSize:12, color:C.muted, fontFamily:F }}>{m.date} · 12:30–13:30</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 會議編輯 Modal */}
      {meetModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:300,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.card, borderRadius:16, padding:28, width:"100%", maxWidth:440,
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
              <div style={{ fontSize:20, fontWeight:900, fontFamily:F, color:C.text }}>
                {meetForm.id?"編輯會議":"新增會議"}
              </div>
              <button onClick={()=>setMeetModal(false)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.muted }}>×</button>
            </div>
            {[
              {label:"會議名稱", key:"title",      type:"text",   placeholder:"例：癌症醫院會議 2026年第3次"},
              {label:"次序",     key:"session_no", type:"number", placeholder:"3"},
              {label:"會議日期", key:"date",        type:"date",   placeholder:""},
            ].map(({label,key,type,placeholder})=>(
              <div key={key} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:6, fontFamily:F }}>{label}</div>
                <input type={type} value={meetForm[key]||""} onChange={e=>setF(key)(type==="number"?+e.target.value:e.target.value)}
                  placeholder={placeholder}
                  style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:`1px solid ${C.border}`,
                    fontSize:15, fontFamily:F, boxSizing:"border-box", background:C.card, color:C.text }}/>
              </div>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <Btn onClick={saveMeeting} style={{ flex:1 }}>{saving?"儲存中...":"儲存"}</Btn>
              <Btn variant="secondary" onClick={()=>setMeetModal(false)} style={{ flex:1 }}>取消</Btn>
            </div>
          </div>
        </div>
      )}
      {/* 議題編輯 Modal */}
      {agendaModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:310,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.card, borderRadius:16, padding:28, width:"100%", maxWidth:420,
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:900, fontFamily:F, color:C.text }}>
                {agendaForm.id?"編輯議題":"新增議題"}
              </div>
              <button onClick={()=>setAgendaModal(false)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.muted }}>×</button>
            </div>
            {[
              {label:"議題名稱",key:"title",    type:"text",  placeholder:"例：彰化兩院癌症新診斷人數檢視"},
              {label:"順序",    key:"order_no", type:"number",placeholder:"1"},
              {label:"備註說明",key:"note",     type:"text",  placeholder:"（選填）"},
            ].map(({label,key,type,placeholder})=>(
              <div key={key} style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:6, fontFamily:F }}>{label}</div>
                <input type={type} value={agendaForm[key]||""} onChange={e=>setAgendaForm(f=>({...f,[key]:type==="number"?+e.target.value:e.target.value}))}
                  placeholder={placeholder}
                  style={{ width:"100%", padding:"10px 14px", borderRadius:8, border:`1px solid ${C.border}`,
                    fontSize:14, fontFamily:F, boxSizing:"border-box", background:C.card, color:C.text }}/>
              </div>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <Btn onClick={saveAgenda} style={{ flex:1 }}>{agendaSaving?"儲存中...":"儲存"}</Btn>
              <Btn variant="secondary" onClick={()=>setAgendaModal(false)} style={{ flex:1 }}>取消</Btn>
            </div>
          </div>
        </div>
      )}


      <style>{`
        .cal-labels { display: block; }
        .cal-dots   { display: none !important; }
        @media (max-width: 600px) {
          .cal-labels { display: none !important; }
          .cal-dots   { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
