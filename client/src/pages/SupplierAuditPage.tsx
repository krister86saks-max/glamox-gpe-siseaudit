import React, { useEffect, useState, useMemo } from 'react'
import { nanoid } from 'nanoid'
import type {
  SupplierAudit,
  SupplierAuditPoint,
  SubQuestion,
  QuestionType,
  SupplierAuditTemplate
} from '../types/audit'

type Role = 'admin' | 'auditor' | 'external' | null

interface Props {
  token: string | null
  role: Role
}

export default function SupplierAuditPage({ token, role }: Props) {
  const [audit, setAudit] = useState<SupplierAudit | null>(null)

  // Mallid
  const [templates, setTemplates] = useState<SupplierAuditTemplate[]>([])
  const [tplId, setTplId] = useState<string>('')      // valitud malli ID
  const [tplName, setTplName] = useState<string>('')  // valitud malli nimi (muudetav)

  // Pildid per-punkt
  const [images, setImages] = useState<Record<string, string[]>>({})

  // Lisaväljad (hoian eraldi, et tüübid ei lendas)
  const [auditee, setAuditee] = useState<string>('')           // Auditeeritav
  const [summary, setSummary] = useState<string>('')           // Auditi kokkuvõte

  // tühi mustand
  useEffect(() => {
    const draft: SupplierAudit = {
      id: nanoid(),
      supplierName: '',
      date: new Date().toISOString(),
      auditor: '',
      points: [],
      status: 'draft'
    }
    setAudit(draft)
  }, [])

  // Lae mallid serverist
  useEffect(() => {
    fetch('/api/supplier-audit-templates')
      .then(r => r.json())
      .then((list: SupplierAuditTemplate[]) => setTemplates(list))
      .catch(() => setTemplates([]))
  }, [])

  // kui valin malli, pane ka nimi inputti (garanteeri string)
  useEffect(() => {
    const t = templates.find(x => x.id === tplId)
    setTplName(String(t?.name ?? ''))
  }, [tplId, templates])

  // util: ekraanilt audit -> malli struktuur (vastused eemaldame, skoorid alles)
  function auditToTemplatePayload(nameOverride?: string) {
    const name = (nameOverride ?? tplName ?? '').trim()
    return {
      name,
      points: (audit?.points || []).map(p => ({
        id: p.id,
        code: p.code,
        title: p.title,
        comment: '',
        subQuestions: p.subQuestions.map(s => ({
          id: s.id,
          text: s.text,
          type: s.type,
          options: (s.options || []).map(o => ({
            id: o.id,
            label: o.label,
            score: o.score ?? 0
          }))
        }))
      }))
    }
  }

  // rakenda mall auditisse (uued id-d alamatele, skoorid säilivad)
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
          options: s.options ? s.options.map(o => ({
            id: nanoid(),
            label: o.label,
            score: o.score ?? 0
          })) : undefined,
          answerText: undefined,
          answerOptions: undefined
        }))
      }
    }
    setAudit(a => (a ? { ...a, points: tpl.points.map(clonePoint) } : a))
    setImages({})
  }

  // Punktide CRUD
  const addPoint = () => {
    if (!audit) return
    const p: SupplierAuditPoint = { id: nanoid(), title: 'Uus punkt', code: '', subQuestions: [], comment: '' }
    setAudit({ ...audit, points: [...audit.points, p] })
  }
  const updatePoint = (id: string, patch: Partial<SupplierAuditPoint>) => {
    if (!audit) return
    setAudit({ ...audit, points: audit.points.map(p => (p.id === id ? { ...p, ...patch } : p)) })
  }
  const removePoint = (id: string) => {
    if (!audit) return
    setAudit({ ...audit, points: audit.points.filter(p => p.id !== id) })
    setImages(prev => {
      const cp = { ...prev }
      delete cp[id]
      return cp
    })
  }

  // Alam-küsimused
  const addSub = (point: SupplierAuditPoint, type: QuestionType) => {
    const sub: SubQuestion = { id: nanoid(), text: 'Uus küsimus', type }
    updatePoint(point.id, { subQuestions: [...point.subQuestions, sub] })
  }
  const updateSub = (point: SupplierAuditPoint, id: string, patch: Partial<SubQuestion>) => {
    const subs = point.subQuestions.map(s => (s.id === id ? { ...s, ...patch } : s))
    updatePoint(point.id, { subQuestions: subs })
  }
  const removeSub = (point: SupplierAuditPoint, id: string) => {
    const subs = point.subQuestions.filter(s => s.id !== id)
    updatePoint(point.id, { subQuestions: subs })
  }

  // Pildid
  function addImages(pointId: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    Promise.all(
      list.map(
        f =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader()
            r.onload = () => resolve(String(r.result))
            r.onerror = reject
            r.readAsDataURL(f)
          })
      )
    ).then(urls => {
      setImages(p => ({ ...p, [pointId]: [...(p[pointId] || []), ...urls] }))
    })
  }
  function removeImage(pointId: string, idx: number) {
    setImages(p => {
      const arr = [...(p[pointId] || [])]
      arr.splice(idx, 1)
      return { ...p, [pointId]: arr }
    })
  }

  // POST: loo uus mall
  async function saveAsTemplate() {
    if (role !== 'admin' || !token) {
      alert('Mallide salvestamine on lubatud ainult adminile (logi sisse).')
      return
    }
    if (!audit) return
    const ask = window.prompt('Uue malli nimi?') || ''
    const name = ask.trim()
    if (!name) return
    const payload = auditToTemplatePayload(name)
    const r = await fetch('/api/supplier-audit-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    })
    let j: any = {}
    try {
      j = await r.json()
    } catch {}
    if (!r.ok) return alert(j.error || r.statusText)
    setTemplates(prev => [...prev, j])
    setTplId(j.id)
    setTplName(j.name)
    alert('Uus mall salvestatud.')
  }

  // PUT: kirjuta valitud mall üle
  async function saveSelectedTemplate() {
    if (role !== 'admin' || !token) {
      alert('Vajalik admini sisselogimine.')
      return
    }
    if (!tplId) return alert('Vali esmalt mall.')
    const payload = auditToTemplatePayload()
    const r = await fetch(`/api/supplier-audit-templates/${tplId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    })
    let j: any = {}
    try {
      j = await r.json()
    } catch {}
    if (!r.ok) return alert(j.error || r.statusText)
    setTemplates(prev => prev.map(t => (t.id === j.id ? j : t)))
    alert('Mall uuendatud.')
  }

  // DELETE: kustuta valitud mall
  async function deleteSelectedTemplate() {
    if (role !== 'admin' || !token) {
      alert('Vajalik admini sisselogimine.')
      return
    }
    if (!tplId) return alert('Vali esmalt mall.')
    if (!confirm('Kustutan malli?')) return
    const r = await fetch(`/api/supplier-audit-templates/${tplId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    })
    let j: any = {}
    try {
      j = await r.json()
    } catch {}
    if (!r.ok) return alert(j.error || r.statusText)
    setTemplates(prev => prev.filter(t => t.id !== tplId))
    setTplId('')
    setTplName('')
    alert('Mall kustutatud.')
  }

  // poolik alla / üles — lisame auditee + summary ka
  function downloadPartial() {
    if (!audit) return
    const payload = { audit, auditee, summary, images }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `supplier-audit-draft-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  async function openPartial(file: File) {
    try {
      const text = await file.text()
      const j = JSON.parse(text)
      if (!j || !j.audit) throw new Error('vale fail')
      setAudit(j.audit as SupplierAudit)
      setImages(j.images || {})
      setAuditee(j.auditee || '')
      setSummary(j.summary || '')
      alert('Poolik tarnijaaudit laetud.')
    } catch {
      alert('Pooliku auditi avamine ebaõnnestus.')
    }
  }

  function handlePrint() {
    window.print()
  }

  // Skooride arvutus
  const { totalScore, maxScore } = useMemo(() => {
    let total = 0
    let max = 0
    if (!audit) return { totalScore: 0, maxScore: 0 }

    for (const p of audit.points) {
      for (const s of p.subQuestions) {
        if (s.type !== 'multi' || !s.options || s.options.length === 0) continue

        const scores = s.options.map(o => o.score ?? 0)
        const maxForQuestion = scores.length ? Math.max(...scores) : 0
        max += maxForQuestion

        const selectedIds = new Set(s.answerOptions ?? [])
        for (const o of s.options) {
          if (selectedIds.has(o.id)) {
            total += o.score ?? 0
          }
        }
      }
    }
    return { totalScore: total, maxScore: max }
  }, [audit])

  if (!audit) return null

  const isOpen = (audit.points?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      {/* Päise väljad */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          className="border p-2 rounded"
          placeholder="Tarnija nimi"
          value={audit.supplierName}
          onChange={e => setAudit({ ...audit, supplierName: e.target.value })}
        />
        <input
          className="border p-2 rounded"
          placeholder="Audiitor"
          value={audit.auditor}
          onChange={e => setAudit({ ...audit, auditor: e.target.value })}
        />
        <input
          className="border p-2 rounded"
          placeholder="Auditeeritav"
          value={auditee}
          onChange={e => setAuditee(e.target.value)}
        />
        <input
          className="border p-2 rounded"
          type="date"
          value={audit.date.slice(0, 10)}
          onChange={e => setAudit({ ...audit, date: new Date(e.target.value).toISOString() })}
        />

        <button className="border p-2 rounded no-print" onClick={downloadPartial}>
          Lae alla poolik audit
        </button>
        <label className="border p-2 rounded text-center cursor-pointer no-print">
          Ava poolik audit
          <input
            type="file"
            className="hidden"
            accept="application/json"
            onChange={e => e.target.files && openPartial(e.target.files[0])}
          />
        </label>
      </div>

      {/* Mallid / tegevused */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center no-print">
        <select className="border p-2 rounded md:col-span-2" value={tplId} onChange={e => setTplId(e.target.value)}>
          <option value="">— Vali auditi liik —</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <input
          className="border p-2 rounded"
          placeholder="Malli nimi (muudetav)"
          value={tplName}
          onChange={e => setTplName(e.target.value)}
          disabled={!tplId || role !== 'admin'}
        />

        {/* Ava / Sulge audit nupp (heleroheline) */}
        <button
          className="border p-2 rounded bg-green-100 border-green-600"
          disabled={!tplId && !isOpen}
          onClick={() => {
            if (isOpen) {
              setAudit(a => (a ? { ...a, points: [] } : a))
              setImages({})
            } else {
              const tpl = templates.find(t => t.id === tplId)
              if (tpl) applyTemplate(tpl)
            }
          }}
        >
          {isOpen ? 'Sulge audit' : 'Ava küsimustik'}
        </button>

        {role === 'admin' && (
          <>
            <button className="border p-2 rounded bg-black text-white" onClick={saveAsTemplate}>
              Salvesta mallina
            </button>
            <button className="border p-2 rounded" disabled={!tplId} onClick={saveSelectedTemplate}>
              Salvesta valitud
            </button>
            <button className="border p-2 rounded text-red-700" disabled={!tplId} onClick={deleteSelectedTemplate}>
              Kustuta mall
            </button>
          </>
        )}

        <button className="px-3 py-2 rounded bg-gray-700 text-white border border-gray-700 no-print" onClick={handlePrint}>
          Salvesta PDF
        </button>
      </div>

      {/* Punktid */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Auditipunktid</h2>
        {role === 'admin' && (
          <button className="px-3 py-2 rounded bg-black text-white no-print" onClick={addPoint}>
            + Lisa punkt
          </button>
        )}
      </div>

      <div className="space-y-6">
        {audit.points.map(point => (
          <div key={point.id} className="border rounded-2xl p-4 shadow-sm">
            <div className="flex gap-2 items-center mb-2">
              <input
                className="border p-2 rounded w-24"
                placeholder="Kood"
                value={point.code ?? ''}
                onChange={e => updatePoint(point.id, { code: e.target.value })}
              />
              <input
                className="border p-2 rounded flex-1 font-semibold"
                placeholder="Punkti pealkiri"
                value={point.title}
                onChange={e => updatePoint(point.id, { title: e.target.value })}
              />
              <div className="ml-auto flex gap-2">
                {role === 'admin' && (
                  <>
                    <button className="px-3 py-1 border rounded no-print" onClick={() => addSub(point, 'open')}>
                      + Küsimus
                    </button>
                    <button className="px-3 py-1 border rounded no-print" onClick={() => addSub(point, 'multi')}>
                      + Valikvastustega
                    </button>
                    <button className="px-3 py-1 border rounded no-print" onClick={() => removePoint(point.id)}>
                      Kustuta punkt
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* alam-küsimused */}
            <div className="space-y-3">
              {point.subQuestions.map(sub => (
                <div key={sub.id} className="border rounded-xl p-3">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs px-2 py-1 border rounded">{sub.type === 'open' ? 'OPEN' : 'MULTI'}</span>
                    <input
                      className="border p-2 rounded flex-1"
                      placeholder="Küsimuse tekst"
                      value={sub.text}
                      onChange={e => updateSub(point, sub.id, { text: e.target.value })}
                    />
                    {role === 'admin' && (
                      <button className="px-2 py-1 border rounded no-print" onClick={() => removeSub(point, sub.id)}>
                        Kustuta
                      </button>
                    )}
                  </div>

                  {sub.type === 'multi' && (
                    <MultiOptionsEditor sub={sub} readonly={role !== 'admin'} onChange={patch => updateSub(point, sub.id, patch)} />
                  )}

                  {sub.type === 'open' && (
                    <input
                      className="border p-2 rounded w-full mt-2"
                      placeholder="Vastus (vaba tekst)"
                      value={sub.answerText ?? ''}
                      onChange={e => updateSub(point, sub.id, { answerText: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* kommentaar */}
            <div className="mt-3">
              <label className="text-sm font-medium">Kommentaar</label>
              <textarea
                className="border p-2 rounded w-full mt-1"
                rows={3}
                value={point.comment ?? ''}
                onChange={e => updatePoint(point.id, { comment: e.target.value })}
              />
            </div>

            {/* pildid */}
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">Pildid</div>
              <input type="file" accept="image/*" multiple onChange={e => addImages(point.id, e.target.files)} className="no-print" />
              {(images[point.id]?.length ?? 0) > 0 && (
                <div className="mt-2 grid md:grid-cols-2 gap-2">
                  {images[point.id]!.map((src, i) => (
                    <div key={i} className="border rounded p-1">
                      <img src={src} alt={`Foto ${i + 1}`} className="w-full h-auto" />
                      <div className="text-xs text-gray-600 mt-1">Foto {i + 1}</div>
                      <button className="text-xs underline mt-1 no-print" onClick={() => removeImage(point.id, i)}>
                        Eemalda
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Punktisummad */}
      {maxScore > 0 && (
        <div className="border rounded-2xl p-4">
          <h3 className="text-lg font-semibold mb-2">Punktisumma</h3>
          <p>
            Skoor: <strong>{totalScore}</strong> / <strong>{maxScore}</strong>
            {maxScore > 0 && (
              <>
                {' '}(
                {Math.round((totalScore / maxScore) * 100)}
                %)
              </>
            )}
          </p>
        </div>
      )}

      {/* Auditi kokkuvõte */}
      <div className="border rounded-2xl p-4">
        <h3 className="text-lg font-semibold mb-2">Auditi kokkuvõte</h3>
        <textarea
          className="border rounded w-full p-2 min-h-[120px]"
          placeholder="Kirjelda auditi üldist tulemust, riskikohti, leitud tugevusi jne."
          value={summary}
          onChange={e => setSummary(e.target.value)}
        />
      </div>
    </div>
  )
}

function MultiOptionsEditor({
  sub,
  onChange,
  readonly
}: {
  sub: SubQuestion
  onChange: (p: Partial<SubQuestion>) => void
  readonly?: boolean
}) {
  const opts = sub.options ?? []
  const addOpt = () => {
    if (!readonly) onChange({ options: [...opts, { id: nanoid(), label: 'Uus valik', score: 0 }] })
  }
  const setLabel = (id: string, label: string) => {
    if (!readonly) onChange({ options: (sub.options ?? []).map(o => (o.id === id ? { ...o, label } : o)) })
  }
  const setScore = (id: string, scoreStr: string) => {
    if (readonly) return
    const val = Number(scoreStr.replace(',', '.'))
    const score = isNaN(val) ? 0 : val
    onChange({
      options: (sub.options ?? []).map(o => (o.id === id ? { ...o, score } : o))
    })
  }
  const toggle = (id: string) => {
    const chosen = new Set(sub.answerOptions ?? [])
    if (chosen.has(id)) chosen.delete(id)
    else chosen.add(id)
    onChange({ answerOptions: Array.from(chosen) })
  }
  const remove = (id: string) => {
    if (!readonly) onChange({ options: (sub.options ?? []).filter(o => o.id !== id) })
  }

  return (
    <div className="mt-2 space-y-2">
      {(sub.options ?? []).map(o => (
        <div key={o.id} className="flex items-center gap-2">
          <input type="checkbox" checked={(sub.answerOptions ?? []).includes(o.id)} onChange={() => toggle(o.id)} />
          <input
            className="border p-1 rounded flex-1"
            value={o.label}
            onChange={e => setLabel(o.id, e.target.value)}
            readOnly={readonly}
            placeholder="Valiku tekst"
          />
          <input
            className="border p-1 rounded w-20 text-right"
            type="number"
            min={0}
            step={1}
            value={o.score ?? 0}
            onChange={e => setScore(o.id, e.target.value)}
            readOnly={readonly}
            placeholder="Skoor"
          />
          {!readonly && (
            <button className="px-2 py-1 border rounded no-print" onClick={() => remove(o.id)}>
              ×
            </button>
          )}
        </div>
      ))}
      {!readonly && (
        <button className="px-2 py-1 border rounded no-print" onClick={addOpt}>
          + Lisa valik
        </button>
      )}
    </div>
  )
}

