// client/src/lib/api.ts
export type Department = { id: string; name: string };
export type Question = {
  id: string;
  department_id: string;
  text: string;
  clause?: string | null;
  stds: string[];
  guidance?: string | null;
  tags?: string[];
};

const API_BASE = import.meta.env.VITE_API_BASE || "";

function authHeaders() {
  const token = localStorage.getItem("jwt") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const fetchDepartments = () => api<Department[]>("/api/departments");
export const createDepartment = (dep: Department) =>
  api<{ ok: true }>("/api/departments", { method: "POST", body: JSON.stringify(dep) });

export const createQuestion = (q: Question) =>
  api<{ ok: true }>("/api/questions", { method: "POST", body: JSON.stringify(q) });
