import { useState } from "react";
import { C, F } from "../theme.js";
import { Card, SectionLabel, Avatar, LoadBar } from "./UI.jsx";

// ── 小工具 ───────────────────────────────────────────────────────────────────

const BarH = ({ label, value, max, color, right }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const barW = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: C.text, fontFamily: F, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: C.muted, fontFamily: F }}>{right || `${value} 件`}</span>
      </div>
      <div style={{ height: 8, background: C.border, borderRadius: 4 }}>
        <div style={{ width: `${barW}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s" }} />
      </div>
    </div>
  );
};

const Ring = ({ pct, color, size = 80, label, value }) => {
  const r = size * 0.38, circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  const pad = 6;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size + pad * 2} height={size + pad * 2}
        viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`}
        style={{ overflow: "visible" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={size * 0.12} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.12}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }} />
        <text x={size / 2} y={size / 2 + size * 0.08} textAnchor="middle"
          fontSize={size * 0.22} fontWeight="900" fill={color} fontFamily={F}>{pct}%</text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: F }}>{label}</div>
        {value !== undefined && <div style={{ fontSize: 11, color: C.muted, fontFamily: F }}>{value}</div>}
      </div>
    </div>
  );
};

const StatNum = ({ value, label, color }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 32, fontWeight: 900, color: color || C.text, lineHeight: 1, fontFamily: F }}>{value}</div>
    <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: F }}>{label}</div>
  </div>
);

// ── 主元件 ───────────────────────────────────────────────────────────────────

export default function Stats({ tasks, members, meetings, unitLoads, monthly }) {
  const [view, setView]       = useState("meeting");
  const [range, setRange]     = useState("all");   // all | year | quarter | month | custom
  const [customYear, setCustomYear] = useState(new Date().getFullYear());

  const tabs = [
    { id: "meeting", label: "會議效能" },
    { id: "person",  label: "個人貢獻" },
    { id: "unit",    label: "單位效率" },
  ];

  const rangeBtns = [
    { id: "all",     label: "全部" },
    { id: "year",    label: "本年" },
    { id: "quarter", label: "本季" },
    { id: "month",   label: "本月" },
    { id: "custom",  label: "指定年" },
  ];

  // Filter tasks by time range based on created_at
  const now  = new Date();
  const yr   = now.getFullYear();
  const mo   = now.getMonth();
  const qStart = Math.floor(mo / 3) * 3;

  const filteredTasks = tasks.filter(t => {
    if (range === "all") return true;
    const d = t.created_at ? new Date(t.created_at) : null;
    if (!d) return range === "all";
    if (range === "year")    return d.getFullYear() === yr;
    if (range === "quarter") return d.getFullYear() === yr && d.getMonth() >= qStart && d.getMonth() < qStart+3;
    if (range === "month")   return d.getFullYear() === yr && d.getMonth() === mo;
    if (range === "custom")  return d.getFullYear() === customYear;
    return true;
  });

  const currentYear = yr;
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 頁面說明 + 雙列控制 */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text, fontFamily: F }}>深度統計分析</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: F, marginTop: 2 }}>
              從會議效能、個人貢獻、單位效率三個維度評估執行力
            </div>
          </div>
          {/* 維度 tab */}
          <div style={{ display: "flex", background: C.cardAlt, borderRadius: 12, padding: 4, gap: 2 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setView(t.id)} style={{
                background: view === t.id ? C.accent : "none",
                color: view === t.id ? "#fff" : C.muted,
                border: "none", cursor: "pointer",
                padding: "8px 14px", borderRadius: 9,
                fontSize: 14, fontWeight: view === t.id ? 800 : 500, fontFamily: F,
                transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* 時間區間列 */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:12, color:C.muted, fontFamily:F, fontWeight:600 }}>時間區間：</span>
          {rangeBtns.map(b => (
            <button key={b.id} onClick={()=>setRange(b.id)} style={{
              padding:"6px 14px", borderRadius:20, border:"none", cursor:"pointer",
              fontSize:13, fontWeight:range===b.id?800:500, fontFamily:F,
              background:range===b.id ? C.accentMid : C.cardAlt,
              color:range===b.id ? "#fff" : C.muted,
              transition:"all 0.15s",
            }}>{b.label}</button>
          ))}
          {range === "custom" && (
            <select value={customYear} onChange={e=>setCustomYear(+e.target.value)} style={{
              padding:"6px 12px", borderRadius:8, border:`1px solid ${C.border}`,
              fontSize:13, fontFamily:F, background:C.card, color:C.text,
            }}>
              {yearOptions.map(y=><option key={y} value={y}>{y} 年</option>)}
            </select>
          )}
          <span style={{ fontSize:11, color:C.muted, fontFamily:F, marginLeft:4 }}>
            共 {filteredTasks.length} 件任務
          </span>
        </div>
      </div>

      {/* ── 會議效能 ── */}
      {view === "meeting" && <MeetingStats tasks={filteredTasks} meetings={meetings} monthly={monthly} range={range} />}

      {/* ── 個人貢獻 ── */}
      {view === "person" && <PersonStats tasks={filteredTasks} members={members} />}

      {/* ── 單位效率 ── */}
      {view === "unit" && <UnitStats tasks={filteredTasks} unitLoads={unitLoads} />}

      <style>{`
        @media (max-width: 768px) {
          .stats-nums   { grid-template-columns: repeat(2,1fr) !important; }
          .person-ranks { grid-template-columns: 1fr !important; }
          .person-grid  { grid-template-columns: 1fr !important; }
          .unit-compare { grid-template-columns: 1fr !important; }
          .stats-table  { font-size: 11px !important; }
          .stats-table th, .stats-table td { padding: 5px 6px !important; }
        }
      `}</style>
    </div>
  );
}

// ── 會議效能 ──────────────────────────────────────────────────────────────────
function MeetingStats({ tasks, meetings, monthly }) {
  const meetingStats = meetings.map(m => {
    const mt = tasks.filter(t => t.meeting_id === m.id);
    const done     = mt.filter(t => t.status === "完成").length;
    const inprog   = mt.filter(t => t.status === "進行中").length;
    const blocked  = mt.filter(t => t.status === "卡關").length;
    const overdue  = mt.filter(t => t.overdue).length;
    const notStart = mt.filter(t => t.status === "未開始").length;
    const rate     = mt.length > 0 ? Math.round(done / mt.length * 100) : 0;
    return { ...m, total: mt.length, done, inprog, blocked, overdue, notStart, rate };
  });

  const totalTasks   = tasks.length;
  const totalDone    = tasks.filter(t => t.status === "完成").length;
  const overallRate  = totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0;
  const maxTotal     = Math.max(...meetingStats.map(m => m.total), 1);

  const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* 整體完成率 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }} className="stats-nums">
        {[
          { label: "累積任務", v: totalTasks, color: C.accentMid, sub: "所有會議合計" },
          { label: "已完成",   v: totalDone,  color: C.blue,      sub: `完成率 ${overallRate}%` },
          { label: "會議次數", v: meetings.length, color: C.accentMid, sub: "共舉辦會議" },
          { label: "每次平均", v: meetings.length > 0 ? Math.round(totalTasks / meetings.length) : 0,
            color: C.warn, sub: "任務件數/次" },
        ].map(s => (
          <Card key={s.label} style={{ padding: "20px 16px" }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", fontFamily: F, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: s.color, lineHeight: 1, fontFamily: F }}>{s.v}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontFamily: F }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* 每次會議效能卡片 */}
      <SectionLabel>各次會議任務執行成效</SectionLabel>
      {meetingStats.length === 0
        ? <Card><div style={{ color: C.muted, fontSize: 14, fontFamily: F, padding: "20px", textAlign: "center" }}>尚無會議資料</div></Card>
        : meetingStats.map((m, i) => (
          <Card key={i} style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text, fontFamily: F }}>{m.title}</div>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: F, marginTop: 2 }}>
                  {m.date} · 共 {m.total} 件任務
                </div>
              </div>
              <Ring pct={m.rate} color={m.rate >= 60 ? C.blue : m.rate >= 30 ? C.warn : C.danger}
                size={72} label="完成率" />
            </div>

            {/* 任務狀態橫條 */}
            {m.total > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", gap: 1 }}>
                  {[
                    { v: m.done,     color: C.blue },
                    { v: m.inprog,   color: C.accentMid },
                    { v: m.blocked,  color: C.warn },
                    { v: m.overdue,  color: C.danger },
                    { v: m.notStart, color: C.border },
                  ].filter(s => s.v > 0).map((s, j) => (
                    <div key={j} style={{
                      flex: s.v, background: s.color, minWidth: 2,
                      transition: "flex 0.5s",
                    }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "完成",   v: m.done,     color: C.blue },
                    { label: "進行中", v: m.inprog,   color: C.accentMid },
                    { label: "卡關",   v: m.blocked,  color: C.warn },
                    { label: "逾期",   v: m.overdue,  color: C.danger },
                    { label: "未開始", v: m.notStart, color: C.muted },
                  ].map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                      <span style={{ fontSize: 12, color: C.muted, fontFamily: F }}>{s.label} {s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))
      }

      {/* 月趨勢 */}
      {monthly?.length > 0 && (
        <Card>
          <SectionLabel>每月完成趨勢</SectionLabel>
          {(() => {
            const W = 500, H = 110, pad = 16, n = monthly.length;
            const max = Math.max(...monthly.map(d => d.count), 1);
            const slot = (W - pad * 2) / n, bw = slot * 0.6;
            return (
              <svg width="100%" viewBox={`0 0 ${W} ${H + 28}`}>
                {monthly.map((d, i) => {
                  const bh = (d.count / max) * H || 2, x = pad + i * slot + (slot - bw) / 2, y = H - bh;
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width={bw} height={bh} fill={C.accentMid} rx={5} opacity={0.88} />
                      <text x={x + bw / 2} y={H + 18} textAnchor="middle" fontSize={11} fill={C.muted} fontFamily={F}>
                        {["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"][d.month - 1]}
                      </text>
                      <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize={12} fill={C.text} fontWeight={700} fontFamily={F}>{d.count}</text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
        </Card>
      )}
    </div>
  );
}

// ── 個人貢獻 ──────────────────────────────────────────────────────────────────
function PersonStats({ tasks, members }) {
  const memberData = [...members].map(m => {
    const myTasks   = tasks.filter(t => t.owner_id === m.id);
    const done      = myTasks.filter(t => t.status === "完成").length;
    const overdue   = myTasks.filter(t => t.overdue).length;
    const high      = myTasks.filter(t => t.priority === "高").length;
    const rate      = myTasks.length > 0 ? Math.round(done / myTasks.length * 100) : 0;
    const overdueR  = myTasks.length > 0 ? Math.round(overdue / myTasks.length * 100) : 0;
    return { ...m, myTotal: myTasks.length, done, overdue, high, rate, overdueR };
  }).sort((a, b) => b.done - a.done);

  const maxDone  = Math.max(...memberData.map(m => m.done), 1);
  const maxTotal = Math.max(...memberData.map(m => m.myTotal), 1);

  const MEDAL = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="person-ranks">

        {/* 完成數排行 */}
        <Card>
          <SectionLabel>任務完成數排行</SectionLabel>
          {memberData.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 28, fontSize: 18, textAlign: "center", fontFamily: F }}>
                {i < 3 ? MEDAL[i] : <span style={{ color: C.muted, fontSize: 14 }}>{i + 1}</span>}
              </div>
              <Avatar name={m.name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: F }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: F }}>{m.unit_name}</div>
                <div style={{ marginTop: 4, height: 6, background: C.border, borderRadius: 3 }}>
                  <div style={{ width: `${(m.done / maxDone) * 100}%`, height: "100%", background: C.blue, borderRadius: 3 }} />
                </div>
              </div>
              <StatNum value={m.done} label="完成" color={C.blue} />
            </div>
          ))}
        </Card>

        {/* 完成率排行 */}
        <Card>
          <SectionLabel>任務完成率排行</SectionLabel>
          {[...memberData].filter(m => m.myTotal > 0).sort((a, b) => b.rate - a.rate).map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 28, textAlign: "center", fontSize: 14, color: C.muted, fontWeight: 700, fontFamily: F }}>{i + 1}</div>
              <Avatar name={m.name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: F }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: F }}>{m.myTotal} 件任務</div>
                <div style={{ marginTop: 4, height: 6, background: C.border, borderRadius: 3 }}>
                  <div style={{ width: `${m.rate}%`, height: "100%",
                    background: m.rate >= 70 ? C.blue : m.rate >= 40 ? C.warn : C.danger, borderRadius: 3 }} />
                </div>
              </div>
              <StatNum value={`${m.rate}%`} label="完成率"
                color={m.rate >= 70 ? C.blue : m.rate >= 40 ? C.warn : C.danger} />
            </div>
          ))}
        </Card>
      </div>

      {/* 個人詳細卡片 */}
      <SectionLabel>個人任務詳情</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }} className="person-grid">
        {memberData.map((m, i) => (
          <Card key={i} style={{
            borderLeft: `5px solid ${m.rate >= 70 ? C.blue : m.rate >= 40 ? C.accentMid : m.myTotal === 0 ? C.border : C.danger}`
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Avatar name={m.name} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text, fontFamily: F }}>{m.name}</div>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: F }}>{m.unit_name} · {m.role_type || ""}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { v: m.myTotal, label: "負責", color: C.text },
                { v: m.done,    label: "完成", color: C.blue },
                { v: m.overdue, label: "逾期", color: m.overdue > 0 ? C.danger : C.muted },
                { v: m.high,    label: "高優先", color: m.high > 0 ? C.danger : C.muted },
              ].map(s => (
                <div key={s.label} style={{ background: C.cardAlt, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: F, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: F }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontFamily: F }}>完成率</div>
            <LoadBar load={m.rate} />
          </Card>
        ))}
      </div>

      <style>{`.person-grid { grid-template-columns: repeat(2,1fr); } @media(max-width:768px){.person-grid{grid-template-columns:1fr!important;}}`}</style>
    </div>
  );
}

// ── 單位效率 ──────────────────────────────────────────────────────────────────
function UnitStats({ tasks, unitLoads }) {
  const unitData = unitLoads.map(u => {
    const ut       = tasks.filter(t => t.unit_id === u.id);
    const done     = ut.filter(t => t.status === "完成").length;
    const overdue  = ut.filter(t => t.overdue).length;
    const blocked  = ut.filter(t => t.status === "卡關").length;
    const rate     = ut.length > 0 ? Math.round(done / ut.length * 100) : 0;
    const overdueR = ut.length > 0 ? Math.round(overdue / ut.length * 100) : 0;
    const efficiency = rate - overdueR * 2; // 效率分數
    return { ...u, total: ut.length, done, overdue, blocked, rate, overdueR, efficiency };
  }).filter(u => u.total > 0).sort((a, b) => b.rate - a.rate);

  const maxTotal = Math.max(...unitData.map(u => u.total), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* 完成率 vs 逾期率對比 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="person-ranks">
        <Card>
          <SectionLabel>完成率排行（高→低）</SectionLabel>
          {unitData.sort((a,b) => b.rate - a.rate).map((u, i) => (
            <BarH key={i} label={u.name} value={u.rate} max={100}
              color={u.rate >= 70 ? C.blue : u.rate >= 40 ? C.warn : C.danger}
              right={`${u.rate}%（${u.done}/${u.total}）`} />
          ))}
        </Card>
        <Card>
          <SectionLabel>逾期率排行（低→高，越低越好）</SectionLabel>
          {[...unitData].sort((a,b) => a.overdueR - b.overdueR).map((u, i) => (
            <BarH key={i} label={u.name} value={u.overdueR} max={100}
              color={u.overdueR === 0 ? C.blue : u.overdueR <= 20 ? C.warn : C.danger}
              right={`${u.overdueR}%（${u.overdue} 件）`} />
          ))}
        </Card>
      </div>

      {/* 單位詳細比較表 */}
      <Card>
        <SectionLabel>各單位執行力綜合比較</SectionLabel>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F }}>
            <thead>
              <tr style={{ background: C.accent, color: "#fff" }}>
                {["單位", "任務數", "完成", "逾期", "卡關", "可用人力", "完成率", "負荷"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: h === "單位" ? "left" : "center",
                    fontSize: 12, fontWeight: 700, fontFamily: F }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...unitData].sort((a,b) => b.rate - a.rate).map((u, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? C.cardAlt : C.card, borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600, color: C.text }}>{u.name}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14, color: C.text }}>{u.total}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14, color: C.blue, fontWeight: 700 }}>{u.done}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14,
                    color: u.overdue > 0 ? C.danger : C.muted, fontWeight: u.overdue > 0 ? 700 : 400 }}>{u.overdue}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14,
                    color: u.blocked > 0 ? C.warn : C.muted }}>{u.blocked}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 14, color: C.muted }}>
                    {u.available}/{u.headcount}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span style={{
                      background: u.rate >= 70 ? C.blueLight : u.rate >= 40 ? C.warnLight : C.dangerLight,
                      color: u.rate >= 70 ? C.blue : u.rate >= 40 ? C.warn : C.danger,
                      padding: "3px 10px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                    }}>{u.rate}%</span>
                  </td>
                  <td style={{ padding: "10px 12px", width: 100 }}>
                    <LoadBar load={u.load} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 人力效益分析 */}
      <Card>
        <SectionLabel>人力效益分析（每位可用人力承擔任務數）</SectionLabel>
        {[...unitData].filter(u => u.available > 0).sort((a,b) =>
          (b.total/b.available) - (a.total/a.available)
        ).map((u, i) => {
          const ratio = (u.total / u.available).toFixed(1);
          const maxRatio = 10;
          return (
            <BarH key={i} label={u.name} value={parseFloat(ratio)} max={maxRatio}
              color={parseFloat(ratio) >= 5 ? C.danger : parseFloat(ratio) >= 3 ? C.warn : C.blue}
              right={`${ratio} 件/人（可用 ${u.available} 人）`} />
          );
        })}
        <div style={{ fontSize: 12, color: C.muted, fontFamily: F, marginTop: 8 }}>
          ※ 數值越高代表每人承擔任務越重，建議 3 件以下為合理範圍
        </div>
      </Card>
    </div>
  );
}

// 手機版 CSS
const mobileStyle = `
  @media (max-width: 768px) {
    .stats-r1 { grid-template-columns: repeat(2,1fr) !important; }
    .stats-tabs { flex-direction: column !important; align-items: stretch !important; }
    .stats-tabs > div { justify-content: center; }
    .person-grid { grid-template-columns: 1fr !important; }
    .unit-compare { grid-template-columns: 1fr !important; }
    table { font-size: 12px !important; }
    table th, table td { padding: 6px 8px !important; }
  }
  @media (max-width: 480px) {
    .stats-r1 { grid-template-columns: 1fr 1fr !important; }
  }
`;
