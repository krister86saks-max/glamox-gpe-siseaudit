import React, { useState } from "react";

type LoginProps = {
  /** App.tsx võib anda callbacki; kui puudub, teeme lihtsalt reloadi */
  onLoggedIn?: () => void;
};

export default function Login({ onLoggedIn }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const API_BASE = import.meta.env.VITE_API_BASE || "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Login failed (${res.status})`);

      localStorage.setItem("jwt", data.token || "");
      localStorage.setItem("role", data.role || "");
      localStorage.setItem("email", data.email || "");

      // Kui App.tsx andis callbacki, kutsume selle; muidu teeme reloadi
      if (onLoggedIn) onLoggedIn();
      else location.reload();
    } catch (e: any) {
      setErr(e.message || "Login error");
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Logi sisse</h1>
      {err && (
        <div className="mb-3 text-sm bg-red-50 border border-red-200 p-2 rounded">
          {err}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="E-post"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded p-2"
          type="password"
          placeholder="Parool"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="px-4 py-2 rounded bg-black text-white" type="submit">
          Logi sisse
        </button>
      </form>
    </div>
  );
}
