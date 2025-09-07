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

// Ühtne viis päiste loomiseks (sobib HeadersInit-ile)
function buildHeaders(extra?: HeadersInit): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("jwt");
  if (token) h["Authorization"] = `Bearer ${token}`;

  if (extra) {
    if (Array.isArray(extra)) {
      for (const [k, v] of extra) h[k] = String(v);
    } else if (extra instanceof Headers) {
      extra.forEach((v, k) => (h[k] = v));
    } else {
      Object.assign(h, extra as Record<string, string>);
    }
  }
  return h;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildHeaders(init.headers),
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = (j as any).error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const fetchDepartments = () => api<Department[]>("/api/departments");

export const createDepartment = (dep: Department) =>
  api<{ ok: true }>("/api/departments", {
    method: "POST",
    body: JSON.stringify(dep),
  });

export const createQuestion = (q: Question) =>
  api<{ ok: true }>("/api/questions", {
    method: "POST",
    body: JSON.stringify(q),
  });
