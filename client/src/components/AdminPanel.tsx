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
  useEffect(() => { load(); }, []);

  async function onAddDep(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      if (!depId || !depName) throw new Error("ID ja nimi on kohustuslikud");
      await createDepartment({ id: depId, name: depName });
      setDepId(""); setDepName("");
      await load();
      setMsg("Osakond lisatud.");
    } catch (e: any) {
      setMsg(`Viga osakonna lisamisel: ${e.message}`);
    } finally { setSaving(false); }
  }

  async function onAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      if (!qId || !qDep || !qText) throw new Error("ID, osakond ja küsimus on kohustuslikud");
      const stds = qStds.split(/[,\s]+/).filter(Boolean);
      await createQuestion({
        id: qId,
        department_id: qDep,
        text: qText,
        clause: qClause || null,
        stds,
        guidance: null,
        tags: [],
      });
      setQId(""); setQText(""); setQClause(""); setQStds("");
      setMsg("Küsimus lisatud.");
    } catch (e: any) {
      setMsg(`Viga küsimuse lisamisel: ${e.message}`);
    } finally { setSaving(false); }
  }

  return (
    <div className="p-4 border rounded-2xl shadow-sm mt-6">
      <h2 className="text-xl font-semibold mb-3">Admin • Halda andmeid</h2>
      {
