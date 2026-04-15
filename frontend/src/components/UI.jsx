import { C, F, SHADOW, SHADOW_UP, statusStyle } from "../theme.js";

export const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{
    background:C.card, borderRadius:18, boxShadow:SHADOW,
    padding:24, transition:"box-shadow 0.2s, transform 0.2s",
    cursor:onClick?"pointer":"default", ...style,
  }}
    onMouseEnter={e=>{ if(onClick){ e.currentTarget.style.boxShadow=SHADOW_UP; e.currentTarget.style.transform="translateY(-1px)"; }}}
    onMouseLeave={e=>{ if(onClick){ e.currentTarget.style.boxShadow=SHADOW; e.currentTarget.style.transform=""; }}}
  >{children}</div>
);

export const Badge = ({ status, overdue }) => {
  const s = statusStyle(status, overdue);
  return (
    <span style={{ background:s.bg, color:s.color, padding:"5px 14px", borderRadius:999,
      fontSize:13, fontWeight:700, fontFamily:F, whiteSpace:"nowrap", letterSpacing:"0.03em" }}>
      {s.label}
    </span>
  );
};

export const LoadBar = ({ load }) => {
  const color = load>=90 ? C.danger : load>=60 ? C.warn : C.blue;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ flex:1, height:7, background:C.border, borderRadius:4 }}>
        <div style={{ width:`${Math.min(load,100)}%`, height:"100%", background:color, borderRadius:4, transition:"width 0.4s" }}/>
      </div>
      <span style={{ fontSize:13, fontWeight:800, color, width:38, textAlign:"right", fontFamily:F }}>{load}%</span>
    </div>
  );
};

export const Avatar = ({ name="?", size=40 }) => {
  const palette = [C.accent, C.accentMid, C.warn, C.danger, C.blue];
  const color = palette[(name.charCodeAt(0)||0) % palette.length];
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:color+"22", border:`2px solid ${color}55`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.4, fontWeight:900, color, fontFamily:F, flexShrink:0,
    }}>{name[0]}</div>
  );
};

export const Btn = ({ children, onClick, variant="primary", style={} }) => {
  const map = {
    primary:   { background:C.accent,    color:"#fff",   border:"none" },
    secondary: { background:"transparent", color:C.accent, border:`1.5px solid ${C.accent}` },
    danger:    { background:C.danger,    color:"#fff",   border:"none" },
  };
  return (
    <button onClick={onClick} style={{
      ...map[variant], padding:"10px 22px", borderRadius:10,
      fontSize:14, fontWeight:700, fontFamily:F, cursor:"pointer",
      transition:"opacity 0.15s", ...style,
    }}
      onMouseEnter={e=>e.currentTarget.style.opacity="0.82"}
      onMouseLeave={e=>e.currentTarget.style.opacity="1"}
    >{children}</button>
  );
};

export const SectionLabel = ({ children }) => (
  <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:"0.12em",
    textTransform:"uppercase", marginBottom:14, fontFamily:F }}>{children}</div>
);

export const Empty = ({ label="尚無資料" }) => (
  <div style={{ textAlign:"center", padding:"48px 0", color:C.muted, fontSize:16, fontFamily:F }}>{label}</div>
);

export const Divider = () => (
  <div style={{ height:1, background:C.border, margin:"16px 0" }}/>
);
