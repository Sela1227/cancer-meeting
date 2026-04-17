export const F = "'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";

const LIGHT = {
  bg:          "#F0E6D8",
  card:        "#FBF6F0",
  cardAlt:     "#F5EDE2",
  border:      "#DEC9B4",
  text:        "#2E1F14",
  muted:       "#9E7E68",
  accent:      "#6B4226",
  accentLight: "#EDD9C8",
  accentMid:   "#A0663A",
  blue:        "#4A6741",
  blueLight:   "#DCE8D9",
  warn:        "#B07030",
  warnLight:   "#F5E8D0",
  danger:      "#8B2E2E",
  dangerLight: "#F0DADA",
};

const DARK = {
  bg:          "#1A120A",
  card:        "#241910",
  cardAlt:     "#2E2016",
  border:      "#4A3020",
  text:        "#F0DFC8",
  muted:       "#9E8070",
  accent:      "#C4835A",
  accentLight: "#3A2515",
  accentMid:   "#D4936A",
  blue:        "#6A9E60",
  blueLight:   "#1E3018",
  warn:        "#D49040",
  warnLight:   "#3A2A10",
  danger:      "#C05050",
  dangerLight: "#3A1818",
};

// 偵測系統深色模式（預設）+ 允許手動覆寫
let _dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
let _override = localStorage.getItem("theme");
if (_override === "dark")  _dark = true;
if (_override === "light") _dark = false;

export let C = _dark ? DARK : LIGHT;

export function setTheme(mode) {
  localStorage.setItem("theme", mode);
  window.location.reload();
}

export function isDark() { return _dark; }

export const SHADOW    = "0 2px 16px rgba(100,60,20,0.08),0 1px 4px rgba(100,60,20,0.05)";
export const SHADOW_UP = "0 8px 28px rgba(100,60,20,0.13),0 2px 8px rgba(100,60,20,0.08)";

export const priorityColor = { "高": C.danger, "中": C.warn, "低": C.blue };

export const statusStyle = (status, overdue) => {
  if (overdue && status !== "完成") return { bg: C.dangerLight, color: C.danger, label: "逾期" };
  return ({
    "完成":   { bg: C.blueLight,   color: C.blue,     label: "完成"   },
    "進行中": { bg: C.accentLight, color: C.accentMid, label: "進行中" },
    "卡關":   { bg: C.dangerLight, color: C.danger,    label: "卡關"   },
    "未開始": { bg: C.border,      color: C.muted,     label: "未開始" },
  }[status] || { bg: C.border, color: C.muted, label: status });
};
