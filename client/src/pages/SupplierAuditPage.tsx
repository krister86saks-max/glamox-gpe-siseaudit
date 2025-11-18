// client/src/pages/SupplierAuditPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
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

// abifunktsioon textarea automaatseks kõrguse muutmiseks
function autoResize(e: React.FormEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 400) + 'px'
}

// ehita payload auditist (kasutame nii POST kui PUT jaoks)
function buildTemplatePayload(audit: SupplierAudit, name: string) {
  return {
    name,
    points: audit.points.map(p => ({
      id: p.id,
      code: p.code,
      title: p.title,
      comment: '',
      subQuestions: p.subQuestions.map(s => ({
        id: s.id,
        text: s.text,
        type: s.type,
        options: s.options?.map(o => ({
          id: o.id,
          label: o.label,
          // salvestame skoori kui number
          score: (() => {
            const raw = (o as any).score
            if (raw === undefined || raw === null || raw === '') return 0
            const num = Number(raw)
            return Number.isFinite(num) ? num : 0
          })()
        }))
      }))
    }))
  }
}

export default function SupplierAuditPage({ token, role }: Props) {
  const [audit, setAudit] = useState<SupplierAudit | null>(null)

  const [templates, setTemplates] = useState<SupplierAuditTemplate[]>([])
  const [tplId, setTplId] = useState<string>('')

  const [images, setImages] = useState<Record<string, string[]>>({})

  // tühi draft
  useEffect(() => {
    const draft: SupplierAudit = {
      id: nanoid(),
      supplierName: '',
      date: new Date().toISOString(),
      auditor: '',
      points: [],
      status: 'draft',
    }
    setAudit(draft)
  }, [])

  // lae mallid serverist
  useEffect(() => {
    fetch('/api/supplier-audit-templates')
      .then(r => r.json())
      .then((list: SupplierAuditTemplate[]) => setTemplates(list))
      .catch(() => setTemplates([]))
  }, [])

  // --- skoori kokkuvõte (ainult MULTI küsimused) ---
  const scoreSummary = useMemo(() => {
    if (!audit) return { total: 0, max: 0 }

    let total = 0
    let max = 0

    for (const p of audit.points) {
      for (const sub of p.subQuestions) {
        if (sub.type !== 'multi' || !sub.options || sub.options.length === 0) continue

        const chosen = new Set(sub.answerOptions ?? [])

        const scores = sub.options.map(o => {
          const raw = (o as any).score
          const num = raw === undefined || raw === null || raw === '' ? 0 : Number(raw)
          return Number.isFinite(num) ? num : 0
        })

        if (scores.length) {
          max += Math.max(...scores)
        }

        sub.options.forEach((o, idx) => {
          if (chosen.has(o.id)) {
            total += scores[idx] ?? 0
          }
        })
      }
    }

    return { total, max }
  }, [audit])

  // rakenda mall
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
          options: s.options
            ? s.options.map(o => ({
                id: nanoid(),
                label: o.label,
                // skoori säilitame kui olemas
                score: (o as any).score,
              })) as any
            : undefined,
          answerText: undefined,
          answerOptions: undefined
        }))
      }
    }
    setAudit(a => a ? { ...a, points: tpl.points.map(clonePoint) } : a)
    setImages({})
  }

  // CRUD punktidele
  const addPoint = () => {
    if (!audit) return
    const p: SupplierAuditPoint = {
      id: nanoid(),
      title: 'Uus punkt',
      code: '',
      subQuestions: [],
      comment: ''
    }
    setAudit({ ...audit, points: [...audit.points, p] })
  }

  const updatePoint = (id: string, patch: Partial<SupplierAuditPoint>) => {
    if (!audit) return
    setAudit({
      ...audit,
      points: audit.points.map(p => p.id === id ? { ...p, ...patch } : p)
    })
  }

  const removePoint = (id: string) => {
    if (!audit) return
    setAudit({
      ...audit,
      points: audit.points.filter(p => p.id !== id)
    })
    setImages(prev => {
      const cp = { ...prev }
      delete cp[id]
      return cp
    })
  }

  // punktide järjekord (admin)
  const movePoint = (id: string, dir: -1 | 1) => {
    if (!audit) return
    const idx = audit.points.findIndex(p => p.id === id)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= audit.points.length) return
    const arr = [...audit.points]
    const [item] = arr.splice(idx, 1)
    arr.splice(newIdx, 0, item)
    setAudit({ ...audit, points: arr })
  }

  // alam-küsimused
  const addSub = (point: SupplierAuditPoint, type: QuestionType) => {
    const sub: SubQuestion = { id: nanoid(), text: 'Uus küsimus', type }
    updatePoint(point.id, { subQuestions: [...point.subQuestions, sub] })
  }

  const updateSub = (point: SupplierAuditPoint, id: string, patch: Partial<SubQuestion>) => {
    const subs = point.subQuestions.map(s => s.id === id ? { ...s, ...patch } : s)
    updatePoint(point.id, { subQuestions: subs })
  }

  const removeSub = (point: SupplierAuditPoint, id: string) => {
    const subs = point.subQuestions.filter(s => s.id !== id)
    updatePoint(point.id, { subQuestions: subs })
  }

  // pildid per punkt
  function addImages(pointId: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    Promise.all(list.map(f => new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = reject
      r.readAsDataURL(f)
    }))).then(urls => {
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

  // malli salvestamine (admin, UUS MALL – POST)
  async function saveAsTemplate() {
    if (role !== 'admin' || !token) {
      alert('Mallide salvestamine on lubatud ainult adminile (logi sisse).')
      return
    }
    if (!audit) return
    const name = window.prompt('Mallile nimi (nt "Supplier – Plastic Moulding")?')
    if (!name) return

    const payload = buildTemplatePayload(audit, name)

    const r = await fetch('/api/supplier-audit-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert('Malli salvestus ebaõnnestus: ' + (j.error || r.statusText))
      return
    }
    const tpl: SupplierAuditTemplate = await r.json()
    setTemplates(prev => [...prev, tpl])
    setTplId(tpl.id)
    alert('Uus mall salvestatud.')
  }

  // olemasoleva malli üle kirjutamine (admin, PUT)
  async function saveTemplateChanges() {
    if (role !== 'admin' || !token) {
      alert('Mallide salvestamine on lubatud ainult adminile (logi sisse).')
      return
    }
    if (!audit || !tplId) {
      alert('Vali esmalt mall, mida soovid uuendada.')
      return
    }

    const existing = templates.find(t => t.id === tplId)
    if (!existing) {
      alert('Valitud malli ei leitud.')
      return
    }

    if (!window.confirm(`Kas kirjutada mall "${existing.name}" üle?`)) return

    const payload = buildTemplatePayload(audit, existing.name)

    const r = await fetch('/api/supplier-audit-templates/' + tplId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert('Malli uuendamine ebaõnnestus: ' + (j.error || r.statusText))
      return
    }
    const updated: SupplierAuditTemplate = await r.json()
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
    alert('Malli muudatused salvestatud.')
  }

  // malli kustutamine (admin)
  async function deleteTemplate() {
    if (role !== 'admin' || !token) return
    if (!tplId) return
    if (!confirm('Kas kustutada valitud mall?')) return

    const r = await fetch('/api/supplier-audit-templates/' + tplId, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + token
      }
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert('Malli kustutamine ebaõnnestus: ' + (j.error || r.statusText))
      return
    }
    setTemplates(prev => prev.filter(t => t.id !== tplId))
    setTplId('')
    alert('Mall kustutatud.')
  }

  // poolik alla / üles
  function downloadPartial() {
    if (!audit) return
    const payload = { audit, images }
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
      alert('Poolik tarnijaaudit laetud.')
    } catch {
      alert('Pooliku auditi avamine ebaõnnestus.')
    }
  }

  function handlePrint() { window.print() }

  if (!audit) return null

  return (
    <div className="space-y-4">
      {/* Meta */}
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

      {/* Mallid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 no-print">
        <select
          className="border p-2 rounded"
          value={tplId}
          onChange={e => setTplId(e.target.value)}
        >
          <option value="">— Vali auditi liik —</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <button
          className="border p-2 rounded bg-green-100 border-green-600"
          disabled={!tplId}
          onClick={() => {
            const tpl = templates.find(t => t.id === tplId)
            if (tpl) applyTemplate(tpl)
          }}
        >
          Ava küsimustik
        </button>

        {role === 'admin' && (
          <>
            <button
              className="border p-2 rounded bg-black text-white"
              onClick={saveAsTemplate}
            >
              Salvesta mallina
            </button>
            <button
              className="border p-2 rounded"
              disabled={!tplId}
              onClick={saveTemplateChanges}
            >
              Salvesta muudatused
            </button>
            <button
              className="border p-2 rounded"
              disabled={!tplId}
              onClick={deleteTemplate}
            >
              Kustuta mall
            </button>
          </>
        )}

        {role !== 'admin' && (
          <button className="border p-2 rounded" onClick={handlePrint}>
            Salvesta PDF
          </button>
        )}
      </div>

      {role === 'admin' && (
        <div className="no-print">
          <button className="border p-2 rounded" onClick={handlePrint}>
            Salvesta PDF
          </button>
        </div>
      )}

      {/* Punktid */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Auditipunktid</h2>

        {role === 'admin' && (
          <button
            className="px-3 py-2 rounded bg-black text-white no-print"
            onClick={addPoint}
          >
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

              {role === 'admin' && (
                <div className="ml-auto flex gap-1 no-print">
                  <button
                    className="px-2 py-1 border rounded text-xs"
                    onClick={() => movePoint(point.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="px-2 py-1 border rounded text-xs"
                    onClick={() => movePoint(point.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="px-3 py-1 border rounded text-xs"
                    onClick={() => removePoint(point.id)}
                  >
                    Kustuta punkt
                  </button>
                </div>
              )}
            </div>

            {/* alam-küsimused */}
            <div className="space-y-3">
              {point.subQuestions.map(sub => (
                <div key={sub.id} className="border rounded-xl p-3">
                  <div className="flex gap-2 items-start">
                    <span className="text-xs px-2 py-1 border rounded">
                      {sub.type === 'open' ? 'OPEN' : 'MULTI'}
                    </span>
                    <textarea
                      className="border p-2 rounded flex-1 resize-y text-blue-700"
                      placeholder="Küsimuse tekst"
                      value={sub.text}
                      onInput={autoResize}
                      onChange={e => updateSub(point, sub.id, { text: e.target.value })}
                    />
                    {role === 'admin' && (
                      <button
                        className="px-2 py-1 border rounded no-print"
                        onClick={() => removeSub(point, sub.id)}
                      >
                        Kustuta
                      </button>
                    )}
                  </div>

                  {sub.type === 'multi' && (
                    <MultiOptionsEditor
                      sub={sub}
                      readonly={role !== 'admin'}
                      onChange={patch => updateSub(point, sub.id, patch)}
                    />
                  )}

                  {sub.type === 'open' && (
                    <textarea
                      className="border p-2 rounded w-full mt-2 resize-y"
                      placeholder="Vastus (vaba tekst)"
                      value={sub.answerText ?? ''}
                      onInput={autoResize}
                      onChange={e => updateSub(point, sub.id, { answerText: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* alam-küsimuste lisamise nupud */}
            {role === 'admin' && (
              <div className="mt-2 flex gap-2 no-print">
                <button
                  className="px-3 py-1 border rounded"
                  onClick={() => addSub(point, 'open')}
                >
                  + Küsimus
                </button>
                <button
                  className="px-3 py-1 border rounded"
                  onClick={() => addSub(point, 'multi')}
                >
                  + Valikvastustega
                </button>
              </div>
            )}

            {/* kommentaar */}
            <div className="mt-3">
              <label className="text-sm font-medium">Kommentaar</label>
              <textarea
                className="border p-2 rounded w-full mt-1 resize-y"
                rows={3}
                value={point.comment ?? ''}
                onInput={autoResize}
                onChange={e => updatePoint(point.id, { comment: e.target.value })}
              />
            </div>

            {/* pildid */}
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">Pildid</div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => addImages(point.id, e.target.files)}
                className="no-print"
              />
              {(images[point.id]?.length ?? 0) > 0 && (
                <div className="mt-2 grid md:grid-cols-2 gap-2">
                  {images[point.id]!.map((src, i) => (
                    <div key={i} className="border rounded p-1">
                      <img src={src} alt={`Foto ${i + 1}`} className="w-full h-auto" />
                      <div className="text-xs text-gray-600 mt-1">Foto {i + 1}</div>
                      <button
                        className="text-xs underline mt-1 no-print"
                        onClick={() => removeImage(point.id, i)}
                      >
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

      {/* skoori kokkuvõte */}
      {audit.points.length > 0 && (
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="font-semibold text-sm mb-1">
            Punktisumma (valikvastustega küsimused)
          </div>
          <div className="text-sm">
            Tulemus: <strong>{scoreSummary.total}</strong>
            {scoreSummary.max > 0 && (
              <> / <strong>{scoreSummary.max}</strong></>
            )}
          </div>
        </div>
      )}
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
    if (readonly) return
    onChange({
      options: [
        ...opts,
        { id: nanoid(), label: 'Uus valik', score: 0 } as any
      ] as any
    })
  }

  const setLabel = (id: string, label: string) => {
    if (readonly) return
    onChange({
      options: (sub.options ?? []).map(o =>
        o.id === id ? ({ ...o, label } as any) : o
      ) as any
    })
  }

  const setScore = (id: string, value: string) => {
    if (readonly) return
    const num = value === '' ? '' : Number(value)
    onChange({
      options: (sub.options ?? []).map(o =>
        o.id === id ? ({ ...o, score: num } as any) : o
      ) as any
    })
  }

  const toggle = (id: string) => {
    const chosen = new Set(sub.answerOptions ?? [])
    chosen.has(id) ? chosen.delete(id) : chosen.add(id)
    onChange({ answerOptions: Array.from(chosen) })
  }

  const remove = (id: string) => {
    if (readonly) return
    onChange({
      options: (sub.options ?? []).filter(o => o.id !== id) as any
    })
  }

  return (
    <div className="mt-2 space-y-2">
      {(sub.options ?? []).map(o => {
        const rawScore = (o as any).score
        const value =
          rawScore === undefined || rawScore === null ? '' : String(rawScore)

        return (
          <div key={o.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={(sub.answerOptions ?? []).includes(o.id)}
              onChange={() => toggle(o.id)}
            />
            <textarea
              className="border p-1 rounded flex-1 resize-y"
              value={o.label}
              onInput={autoResize}
              onChange={e => setLabel(o.id, e.target.value)}
              readOnly={readonly}
            />
            <input
              type="number"
              className="border p-1 rounded w-16 text-right"
              placeholder="pkt"
              value={value}
              onChange={e => setScore(o.id, e.target.value)}
              readOnly={readonly}
            />
            {!readonly && (
              <button
                className="px-2 py-1 border rounded no-print"
                onClick={() => remove(o.id)}
              >
                ×
              </button>
            )}
          </div>
        )
      })}
      {!readonly && (
        <button
          className="px-2 py-1 border rounded no-print"
          onClick={addOpt}
        >
          + Lisa valik
        </button>
      )}
    </div>
  )
}




