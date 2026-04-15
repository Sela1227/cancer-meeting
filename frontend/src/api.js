const r = async (method, path, body) => {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
};

export const api = {
  stats:         ()          => r("GET",    "/dashboard/stats"),
  monthly:       ()          => r("GET",    "/dashboard/monthly"),
  unitLoads:     ()          => r("GET",    "/dashboard/unit-loads"),
  meetings:      ()          => r("GET",    "/meetings"),
  createMeeting: (d)         => r("POST",   "/meetings", d),
  deleteMeeting: (id)        => r("DELETE", `/meetings/${id}`),
  units:         ()          => r("GET",    "/units"),
  createUnit:    (d)         => r("POST",   "/units", d),
  updateUnit:    (id, d)     => r("PATCH",  `/units/${id}`, d),
  members:       (uid)       => r("GET",    uid ? `/members?unit_id=${uid}` : "/members"),
  createMember:  (d)         => r("POST",   "/members", d),
  updateMember:  (id, d)     => r("PATCH",  `/members/${id}`, d),
  deleteMember:  (id)        => r("DELETE", `/members/${id}`),
  tasks:         (q="")      => r("GET",    `/tasks${q}`),
  createTask:    (d)         => r("POST",   "/tasks", d),
  updateTask:    (id, d)     => r("PATCH",  `/tasks/${id}`, d),
  deleteTask:    (id)        => r("DELETE", `/tasks/${id}`),
  comments:      (id)        => r("GET",    `/tasks/${id}/comments`),
  addComment:    (id, d)     => r("POST",   `/tasks/${id}/comments`, d),
};
