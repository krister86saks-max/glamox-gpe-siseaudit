import React, { useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import type {
  SupplierAudit, SupplierAuditPoint, SubQuestion, QuestionType,
  SupplierAuditTemplate
} from '../types/audit';

type Role = 'admin' | 'auditor' | 'external' | null;

interface Props {
  token: string | null;   // saame App.tsx-st
  role: Role;             // saame App.tsx-st
}

export default function SupplierAuditPage({ token, role }: Props) {
  const [audit, setAudit] = useState<SupplierAudit | null>(null);

  // Mallid (serverist)
  const [templates, setTemplates] = useState<SupplierAuditTemplate[]>([]);
  const [tplId, setTplId] = useState<string>('');

  // Pildid – hoiame pildid per-punkt (point.id -> dataURL[])
  const [images, setImages] = useState<Record<string, string[]>>({});

  // Init – tühi mustand
  useEffect(() => {
    const draft: SupplierAudit = {
      id: nanoid(),
      supplierName: '',
      date: new Date().toISOString(),
      auditor: '',
      points: [],
      status: 'draft',
    };
    setAudit(draft);
  }, []);

  // Lae mallid serverist
  useEffect(() => {
    fetch('/api/supplier-audit-templates')
      .then(r => r.json())
      .then((list: SupplierAuditTemplate[]) => setTemplates(list))
      .catch(() => setTemplates([]));
  }, []);

  // --- util: sügav koopia mallist auditisse (uued id-d) ---
  function applyTemplate(tpl: SupplierAuditTemplate) {
    function clonePoint(p: SupplierAuditPoint): SupplierAuditPoint {
      return {
        id: nanoid(),
        code: p.code,
        title: p.title,
        comment: '',
        subQuestions: p.subQuestions.map(s => ({
          id: nanoid(),
          text: s.text,
          type: s.type,
          options: s.options ? s.options.map(o => ({ id: nanoid(), label: o.label })) : undefined,
          answerText: undefined,
          answerOptions: undefined
        }))
      };
    }
    setAudit(a => a ? { ...a, points: tpl.points.map(clonePoint) } : a);
    // puhasta pildid (uued id-d)
    setImages({});
  }

  // --- CRUD punktidele ---
  const addPoint = () => {
    if (!audit) return;
    const p: SupplierAuditPoint = { id: nanoid(), title: 'Uus punkt', code: '', subQuestions: [], comment: '' };
    setAudit({ ...audit, points: [...audit.points, p] });
  };

  const updatePoint = (id: string, patch: Partial<SupplierAuditPoint>) => {
    if (!audit) return;
    setAudit({
      ...audit,
      points: audit.points.map(p => p.id === id ? { ...p, ...patch } : p)
    });
  };

  const removePoint = (id: string) => {
    if (!audit) return;
    setAudit({
      ...audit,
      points: audit.points.filter(p => p.id !== id)
    });
    setImages(prev => {
      const cp = { ...prev }; delete cp[id]; return cp;
    });
  };

  // --- Alam-küsimused ---
  const addSub = (point: SupplierAuditPoint, type: QuestionType) => {
    const sub: SubQuestion = { id: nanoid(), text: 'Uus küsimus', type };
    updatePoint(point.id, { subQuestions: [...point.subQuestions, sub] });
  };

  const updateSub = (point: SupplierAuditPoint, id: string, patch: Partial<SubQuestion>) => {
    const subs = point.subQuestions.map(s => s.id === id ? { ...s, ...patch } : s);
    updatePoint(point.id, { subQuestions: subs });
  };

  const removeSub = (point: SupplierAuditPoint, id: string) => {
    const subs = point.subQuestions.filter(s => s.id !== id);
    updatePoint(point.id, { subQuestions: subs });
  };

  // --- Pildid per punkt ---
  function addImages(pointId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    Promise.all(list.map(f => new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(f);
    }))).then(urls => {
      setImages(p => ({ ...p, [pointId]: [...(p[pointId] || []), ...urls] }));
    });
  }
  function removeImage(pointId: string, idx: number) {
    setImages(p => {
      const arr = [...(p[pointId] || [])];
      arr.splice(idx, 1);
      return { ...p, [pointId]: arr };
    });
  }

  // --- Malli salvestamine (ainult admin) ---
  async function saveAsTemplate() {
    if (role !== 'admin' || !token) {
      alert('Mallide salvestamine on lubatud ainult adminile (logi sisse).');
      return;
    }
    if (!audit) return;
    const name = window.prompt('Mallile nimi (nt "Supplier – Plastic Moulding")?');
    if (!name) return;

    // Eemaldame vastuseväljad malli struktuurist
    const payload = {
      name,
      points: audit.points.map(p => ({
        id: p.id,
        code: p.code,
        title: p.title,
        comment: '', // malli tasemel tühjendame
        subQuestions: p.subQuestions.map(s => ({
          id: s.id,
          text: s.text,
          type: s.type,
          options: s.options?.map(o => ({ id: o.id, label: o.label }))
        }))
      }))
    };

    const r = await fetch('/api/supplier-audit-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert('Malli salvestus ebaõnnestus: ' + (j.error || r.statusText));
      return;
    }
    const tpl: SupplierAuditTemplate = await r.json();
    setTemplates(prev => [...prev, tpl]);
    setTplId(tpl.id);
    alert('Mall salvestatud.');
  }

  // --- Admin: muuda nime ---
  async function renameTemplate() {
    if (role !== 'admin' || !token || !tplId) return;
    const current = templates.find(t => t.id === tplId);
    const name = window.prompt('Uus auditi liigi nimi', current?.name || '');
    if (!name) return;
    const r = await fetch(`/api/supplier-audit-templates/${tplId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert('Nime muutmine ebaõnnestus: ' + (j.error || r.statusText));
      return;
    }
    const updated: SupplierAuditTemplate = await r.json();
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    alert('Nimi muudetud.');
  }

  // --- Admin: kirjuta üle valitud liik praeguse küsimustikuga ---
  async function overwriteTemplateFromCurrent() {
    if (role !== 'admin' || !token || !tplId || !audit) return;
    const current = templates.find(t => t.id === tplId);
    if (!current) return;
    if (!confirm(`Kirjuta üle "${current.name}" sisu praeguse küsimustikuga?`)) return;

    const payload = {
      name: current.name,
      points: audit.points.map(p => ({
        id: p.id,
        code: p.code,
        title: p.title,
        comment: '',
        subQuestions: p.subQuestions.map(s => ({
          id: s.id,
          text: s.text,
          type: s.type,
          options: s.options?.map(o => ({ id: o.id, label: o.label }))
        }))
      }))
    };

    const r = await fetch(`/api/supplier-audit-templates/${tplId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert('Üle kirjutamine ebaõnnestus: ' + (j.error || r.statusText));
      return;
    }
    const updated: SupplierAuditTemplate = await r.json();
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    alert('Küsimustik kirjutati üle.');
  }

  // --- Admin: kustuta liik ---
  async function deleteTemplate() {
    if (role !== 'admin' || !token || !tplId) return;
    const current = templates.find(t => t.id === tplId);
    if (!current) return;
    if (!confirm(`Kustuta auditi liik "${current.name}"?`)) return;

    const r = await fetch(`/api/supplier-audit-templates/${tplId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert('Kustutamine ebaõnnestus: ' + (j.error || r.statusText));
      return;
    }
    setTemplates(prev => prev.filter(t => t.id !== tplId));
    setTplId('');
    alert('Auditi liik kustutatud.');
  }

  // --- Pooliku auditi alla-/üleslaadimine ---
  function downloadPartial() {
    if (!audit) return;
    const payload = { audit, images };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `supplier-audit-draft-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function openPartial(file: File) {
    try {
      const text = await file.text();
      const j = JSON.parse(text);
      if (!j || !j.audit) throw new Error('vale fail');
      setAudit(j.audit as SupplierAudit);
      setImages(j.images || {});
      alert('Poolik tarnijaaudit laetud.');
    } catch {
      alert('Pooliku auditi avamine ebaõnnestus.');
    }
  }

  function handlePrint() { window.print(); }

  if (!audit) return null;

  return (
    <div className="space-y-4">
      {/* Peaandmed */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input className="border p-2 rounded" placeholder="Tarnija nimi"
          value={audit.supplierName} onChange={e=>setAudit({ ...audit, supplierName: e.target.value })} />
        <input className="border p-2 rounded" placeholder="Auditor"
          value={audit.auditor} onChange={e=>setAudit({ ...audit, auditor: e.target.value })} />
        <input className="border p-2 rounded" type="date"
          value={audit.date.slice(0,10)} onChange={e=>setAudit({ ...audit, date: new Date(e.target.value).toISOString() })} />

        {/* Partial audit nupud */}
        <button className="border p-2 rounded" onClick={downloadPartial}>Lae alla poolik audit</button>
        <label className="border p-2 rounded text-center cursor-pointer">
          Ava poolik audit
          <input type="file" className="hidden" accept="application/json" onChange={e => e.target.files && openPartial(e.target.files[0])} />
        </label>
      </div>

      {/* Mallid / auditi liigid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="flex gap-2">
          <select className="border p-2 rounded" value={tplId} onChange={e=>setTplId(e.target.value)}>
            <option value="">— Vali auditi liik —</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {role === 'admin' && tplId && (
            <>
              <button className="border p-2 rounded" onClick={renameTemplate}>Muuda nime</button>
              <button className="border p-2 rounded" onClick={overwriteTemplateFromCurrent}>
                Kirjuta üle selle küsimustikuga
              </button>
              <button className="border p-2 rounded" onClick={deleteTemplate}>Kustuta liik</button>
            </>
          )}
        </div>

        <button
          className="border p-2 rounded"
          disabled={!tplId}
          onClick={()=>{
            const tpl = templates.find(t=>t.id===tplId);
            if (tpl) applyTemplate(tpl);
          }}>
          Ava küsimustik
        </button>

        {role === 'admin' && (
          <button className="border p-2 rounded bg-black text-white" onClick={saveAsTemplate}>
            Salvesta mallina
          </button>
        )}

        <button className="border p-2 rounded" onClick={handlePrint}>Salvesta PDF</button>
      </div>

      {/* Punktid */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Auditipunktid</h2>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={addPoint}>+ Lisa punkt</button>
      </div>

      <div className="space-y-6">
        {audit.points.map(point => (
          <div key={point.id} className="border rounded-2xl p-4 shadow-sm">
            <div className="flex gap-2 items-center mb-2">
              <input className="border p-2 rounded w-24" placeholder="Kood"
                     value={point.code ?? ''} onChange={e=>updatePoint(point.id, { code: e.target.value })} />
              <input className="border p-2 rounded flex-1" placeholder="Punkti pealkiri"
                     value={point.title} onChange={e=>updatePoint(point.id, { title: e.target.value })} />
              <div className="ml-auto flex gap-2">
                <button className="px-3 py-1 border rounded" onClick={() => addSub(point, 'open')}>+ Küsimus</button>
                <button className="px-3 py-1 border rounded" onClick={() => addSub(point, 'multi')}>+ Valikvastustega</button>
                <button className="px-3 py-1 border rounded" onClick={() => removePoint(point.id)}>Kustuta punkt</button>
              </div>
            </div>

            {/* alam-küsimused */}
            <div className="space-y-3">
              {point.subQuestions.map(sub => (
                <div key={sub.id} className="border rounded-xl p-3">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs px-2 py-1 border rounded">{sub.type === 'open' ? 'OPEN' : 'MULTI'}</span>
                    <input className="border p-2 rounded flex-1" placeholder="Küsimuse tekst"
                           value={sub.text} onChange={e=>updateSub(point, sub.id, { text: e.target.value })} />
                    <button className="px-2 py-1 border rounded" onClick={() => removeSub(point, sub.id)}>Kustuta</button>
                  </div>

                  {sub.type === 'multi' && (
                    <MultiOptionsEditor
                      sub={sub}
                      onChange={(patch) => updateSub(point, sub.id, patch)}
                    />
                  )}

                  {sub.type === 'open' && (
                    <input className="border p-2 rounded w-full mt-2" placeholder="Vastus (vaba tekst)"
                           value={sub.answerText ?? ''} onChange={e=>updateSub(point, sub.id, { answerText: e.target.value })} />
                  )}
                </div>
              ))}
            </div>

            {/* kommentaar */}
            <div className="mt-3">
              <label className="text-sm font-medium">Kommentaar</label>
              <textarea className="border p-2 rounded w-full mt-1" rows={3}
                        value={point.comment ?? ''} onChange={e=>updatePoint(point.id, { comment: e.target.value })} />
            </div>

            {/* pildid (pärast kommentaari) */}
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">Pildid</div>
              <input type="file" accept="image/*" multiple onChange={e => addImages(point.id, e.target.files)} />
              {(images[point.id]?.length ?? 0) > 0 && (
                <div className="mt-2 grid md:grid-cols-2 gap-2">
                  {images[point.id]!.map((src, i) => (
                    <div key={i} className="border rounded p-1">
                      <img src={src} alt={`Foto ${i+1}`} className="w-full h-auto" />
                      <div className="text-xs text-gray-600 mt-1">Foto {i+1}</div>
                      <button className="text-xs underline mt-1" onClick={() => removeImage(point.id, i)}>Eemalda</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MultiOptionsEditor({ sub, onChange }: { sub: SubQuestion; onChange: (p: Partial<SubQuestion>) => void; }) {
  const opts = sub.options ?? [];
  const addOpt = () => onChange({ options: [...opts, { id: nanoid(), label: 'Uus valik' }] });
  const setLabel = (id: string, label: string) => onChange({ options: (sub.options ?? []).map(o => o.id === id ? { ...o, label } : o) });
  const toggle = (id: string) => {
    const chosen = new Set(sub.answerOptions ?? []);
    chosen.has(id) ? chosen.delete(id) : chosen.add(id);
    onChange({ answerOptions: Array.from(chosen) });
  };
  const remove = (id: string) => onChange({ options: (sub.options ?? []).filter(o => o.id !== id) });

  return (
    <div className="mt-2 space-y-2">
      {(sub.options ?? []).map(o => (
        <div key={o.id} className="flex items-center gap-2">
          <input type="checkbox" checked={(sub.answerOptions ?? []).includes(o.id)} onChange={() => toggle(o.id)} />
          <input className="border p-1 rounded flex-1" value={o.label} onChange={e=>setLabel(o.id, e.target.value)} />
          <button className="px-2 py-1 border rounded" onClick={() => remove(o.id)}>×</button>
        </div>
      ))}
      <button className="px-2 py-1 border rounded" onClick={addOpt}>+ Lisa valik</button>
    </div>
  );
}


