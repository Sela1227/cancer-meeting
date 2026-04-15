import { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";
import { C, F } from "./theme.js";
import { VERSION } from "./lib/version.js";
import Dashboard from "./components/Dashboard.jsx";
import Tasks from "./components/Tasks.jsx";
import Members from "./components/Members.jsx";
import Calendar from "./components/Calendar.jsx";
import Stats from "./components/Stats.jsx";

const APP_NAME = "彰濱秀傳癌症醫院專案追蹤系統";
const APP_SUB  = "CHANGHUA SHOW CHWAN · CANCER PROJECT TRACKER";

// SELA Gecko Logo SVG
const SelaLogo = ({ size = 36 }) => (
  <img src="/logo.jpg" alt="SELA"
    style={{ width:size, height:size, borderRadius:size*0.22,
      objectFit:"cover", flexShrink:0, display:"block" }}/>
);

const TABS = [
  { id:"dashboard", label:"儀表板", icon:(a)=>(
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" strokeWidth={a?2.2:1.8}/>
      <rect x="12" y="2" width="8" height="8" rx="2" stroke="currentColor" strokeWidth={a?2.2:1.8}/>
      <rect x="2" y="12" width="8" height="8" rx="2" stroke="currentColor" strokeWidth={a?2.2:1.8}/>
      <rect x="12" y="12" width="8" height="8" rx="2" stroke="currentColor" strokeWidth={a?2.2:1.8}/>
    </svg>
  )},
  { id:"tasks", label:"任務管理", icon:(a)=>(
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="3" width="16" height="16" rx="3" stroke="currentColor" strokeWidth={a?2.2:1.8}/>
      <path d="M7 11l3 3 5-5" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { id:"members", label:"人員單位", icon:(a)=>(
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth={a?2.2:1.8}/>
      <path d="M2 21c0-4 3.134-7 7-7s7 3 7 7" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round"/>
      <path d="M18 8v6M21 11h-6" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round"/>
    </svg>
  )},
  { id:"calendar", label:"行事曆", icon:(a)=>(
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="4" width="16" height="15" rx="3" stroke="currentColor" strokeWidth={a?2.2:1.8}/>
      <path d="M8 2v4M14 2v4M3 10h16" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round"/>
    </svg>
  )},
  { id:"stats", label:"統計", icon:(a)=>(
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path d="M3 17l4-5 4 3 4-7 4 2" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 20h16" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round"/>
    </svg>
  )},
];

// Settings Modal
const SettingsModal = ({ onClose, onReload }) => {
  const [msg, setMsg]       = useState("");
  const [loading, setLoading] = useState("");

  const loadDemo = async () => {
    setLoading("load");
    try {
      const res = await fetch("/api/demo/load", { method:"POST" });
      const data = await res.json();
      setMsg(data.message + "，頁面即將刷新...");
      setTimeout(() => window.location.reload(), 1500);
    } catch(e) { setMsg("載入失敗：" + e.message); setLoading(""); }
  };

  const clearDemo = async () => {
    if (!window.confirm("確定清除所有資料？此動作無法復原。")) return;
    setLoading("clear");
    try {
      const res = await fetch("/api/demo/clear", { method:"DELETE" });
      const data = await res.json();
      setMsg(data.message + "，頁面即將刷新...");
      setTimeout(() => window.location.reload(), 1500);
    } catch(e) { setMsg("清除失敗：" + e.message); setLoading(""); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:400,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.card, borderRadius:20, padding:32, width:"100%", maxWidth:440,
        boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div style={{ fontSize:20, fontWeight:900, color:C.text, fontFamily:F }}>系統設定</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:24,
            cursor:"pointer", color:C.muted, lineHeight:1 }}>×</button>
        </div>

        <div style={{ background:C.cardAlt, borderRadius:14, padding:20, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.accentMid, fontFamily:F,
            letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:8 }}>Demo 資料</div>
          <div style={{ fontSize:13, color:C.muted, fontFamily:F, marginBottom:16, lineHeight:1.6 }}>
            載入預設示範資料，包含 3 次會議、6 個單位、8 位人員、15 件任務（含逾期、卡關、完成等各種狀態），可完整體驗所有功能。
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={loadDemo} disabled={!!loading} style={{
              flex:1, background:C.accent, color:"#fff", border:"none",
              padding:"12px", borderRadius:10, fontSize:14, fontWeight:700,
              fontFamily:F, cursor:"pointer", opacity:loading?"0.6":"1",
            }}>
              {loading==="load" ? "載入中..." : "載入 Demo 資料"}
            </button>
            <button onClick={clearDemo} disabled={!!loading} style={{
              flex:1, background:"transparent", color:C.danger,
              border:`1.5px solid ${C.danger}`, padding:"12px", borderRadius:10,
              fontSize:14, fontWeight:700, fontFamily:F, cursor:"pointer",
              opacity:loading?"0.6":"1",
            }}>
              {loading==="clear" ? "清除中..." : "清除所有資料"}
            </button>
          </div>
        </div>

        {msg && (
          <div style={{ background:C.accentLight, borderRadius:10, padding:"12px 16px",
            fontSize:14, color:C.accent, fontFamily:F, fontWeight:600 }}>
            {msg}
          </div>
        )}

        <div style={{ marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <SelaLogo size={28}/>
            <div>
              <div style={{ fontSize:12, fontWeight:800, color:C.accent, fontFamily:F }}>Powered by SELA</div>
              <div style={{ fontSize:10, color:C.muted, fontFamily:F }}>{VERSION}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background:"none", border:`1px solid ${C.border}`,
            color:C.muted, padding:"8px 18px", borderRadius:8,
            fontSize:13, fontWeight:600, fontFamily:F, cursor:"pointer",
          }}>關閉</button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [tab, setTab]       = useState("dashboard");
  const [data, setData]     = useState({ stats:null, tasks:[], units:[], members:[], meetings:[], unitLoads:[], monthly:[] });
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      const [stats,tasks,units,members,meetings,unitLoads,monthly] = await Promise.all([
        api.stats(), api.tasks(), api.units(), api.members(),
        api.meetings(), api.unitLoads(), api.monthly(),
      ]);
      setData({ stats,tasks,units,members,meetings,unitLoads,monthly });
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const props = { ...data, reload:load, setTab };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:F, display:"flex", flexDirection:"column" }}>

      {/* ── Header ── */}
      <header style={{
        background:C.accent, color:"#fff", padding:"0 32px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100,
        boxShadow:"0 2px 16px rgba(0,0,0,0.25)",
      }}>
        {/* Logo + 標題 */}
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0" }}>
          <SelaLogo size={40}/>
          <div>
            <div style={{ fontSize:16, fontWeight:900, letterSpacing:"0.02em", fontFamily:F }}>{APP_NAME}</div>
            <div style={{ fontSize:9, opacity:0.6, letterSpacing:"0.1em", fontFamily:F }}>{APP_SUB}</div>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="dt-nav" style={{ display:"flex", gap:2 }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background: tab===t.id ? "rgba(255,255,255,0.18)" : "none",
              border:"none", cursor:"pointer", color:"#fff",
              padding:"12px 18px", borderRadius:10, fontSize:14,
              fontWeight:tab===t.id?800:400, fontFamily:F,
              opacity:tab===t.id?1:0.75,
              display:"flex", alignItems:"center", gap:7,
              transition:"all 0.15s",
            }}>
              {t.icon(tab===t.id)}{t.label}
            </button>
          ))}
        </nav>

        {/* Version + Settings */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div className="dt-nav" style={{ fontSize:12, opacity:0.55, fontFamily:F }}>{VERSION}</div>
          <button onClick={()=>setSettings(true)} style={{
            background:"rgba(255,255,255,0.15)", border:"none", cursor:"pointer",
            color:"#fff", borderRadius:10, padding:"8px 10px",
            display:"flex", alignItems:"center", transition:"background 0.15s",
          }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.25)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.15)"}
            title="系統設定">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Mobile tab label */}
        <div className="mb-title" style={{ fontSize:15, fontWeight:700, opacity:0.9, fontFamily:F }}>
          {TABS.find(t=>t.id===tab)?.label}
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ flex:1, maxWidth:1280, width:"100%", margin:"0 auto",
        padding:"28px 28px 100px", boxSizing:"border-box" }}>
        {loading
          ? <div style={{ textAlign:"center", padding:100, fontSize:18, color:C.muted, fontFamily:F }}>載入中...</div>
          : <>
              {tab==="dashboard" && <Dashboard {...props}/>}
              {tab==="tasks"     && <Tasks     {...props}/>}
              {tab==="members"   && <Members   {...props}/>}
              {tab==="calendar"  && <Calendar  {...props}/>}
              {tab==="stats"     && <Stats     {...props}/>}
            </>
        }
      </main>

      {/* ── Mobile bottom nav ── */}
      <div className="mb-bottom" style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:C.card, borderTop:`2px solid ${C.border}`,
        display:"flex", zIndex:200,
        paddingBottom:"env(safe-area-inset-bottom,0px)",
        boxShadow:"0 -4px 20px rgba(100,60,20,0.1)",
      }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1, background:"none", border:"none", cursor:"pointer",
            padding:"10px 4px 8px",
            display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            color:tab===t.id?C.accent:C.muted, fontFamily:F,
          }}>
            {t.icon(tab===t.id)}
            <span style={{ fontSize:10, fontWeight:tab===t.id?800:500 }}>{t.label}</span>
          </button>
        ))}
        <button onClick={()=>setSettings(true)} style={{
          width:52, background:"none", border:"none", cursor:"pointer",
          padding:"10px 4px 8px",
          display:"flex", flexDirection:"column", alignItems:"center", gap:4,
          color:C.muted, fontFamily:F,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize:10 }}>設定</span>
        </button>
      </div>

      {settings && <SettingsModal onClose={()=>setSettings(false)} onReload={load}/>}

      <style>{`
        .dt-nav    { display:flex !important; }
        .mb-title  { display:none !important; }
        .mb-bottom { display:none !important; }
        @media (max-width:768px) {
          .dt-nav    { display:none !important; }
          .mb-title  { display:block !important; }
          .mb-bottom { display:flex !important; }
        }
        * { box-sizing:border-box; }
      `}</style>
    </div>
  );
}
