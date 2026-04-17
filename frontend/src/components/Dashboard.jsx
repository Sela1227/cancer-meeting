import { C, F, priorityColor, statusStyle } from "../theme.js";
import { Card, Badge, LoadBar, Avatar, SectionLabel, Btn } from "./UI.jsx";

const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

const DonutChart = ({ tasks }) => {
  const total = tasks.length;
  if (!total) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="60" fill="none" stroke={C.border} strokeWidth="20"/>
        <text x="80" y="86" textAnchor="middle" fontSize="28" fontWeight="900" fill={C.muted} fontFamily={F}>—</text>
      </svg>
      <div style={{ fontSize:13, color:C.muted, fontFamily:F }}>尚無任務</div>
    </div>
  );
  const slices = [
    { label:"完成",   v:tasks.filter(t=>t.status==="完成").length,   color:C.blue },
    { label:"進行中", v:tasks.filter(t=>t.status==="進行中").length, color:C.accentMid },
    { label:"卡關",   v:tasks.filter(t=>t.status==="卡關").length,   color:C.danger },
    { label:"未開始", v:tasks.filter(t=>t.status==="未開始").length, color:C.border },
  ];
  const r=60, cx=80, cy=80, sw=20, circ=2*Math.PI*r;
  let offset=0;
  const pct = Math.round(slices[0].v/total*100);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={sw}/>
        {slices.map((s,i) => {
          const dash=(s.v/total)*circ;
          const el=(
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset}
              style={{ transform:"rotate(-90deg)", transformOrigin:`${cx}px ${cy}px` }}/>
          );
          offset+=dash; return el;
        })}
        <text x={cx} y={cy-8} textAnchor="middle" fontSize="32" fontWeight="900" fill={C.text} fontFamily={F}>{pct}%</text>
        <text x={cx} y={cy+14} textAnchor="middle" fontSize="13" fill={C.muted} fontFamily={F}>整體完成率</text>
      </svg>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 20px", width:"100%" }}>
        {slices.map(s=>(
          <div key={s.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:s.color, flexShrink:0 }}/>
            <span style={{ fontSize:12, color:C.muted, fontFamily:F }}>{s.label}</span>
            <span style={{ fontSize:15, fontWeight:800, color:C.text, fontFamily:F, marginLeft:"auto" }}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const BarChart = ({ monthly }) => {
  if (!monthly?.length) return <div style={{ color:C.muted, fontSize:14, fontFamily:F, padding:"30px 0", textAlign:"center" }}>尚無完成紀錄</div>;
  const max=Math.max(...monthly.map(d=>d.count),1);
  const W=360, H=100, pad=12, n=monthly.length;
  const slot=(W-pad*2)/n, bw=slot*0.6;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H+28}`}>
      {monthly.map((d,i) => {
        const bh=(d.count/max)*H||2, x=pad+i*slot+(slot-bw)/2, y=H-bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} fill={C.accentMid} rx={6} opacity={0.85}/>
            <text x={x+bw/2} y={H+18} textAnchor="middle" fontSize={11} fill={C.muted} fontFamily={F}>{MONTHS[d.month-1]}</text>
            <text x={x+bw/2} y={y-6} textAnchor="middle" fontSize={12} fill={C.text} fontWeight={700} fontFamily={F}>{d.count}</text>
          </g>
        );
      })}
    </svg>
  );
};

const RadialGauge = ({ load, name, available, headcount, overdue, note }) => {
  const color = load>=80 ? C.danger : load>=60 ? C.warn : C.blue;
  const r=28, circ=2*Math.PI*r, dash=(load/100)*circ;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8,
      background:C.cardAlt, borderRadius:14, padding:"16px 8px", overflow:"visible" }}>
      <svg width="76" height="76" viewBox="-4 -4 80 80" style={{ overflow:"visible" }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke={C.border} strokeWidth="8"/>
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
          style={{ transform:"rotate(-90deg)", transformOrigin:"36px 36px" }}/>
        <text x="36" y="40" textAnchor="middle" fontSize={13} fontWeight={900} fill={color} fontFamily={F}>{load}%</text>
      </svg>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:15, fontWeight:800, color:C.text, fontFamily:F }}>{name}</div>
        <div style={{ fontSize:11, color:available<=1?C.danger:C.muted, fontFamily:F, marginTop:2 }}>
          可用 {available}/{headcount} 人
        </div>
        {overdue>0 && <div style={{ fontSize:11, color:C.danger, fontFamily:F }}>{overdue} 件逾期</div>}
        {note && <div style={{ fontSize:10, color:C.warn, fontFamily:F, marginTop:2, lineHeight:1.3 }}>{note}</div>}
      </div>
    </div>
  );
};

const StatBox = ({ label, value, color, sub }) => (
  <div style={{ background:C.cardAlt, borderRadius:14, padding:"18px 16px 18px 20px", position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", left:0, top:0, bottom:0, width:4, background:color }}/>
    <div style={{ fontSize:11, color:C.muted, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:F, marginBottom:8 }}>{label}</div>
    <div style={{ fontSize:48, fontWeight:900, color, lineHeight:1, fontFamily:F }}>{value}</div>
    {sub && <div style={{ fontSize:12, color:C.muted, marginTop:6, fontFamily:F }}>{sub}</div>}
  </div>
);

const TaskRow = ({ task }) => {
  const pc = priorityColor[task.priority]||C.muted;
  const s = statusStyle(task.status, task.overdue);
  const waiting = task.depends_on_id && !task.depends_on_done;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px",
      background:C.cardAlt, borderRadius:12, marginBottom:8, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:4, background:waiting?C.warn:pc, borderRadius:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:16, fontWeight:700, color:C.text, fontFamily:F,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</div>
        <div style={{ fontSize:12, color:C.muted, fontFamily:F, marginTop:3 }}>
          {task.owner_name||"未指定"} · {task.unit_name||""} · {task.due_date||"無截止日"}
        </div>
        {waiting && (
          <div style={{ fontSize:11, color:C.warn, fontFamily:F, marginTop:2 }}>
            ⏳ 等待：{task.depends_on_title}
          </div>
        )}
      </div>
      <Badge status={task.status} overdue={task.overdue}/>
    </div>
  );
};

const downloadReport = async () => {
  try {
    const res = await fetch("/api/report/weekly");
    if (!res.ok) throw new Error("產生失敗");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `癌症醫院週報_${today}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch(e) {
    alert("週報產生失敗：" + e.message);
  }
};

export default function Dashboard({ stats, tasks, unitLoads, members, monthly, setTab }) {
  const overdue = tasks.filter(t=>t.overdue);
  const todayStr = new Date().toLocaleDateString('zh-TW', { year:'numeric', month:'long', day:'numeric', weekday:'long' });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* 日期 + 週報按鈕 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.muted, fontFamily:F }}>{todayStr}</div>
        <button onClick={downloadReport} style={{
          display:"flex", alignItems:"center", gap:8,
          background:C.accent, color:"#fff", border:"none",
          padding:"10px 20px", borderRadius:10, fontSize:14,
          fontWeight:700, fontFamily:F, cursor:"pointer",
          boxShadow:`0 4px 12px ${C.accent}44`, transition:"opacity 0.15s",
        }}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1v9M5 7l3 3 3-3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          下載週報 PDF
        </button>
      </div>

      {/* 逾期警示 */}
      {overdue.length>0 && (
        <div style={{ background:C.dangerLight, border:`2px solid ${C.danger}40`,
          borderRadius:14, padding:"16px 24px", display:"flex", alignItems:"center", gap:14 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="10" stroke={C.danger} strokeWidth="2"/>
            <rect x="10" y="6" width="2" height="6" fill={C.danger} rx="1"/>
            <rect x="10" y="14" width="2" height="2" fill={C.danger} rx="1"/>
          </svg>
          <span style={{ fontSize:15, color:C.danger, fontWeight:700, fontFamily:F }}>
            {overdue.length} 項任務逾期未完成，Email 提醒已自動發送
          </span>
        </div>
      )}

      {/* 第一排：環形 + 指標 + 趨勢 */}
      <div style={{ display:"grid", gridTemplateColumns:"260px 1fr 1fr", gap:16 }} className="r1">
        <Card style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
          <SectionLabel>任務狀態分布</SectionLabel>
          <DonutChart tasks={tasks}/>
        </Card>

        <Card>
          <SectionLabel>本月指標</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <StatBox label="總任務"   value={stats?.total||0}       color={C.accentMid} sub="本月會議產生"/>
            <StatBox label="進行中"   value={stats?.in_progress||0} color={C.warn}      sub="執行中"/>
            <StatBox label="逾期未結" value={stats?.overdue||0}     color={C.danger}    sub="需立即處理"/>
            <StatBox label="已完成"   value={stats?.completed||0}   color={C.blue}      sub={`完成率 ${stats?.completion_rate||0}%`}/>
          </div>
        </Card>

        <Card>
          <SectionLabel>每月完成趨勢</SectionLabel>
          <BarChart monthly={monthly}/>
          {monthly?.length>0 && (
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:10 }}>
              <div style={{ fontSize:12, color:C.muted, fontFamily:F }}>近{monthly.length}個月平均</div>
              <div style={{ fontSize:16, fontWeight:900, color:C.accentMid, fontFamily:F }}>
                {Math.round(monthly.reduce((a,d)=>a+d.count,0)/monthly.length)} 件/月
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 第二排：單位負荷 + 個人排行 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }} className="r2">
        <Card>
          <SectionLabel>單位負荷概況</SectionLabel>
          {unitLoads.length===0
            ? <div style={{ color:C.muted, fontSize:14, fontFamily:F, padding:"20px 0", textAlign:"center" }}>尚無單位資料</div>
            : <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {unitLoads.map((u,i)=>(
                  <RadialGauge key={i} load={u.load} name={u.name}
                    available={u.available} headcount={u.headcount}
                    overdue={u.overdue} note={u.note}/>
                ))}
              </div>
          }
        </Card>

        <Card>
          <SectionLabel>個人負荷排行（前10）</SectionLabel>
          {members.length===0
            ? <div style={{ color:C.muted, fontSize:14, fontFamily:F, padding:"20px 0", textAlign:"center" }}>尚無人員資料</div>
            : [...members].sort((a,b)=>b.load-a.load).slice(0,10).map((m,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <span style={{ fontSize:15, fontWeight:900, color:C.border, width:20, fontFamily:F, textAlign:"center" }}>{i+1}</span>
                  <Avatar name={m.name} size={34}/>
                  <div style={{ width:80, flexShrink:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:C.text, fontFamily:F }}>{m.name}</div>
                    <div style={{ fontSize:11, color:C.muted, fontFamily:F }}>{m.unit_name}</div>
                  </div>
                  <div style={{ flex:1 }}><LoadBar load={m.load}/></div>
                  <span style={{ fontSize:13, color:C.muted, width:32, textAlign:"right", fontFamily:F }}>{m.task_count}件</span>
                </div>
              ))
          }
        </Card>
      </div>

      {/* 第三排：近期任務 */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <SectionLabel>近期任務</SectionLabel>
          <Btn variant="secondary" onClick={()=>setTab("tasks")} style={{ padding:"6px 16px", fontSize:13 }}>全部查看</Btn>
        </div>
        {tasks.length===0
          ? <div style={{ color:C.muted, fontSize:14, fontFamily:F, padding:"20px 0", textAlign:"center" }}>尚無任務，請至「任務管理」新增</div>
          : tasks.slice(0,4).map(t=><TaskRow key={t.id} task={t}/>)
        }
      </Card>

      <style>{`
        @media (max-width:960px) { .r1 { grid-template-columns:1fr !important; } }
        @media (max-width:760px) { .r2 { grid-template-columns:1fr !important; } }
      `}</style>
    </div>
  );
}
