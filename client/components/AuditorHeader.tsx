import React, { useState } from 'react';

interface Props {
  auditId: string;
  initial?: {
    date?: string;
    auditor_name?: string;
    auditee_name?: string;
    sub_department?: string | null;
  }
  onSaved?: () => void;
}

export default function AuditorHeader({ auditId, initial, onSaved }: Props) {
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0,10));
  const [auditorName, setAuditorName] = useState(initial?.auditor_name ?? '');
  const [auditeeName, setAuditeeName] = useState(initial?.auditee_name ?? '');
  const [subDept, setSubDept] = useState(initial?.sub_department ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/audits/${auditId}/header`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          auditor_name: auditorName.trim(),
          auditee_name: auditeeName.trim(),
          sub_department: subDept.trim() || undefined,
        })
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Save failed');
      onSaved?.();
    } catch (e:any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(date && auditorName.trim() && auditeeName.trim());

  return (
    <div className="grid gap-4 p-4 rounded-2xl shadow">
      <div className="grid gap-1">
        <label className="text-sm">Kuupäev *</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} required className="border p-2 rounded" />
      </div>
      <div className="grid gap-1">
        <label className="text-sm">Auditeerija nimi *</label>
        <input value={auditorName} onChange={e=>setAuditorName(e.target.value)} required className="border p-2 rounded" />
      </div>
      <div className="grid gap-1">
        <label className="text-sm">Auditeeritav *</label>
        <input value={auditeeName} onChange={e=>setAuditeeName(e.target.value)} required className="border p-2 rounded" />
      </div>
      <div className="grid gap-1">
        <label className="text-sm">Alamosakond (valikuline)</label>
        <input value={subDept ?? ''} onChange={e=>setSubDept(e.target.value)} className="border p-2 rounded" />
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button onClick={save} disabled={!canSave || saving} className="px-4 py-2 rounded-2xl shadow">
        {saving ? 'Salvestan…' : 'Salvesta päis'}
      </button>
    </div>
  );
}
