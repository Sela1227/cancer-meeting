export const F = "'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";

export const C = {
  bg:          "#F0E6D8",   // 奶茶底色
  card:        "#FBF6F0",   // 卡片白
  cardAlt:     "#F5EDE2",   // 次要卡片
  border:      "#DEC9B4",   // 邊框
  text:        "#2E1F14",   // 主文字
  muted:       "#9E7E68",   // 次要文字
  accent:      "#6B4226",   // 深棕主色
  accentLight: "#EDD9C8",   // 淺棕
  accentMid:   "#A0663A",   // 中棕
  blue:        "#4A6741",   // 橄欖綠（進行中）
  blueLight:   "#DCE8D9",
  warn:        "#B07030",   // 琥珀（注意）
  warnLight:   "#F5E8D0",
  danger:      "#8B2E2E",   // 深紅（逾期）
  dangerLight: "#F0DADA",
};

export const SHADOW = "0 2px 16px rgba(100,60,20,0.08),0 1px 4px rgba(100,60,20,0.05)";
export const SHADOW_UP = "0 8px 28px rgba(100,60,20,0.13),0 2px 8px rgba(100,60,20,0.08)";

export const priorityColor = { "高": C.danger, "中": C.warn, "低": C.blue };

export const statusStyle = (status, overdue) => {
  if (overdue && status !== "完成") return { bg: C.dangerLight, color: C.danger, label: "逾期" };
  return ({
    "完成":   { bg: C.blueLight,   color: C.blue,   label: "完成" },
    "進行中": { bg: C.accentLight, color: C.accentMid, label: "進行中" },
    "卡關":   { bg: C.dangerLight, color: C.danger, label: "卡關" },
    "未開始": { bg: "#EDE5DC",     color: C.muted,  label: "未開始" },
  }[status] || { bg: "#EDE5DC", color: C.muted, label: status });
};
