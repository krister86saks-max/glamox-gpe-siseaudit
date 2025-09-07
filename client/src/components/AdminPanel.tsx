import React, { useEffect, useState } from "react";
import {
  fetchDepartments,
  createDepartment,
  createQuestion,
  type Department,
} from "../lib/api";

export default function AdminPanel() {
  const [deps, setDeps] = useState<Department[]>([]);
  const [depId, setDepId] = useState("");
  const [depName, setDepName] = useState("");

  const [qId, setQId] = useState("");
  const [qDep, setQDep] = useState("");
  const [qText, setQText] = useState("");
  const [qClause, setQClause] = useState("");
  const [qStds, setQStds] = useState(""); // eralda komade/tühikutega

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const list = await fetchDepartments();
      setDeps(list);
      if (!qDep && list.length) setQDep(list[0].id);
    } catch (e: any) {
      setMsg(`Osakondade laadimine ebaõnnestus: ${e.message}`);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAddDep(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      if (!depId || !depName) throw new Error("ID ja nimi on kohustuslikud");
      await createDepartment({ id: depId.trim(), name: depName.trim() });
      setDepId("");
      setDepName("");
      await load();
      setMsg("Osakond lisatud.");
    } catch (e: any) {
      setMsg(`Viga osakonna lisamisel: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function onAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      if (!qId || !qDep || !qText) throw new Error("ID, osakond ja küsimus on kohustuslikud");
      const stds = qStds.split(/[,\s]+/).filter(Boolean);
      await createQuestion({
        id: qId.trim(),
        department_id: qDep,
        text: qText.trim(),
        clause: qClause.trim() || null,
        stds,
        guidance: null,
        tags: [],
      });
      setQId("");
      setQText("");
      setQClause("");
      setQStds("");
      setMsg("Küsimus lisatud.");
    } catch (e: any) {
      setMsg(`Viga küsimuse lisamisel: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 border rounded-2xl shadow-sm mt-6">
      <h2 className="text-xl font-semibold mb-3">Admin • Halda andmeid</h2>

      {msg && (
        <div className="mb-3 text-sm rounded bg-gray-100 p-2">
          {msg}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Osakonna vorm */}
        <form onSubmit={onAddDep} className="space-y-2">
          <h3 className="font-medium">Lisa osakond</h3>
          <input
            className="w-full border rounded p-2"
            placeholder="ID (nt dep-too)"
            value={depId}
            onChange={(e) => setDepId(e.target.value)}
          />
          <input
            className="w-full border rounded p-2"
            placeholder="Nimi (nt Tööohutus)"
            value={depName}
            onChange={(e) => setDepName(e.target.value)}
          />
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
            type="submit"
          >
            Salvesta osakond
          </button>
          <div className="text-xs text-gray-500">
            ID peab olema unikaalne. Võid kasutada tähti, numbreid ja sidekriipse.
          </div>
          <div className="text-sm mt-2">
            Olemasolevad: {deps.length ? deps.map((d) => d.name).join(", ") : "—"}
          </div>
        </form>

        {/* Küsimuse vorm */}
        <form onSubmit={onAddQuestion} className="space-y-2">
          <h3 className="font-medium">Lisa küsimus</h3>
          <input
            className="w-full border rounded p-2"
            placeholder="Küsimuse ID (nt q-101)"
            value={qId}
            onChange={(e) => setQId(e.target.value)}
          />
          <select
            className="w-full border rounded p-2"
            value={qDep}
            onChange={(e) => setQDep(e.target.value)}
          >
            <option value="">— Vali osakond —</option>
            {deps.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <textarea
            className="w-full border rounded p-2"
            placeholder="Küsimuse tekst"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            rows={3}
          />
          <input
            className="w-full border rounded p-2"
            placeholder="Clause (nt 6.1.2)"
            value={qClause}
            onChange={(e) => setQClause(e.target.value)}
          />
          <input
            className="w-full border rounded p-2"
            placeholder="Standardid (nt ISO45001:6.1.2, ISO9001:6.2)"
            value={qStds}
            onChange={(e) => setQStds(e.target.value)}
          />
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
            type="submit"
          >
            Salvesta küsimus
          </button>
          <div className="text-xs text-gray-500">
            Standardid: eralda komade või tühikutega. Salvestatakse loendina.
          </div>
        </form>
      </div>
    </div>
  );
}
