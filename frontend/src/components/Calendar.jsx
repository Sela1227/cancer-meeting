import { useState } from "react";
import { C, F, statusStyle } from "../theme.js";
import { Card } from "./UI.jsx";

const DAYS   = ["日","一","二","三","四","五","六"];
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

export default function Calendar({ tasks }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(null); // { day, tasks }

  const prev = () => { if (month === 0) { setYear(y=>y-1); setMonth(11); } else setMonth(m=>m-1); setSelected(null); };
  const next = () => { if (month===11)  { setYear(y=>y+1); setMonth(0);  } else setMonth(m=>m+1); setSelected(null); };

  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();

  const tasksForDay = (day) => {
    const d = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return tasks.filter(t => t.due_date === d);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <Card style={{ padding:"20px 16px" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <button onClick={prev} style={{ background:"none", border:`1px solid ${C.border}`,
            borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:18, color:C.muted }}>‹</button>
          <div style={{ fontSize:20, fontWeight:900, color:C.text, fontFamily:F }}>{year} 年 {MONTHS[month]}</div>
          <button onClick={next} style={{ background:"none", border:`1px solid ${C.border}`,
            borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:18, color:C.muted }}>›</button>
        </div>

        {/* Weekday headers */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:4 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign:"center", fontSize:12, fontWeight:700,
              color:C.muted, paddingBottom:6, fontFamily:F }}>{d}</div>
          ))}
        </div>

        {/* Grid — 手機版格子縮小，任務只顯示圓點 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
          {Array.from({ length: firstDay }).map((_,i) => <div key={`e${i}`}/>)}
          {Array.from({ length: daysInMonth }, (_,i) => {
            const day = i+1;
            const isToday   = day===today.getDate() && month===today.getMonth() && year===today.getFullYear();
            const dayTasks  = tasksForDay(day);
            const hasOverdue = dayTasks.some(t=>t.overdue);
            const isSelected = selected?.day === day;

            return (
              <div key={day}
                onClick={() => dayTasks.length > 0 && setSelected(isSelected ? null : { day, tasks: dayTasks })}
                style={{
                  background: isToday ? C.accent : isSelected ? C.accentLight : C.bg,
                  borderRadius:10, padding:"6px 4px",
                  minHeight:48,
                  border: isSelected ? `2px solid ${C.accent}` : isToday ? "none" : `1px solid ${C.border}`,
                  cursor: dayTasks.length > 0 ? "pointer" : "default",
                  position:"relative",
                }}>
                {/* 日期數字 */}
                <div style={{ fontSize:14, fontWeight:isToday?900:500,
                  color:isToday?"#fff":C.text, marginBottom:3,
                  textAlign:"center", fontFamily:F }}>{day}</div>

                {/* 桌機：任務標籤 */}
                <div className="cal-labels">
                  {dayTasks.slice(0,2).map((t,j) => {
                    const s = statusStyle(t.status, t.overdue);
                    return (
                      <div key={j} style={{
                        fontSize:9, fontWeight:700, fontFamily:F,
                        background: isToday?"rgba(255,255,255,0.25)":s.bg,
                        color: isToday?"#fff":s.color,
                        padding:"1px 4px", borderRadius:4, marginBottom:2,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                      }}>{t.title}</div>
                    );
                  })}
                  {dayTasks.length > 2 && (
                    <div style={{ fontSize:9, color:C.muted, fontFamily:F }}>+{dayTasks.length-2}</div>
                  )}
                </div>

                {/* 手機：圓點指示 */}
                {dayTasks.length > 0 && (
                  <div className="cal-dots" style={{ display:"flex", justifyContent:"center", gap:2, marginTop:2 }}>
                    {dayTasks.slice(0,3).map((t,j) => {
                      const s = statusStyle(t.status, t.overdue);
                      return (
                        <div key={j} style={{
                          width:5, height:5, borderRadius:"50%",
                          background: isToday?"rgba(255,255,255,0.8)":s.color,
                        }}/>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display:"flex", gap:14, marginTop:16, flexWrap:"wrap" }}>
          {[
            { label:"完成",   color:C.blue },
            { label:"進行中", color:C.accentMid },
            { label:"逾期/卡關", color:C.danger },
          ].map(l=>(
            <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:l.color }}/>
              <span style={{ fontSize:11, color:C.muted, fontFamily:F }}>{l.label}</span>
            </div>
          ))}
          <span style={{ fontSize:11, color:C.muted, fontFamily:F, marginLeft:"auto" }}>
            手機版點日期查看任務
          </span>
        </div>
      </Card>

      {/* 點選後顯示任務清單（手機友善） */}
      {selected && (
        <Card style={{ padding:"16px 20px" }}>
          <div style={{ fontSize:15, fontWeight:800, color:C.text, fontFamily:F, marginBottom:12 }}>
            {month+1}/{selected.day} 任務清單
          </div>
          {selected.tasks.map((t,i) => {
            const s = statusStyle(t.status, t.overdue);
            return (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:12,
                padding:"10px 14px", background:C.bg, borderRadius:10, marginBottom:8,
                borderLeft:`4px solid ${s.color}`,
              }}>
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
