import { useState } from "react";
import { api } from "../api.js";
import { C, F, priorityColor, statusStyle } from "../theme.js";
import { Card, Badge, Avatar, Btn, Empty } from "./UI.jsx";

const STATUSES  = ["未開始", "進行中", "卡關", "完成"];
const PRIORITIES = ["高", "中", "低"];

const TaskCard = ({ task, onEdit, onDelete }) => {
  const pc = priorityColor[task.priority] || C.muted;
  return (
    <Card style={{ borderLeft: `5px solid ${pc}`, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, fontFamily: F, flex: 1, lineHeight: 1.4 }}>{task.title}</div>
        <Badge status={task.status} overdue={task.overdue}/>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        {task.owner_name && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Avatar name={task.owner_name} size={22}/>
            <span style={{ fontSize: 13, color: C.muted, fontFamily: F }}>{task.owner_name}</span>
          </div>
        )}
        {task.unit_name    && <Chip>{task.unit_name}</Chip>}
        {task.meeting_label&& <Chip>{task.meeting_label}</Chip>}
        {task.due_date     && (
          <span style={{ fontSize: 13, fontWeight: 700, color: task.overdue ? C.danger : C.muted, marginLeft: "auto", fontFamily: F }}>
            {task.due_date}
          </span>
        )}
      </div>
      {task.blocked_reason && (
        <div style={{ fontSize: 13, color: C.danger, background: C.dangerLight, padding: "6px 12px", borderRadius: 8, fontFamily: F }}>
          卡關原因：{task.blocked_reason}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Btn variant="secondary" onClick={() => onEdit(task)} style={{ padding: "6px 14px", fontSize: 13 }}>編輯</Btn>
        <Btn variant="danger"    onClick={() => onDelete(task.id)} style={{ padding: "6px 14px", fontSize: 13 }}>刪除</Btn>
      </div>
    </Card>
  );
};

const Chip = ({ children }) => (
  <span style={{ fontSize: 12, color: C.muted, background: C.bg, padding: "3px 10px", borderRadius: 999, fontFamily: F }}>{children}</span>
);

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
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

export default function Tasks({ tasks, units, members, meetings, reload }) {
  const [filter, setFilter]   = useState("all");
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);

  const filtered = filter === "all" ? tasks : tasks.filter(t =>
    filter === "overdue" ? t.overdue : t.status === filter
  );

  const openNew  = () => { setForm({}); setModal(true); };
  const openEdit = (task) => { setForm({ ...task }); setModal(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (form.id) await api.updateTask(form.id, form);
      else         await api.createTask(form);
      await reload();
      setModal(false);
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm("確定刪除？")) return;
    await api.deleteTask(id);
    reload();
  };

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const filterBtns = [
    { key: "all",    label: `全部 (${tasks.length})` },
    { key: "進行中", label: `進行中 (${tasks.filter(t=>t.status==="進行中").length})` },
    { key: "卡關",   label: `卡關 (${tasks.filter(t=>t.status==="卡關").length})` },
    { key: "overdue",label: `逾期 (${tasks.filter(t=>t.overdue).length})` },
    { key: "完成",   label: `完成 (${tasks.filter(t=>t.status==="完成").length})` },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: C.text, fontFamily: F }}>任務列表</div>
        <Btn onClick={openNew}>新增任務</Btn>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {filterBtns.map(b => (
          <button key={b.key} onClick={() => setFilter(b.key)} style={{
            padding: "7px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: F,
            fontSize: 13, fontWeight: filter === b.key ? 800 : 500,
            background: filter === b.key ? C.accent : C.card,
            color: filter === b.key ? "#fff" : C.muted,
          }}>{b.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length ? filtered.map(t => <TaskCard key={t.id} task={t} onEdit={openEdit} onDelete={del}/>) : <Empty label="沒有符合的任務"/>}
      </div>

      {modal && (
        <Modal title={form.id ? "編輯任務" : "新增任務"} onClose={() => setModal(false)}>
          <Field label="任務名稱"><Input value={form.title} onChange={set("title")} placeholder="輸入任務名稱"/></Field>
          <Field label="說明"><Input value={form.description} onChange={set("description")} placeholder="說明（選填）"/></Field>
          <Field label="所屬會議">
            <Select value={form.meeting_id} onChange={v => set("meeting_id")(v ? +v : null)}
              options={meetings.map(m => ({ value: m.id, label: `第${m.session_no}次 ${m.title}` }))}/>
          </Field>
          <Field label="主責單位">
            <Select value={form.unit_id} onChange={v => set("unit_id")(v ? +v : null)}
              options={units.map(u => ({ value: u.id, label: u.name }))}/>
          </Field>
          <Field label="主責人">
            <Select value={form.owner_id} onChange={v => set("owner_id")(v ? +v : null)}
              options={members.map(m => ({ value: m.id, label: `${m.name}（${m.unit_name || ""}）` }))}/>
          </Field>
          <Field label="截止日期"><Input type="date" value={form.due_date} onChange={set("due_date")}/></Field>
          <Field label="優先級">
            <Select value={form.priority} onChange={set("priority")} options={PRIORITIES}/>
          </Field>
          <Field label="進度狀態">
            <Select value={form.status} onChange={set("status")} options={STATUSES}/>
          </Field>
          {form.status === "卡關" && (
            <Field label="卡關原因"><Input value={form.blocked_reason} onChange={set("blocked_reason")} placeholder="說明卡關原因"/></Field>
          )}
          <Field label="需求人力">
            <Input type="number" value={form.manpower_needed} onChange={v => set("manpower_needed")(+v)} placeholder="0"/>
          </Field>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={save} style={{ flex: 1 }}>{saving ? "儲存中..." : "儲存"}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)} style={{ flex: 1 }}>取消</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
