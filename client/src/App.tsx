import React, { useEffect, useMemo, useState } from 'react'

type Std = '9001' | '14001' | '45001'
type Question = { id: string; text: string; clause?: string; stds: Std[]; guidance?: string }
type Department = { id: string; name: string; questions: Question[] }
type Schema = { meta: { version: string; org: string }; departments: Department[] }
type Answer = { vs?: boolean; pe?: boolean; mv?: boolean; evidence?: string; note?: string }

const API = (import.meta.env.VITE_API_URL ?? window.location.origin)

export default function App() {
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<'admin' | 'auditor' | 'external' | null>(null)
  const [schema, setSchema] = useState<Schema | null>(null)

  // protsess valitakse käsitsi
  const [deptId, setDeptId] = useState<string>('')

  // küsimustiku avamine/sulgemine
  const [questionsOpen, setQuestionsOpen] = useState(false)

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [stds, setStds] = useState<Std[]>(['9001', '14001', '45001'])
  const [query, setQuery] = useState('')

  // pildid per-küsimus (dataURL-id)
  const [images, setImages] = useState<Record<string, string[]>>({})

  // Päis
  const [date, setDate] = useState<string>(() => {
    const d = new Date()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mm}-${dd}`
  })
  const [auditor, setAuditor] = useState('')
  const [auditee, setAuditee] = useState('')
  const [auditeeTitle, setAuditeeTitle] = useState('')
  const [subDept, setSubDept] = useState('')

  const [qEdit, setQEdit] = useState<{
    mode: 'add' | 'edit',
    id: string,
    department_id: string,
    text: string,
    clause: string,
    stds: string,
    guidance: string
  }>({ mode: 'add', id: '', department_id: '', text: '', clause: '', stds: '9001', guidance: '' })
  const [depEdit, setDepEdit] = useState<{ id: string; name: string }>({ id: '', name: '' })

  async function refreshSchema() {
    const s: Schema = await fetch(API + '/api/schema').then(r => r.json())
    setSchema(s)
  }
  useEffect(() => { refreshSchema() }, [])

  async function login(email: string, password: string) {
    const r = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const j = await r.json()
    if (r.ok) { setToken(j.token); setRole(j.role) } else alert(j.error || 'login failed')
  }

  const dept = schema?.departments.find(d => d.id === deptId)

  const deptStandards = useMemo<Std[]>(() => {
    if (!dept) return []
    const set = new Set<Std>()
    for (const q of dept.questions) for (const s of q.stds) set.add(s)
    return Array.from(set).sort() as Std[]
  }, [dept])

  const visible = useMemo(() => {
    if (!dept) return []
    const active = new Set(stds)
    let qs = dept.questions.filter(q => q.stds.some(x => active.has(x)))
    const qq = query.trim().toLowerCase()
    if (qq) qs = qs.filter(q => [q.id, q.text, q.clause || '', dept?.name].join(' ').toLowerCase().includes(qq))
    return qs
  }, [dept, stds, query])

  // Kokkuvõtte read (PE/MV)
  const summary = useMemo(() => {
    if (!dept) return []
    const all = dept.questions
    return all
      .map(q => ({ q, a: answers[q.id] }))
      .filter(x => x.a && (x.a.mv || x.a.pe) && (x.a.note?.trim() || x.a.evidence?.trim()))
      .map(x => ({
        id: x.q.id,
        clause: x.q.clause || '',
        type: x.a!.mv ? 'Mittevastavus' : 'Parendusettepanek',
        content: (x.a!.note?.trim() || x.a!.evidence || '').trim(),
        stds: x.q.stds
      }))
  }, [dept, answers])

  // --- util ---
  function autoResize(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 1000) + 'px'
  }
  function handlePrint() { window.print() }

  // --- Admin POST/PUT/DEL helpers (used also by JSON import) ---
  async function api<T=any>(url: string, method: string, body?: any): Promise<{ok:boolean; status:number; json:T|any}> {
    const r = await fetch(API + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined
    })
    let j:any = null
    try { j = await r.json() } catch { /* ignore */ }
    return { ok: r.ok, status: r.status, json: j }
  }

  // --- Backend SCHEMA export/import (admin) ---
  async function exportSchemaJSON() {
    const s = await fetch(API + '/api/schema').then(r => r.json())
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `schema-export-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // UPSERT: PUT, kui 404 siis POST
  async function upsertDepartment(dep: {id:string; name:string}) {
    let r = await api('/api/departments/' + dep.id, 'PUT', { name: dep.name })
    if (r.status === 404) r = await api('/api/departments', 'POST', dep)
    if (!r.ok && r.status !== 400) throw new Error(r.json?.error || 'department upsert failed')
  }
  async function upsertQuestion(q: Question, department_id: string) {
    const payload = { id: q.id, department_id, text: q.text, clause: q.clause ?? '', stds: q.stds, guidance: q.guidance ?? '' }
    let r = await api('/api/questions/' + q.id, 'PUT', payload)
    if (r.status === 404) r = await api('/api/questions', 'POST', payload)
    if (!r.ok && r.status !== 400) throw new Error(r.json?.error || 'question upsert failed')
  }

  async function importSchemaJSON(file: File) {
    if (!token || role !== 'admin') { alert('Vajalik admini sisselogimine.'); return }
    try {
      const text = await file.text()
      const data: Schema = JSON.parse(text)

      for (const d of data.departments) {
        await upsertDepartment({ id: d.id, name: d.name })
        for (const q of d.questions) {
          await upsertQuestion(q as Question, d.id)
        }
      }
      await refreshSchema()
      alert('Import õnnestus.')
    } catch (e:any) {
      console.error(e)
      alert('Import ebaõnnestus')
    }
  }

  // --- Partial audit: save/load locally ---
  function downloadPartial() {
    const payload = {
      header: { date, auditor, auditee, auditeeTitle, subDept, deptId, stds },
      answers,
      images
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `poolik-audit-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  async function openPartial(file: File) {
    try {
      const text = await file.text()
      const j = JSON.parse(text)
      const h = j.header || {}
      setDate(h.date || date)
      setAuditor(h.auditor || '')
      setAuditee(h.auditee || '')
      setAuditeeTitle(h.auditeeTitle || '')
      setSubDept(h.subDept || '')
      setDeptId(h.deptId || '')
      setStds(h.stds || ['9001','14001','45001'])
      setAnswers(j.answers || {})
      setImages(j.images || {})
      setQuestionsOpen(Boolean(h.deptId))
      alert('Poolik audit laetud.')
    } catch {
      alert('Pooliku auditi avamine ebaõnnestus')
    }
  }

  // --- Pildid (alla tõendite/märkuse) ---
  function addImages(qid: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    Promise.all(list.map(f => new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = reject
      r.readAsDataURL(f)
    }))).then(urls => {
      setImages(p => ({ ...p, [qid]: [...(p[qid]||[]), ...urls] }))
    })
  }
  function removeImage(qid: string, idx: number) {
    setImages(p => {
      const arr = [...(p[qid]||[])]
      arr.splice(idx,1)
      return { ...p, [qid]: arr }
    })
  }

  async function post(url: string, body: any, method = 'POST') {
    const r = await fetch(API + url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
    const j = await r.json(); if (!r.ok) alert(j.error || 'error'); else await refreshSchema()
  }
  async function del(url: string) {
    const r = await fetch(API + url, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    const j = await r.json(); if (!r.ok) alert(j.error || 'error'); else await refreshSchema()
  }

  function startEditQuestion(q: Question) {
    setQEdit({ mode: 'edit', id: q.id, department_id: deptId, text: q.text, clause: q.clause || '', stds: q.stds.join(' '), guidance: q.guidance || '' })
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* print-spetsiifiline CSS */}
      <style>{`
        /* ekraanil peida print-only plokid */
        @media screen { .print-only { display:none } }
        /* prindis peida textarea ja teised ekraaniplokid, näita print-only sisu */
        @media print {
          .no-print { display: none !important; }
          .hide-in-print { display: none !important; }
          .print-only { display: block !important; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .no-break { break-inside: avoid; page-break-inside: avoid; }
          textarea { border: 1px solid #000 !important; overflow: visible !important; }
          select, input { border: 1px solid #000 !important; }

          /* kõrgused */
          .ev-field   { min-height: 8rem !important; }
          .note-field { min-height: 15rem !important; } /* 12rem -> +25% = 15rem */

          /* prindis asendame textarea plokitekstiga, mis murdub lehtede vahel */
          .textarea-print { white-space: pre-wrap; border:1px solid #000; border-radius:.25rem; padding:.25rem .5rem; }

          /* pildid täislaiuses, ei poolitu */
          .img-print { width: 100% !important; height: auto !important; }

          /* QA-plokk prindis alati vertikaalselt (Märkus tõendite all) */
          .qa-fields { display: block !important; }

          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <header className="flex items-center gap-3">
        <img src="/logo.webp" className="h-12" alt="Glamox" />
        <h1 className="text-2xl font-bold">Glamox GPE Siseaudit</h1>
        <div className="ml-auto flex items-center gap-2 no-print">
          {!token ? (
            <LoginForm defaultEmail="" defaultPass="" onLogin={login} />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm px-2 py-1 border rounded">Role: {role}</span>
              <button className="px-2 py-1 border rounded" onClick={() => { setToken(null); setRole(null); }}>Logi välja</button>
            </div>
          )}
        </div>
      </header>

      <div className="mt-4" />

      {/* Päis */}
      <section className="mb-3 p-3 border rounded">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="hdr-date" className="block text-xs font-semibold">Kuupäev *</label>
            <input id="hdr-date" type="date" className="w-full border rounded px-2 py-1" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="hdr-auditor" className="block text-xs font-semibold">Auditeerija nimi *</label>
            <input id="hdr-auditor" className="w-full border rounded px-2 py-1" placeholder="nimi" value={auditor} onChange={e => setAuditor(e.target.value)} />
          </div>
          <div>
            <label htmlFor="hdr-auditee" className="block text-xs font-semibold">Auditeeritav *</label>
            <input id="hdr-auditee" className="w-full border rounded px-2 py-1" placeholder="nimi" value={auditee} onChange={e => setAuditee(e.target.value)} />
          </div>
          <div>
            <label htmlFor="hdr-title" className="block text-xs font-semibold">Amet *</label>
            <input id="hdr-title" className="w-full border rounded px-2 py-1" placeholder="amet" value={auditeeTitle} onChange={e => setAuditeeTitle(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold">Auditeeritav protsess</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={deptId}
              onChange={e => { setDeptId(e.target.value); setQuestionsOpen(false) }}
              disabled={!schema}
            >
              <option value="">— Vali protsess —</option>
              {schema?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="hdr-subdept" className="block text-xs font-semibold">Alamosakond (kui kohandub)</label>
            <input id="hdr-subdept" className="w-full border rounded px-2 py-1" placeholder="nt alamosakond" value={subDept} onChange={e => setSubDept(e.target.value)} />
          </div>

          {dept && (
            <div className="md:col-span-2">
              <div className="block text-xs font-semibold">Kohaldatavad standardid</div>
              <div className="mt-1 flex gap-2 flex-wrap">
                {deptStandards.length === 0
                  ? <span className="text-xs text-gray-500">–</span>
                  : deptStandards.map(s => (
                    <span key={s} className={
                      'text-xs border rounded px-2 py-0.5 ' +
                      (s==='9001' ? 'bg-blue-100 border-blue-600' :
                       s==='14001' ? 'bg-green-100 border-green-600' :
                       'bg-red-100 border-red-600')
                    }>ISO {s}</span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* --- NUPUD: Pärast päist --- */}
      <div className="mb-3 flex gap-2 items-center no-print">
        <button
          className="px-3 py-1 border rounded bg-green-100 border-green-600"
          disabled={!deptId}
          onClick={() => setQuestionsOpen(v => !v)}
          title={!deptId ? 'Vali enne protsess' : ''}
        >
          {questionsOpen ? 'Sulge küsimustik' : 'Ava küsimustik'}
        </button>

        <button className="px-3 py-1 border rounded" onClick={downloadPartial}>Laadi alla poolik audit</button>

        <label className="px-3 py-1 border rounded cursor-pointer">
          Ava poolik audit
          <input
            type="file"
            className="hidden"
            accept="application/json"
            onChange={e => e.target.files && openPartial(e.target.files[0])}
          />
        </label>

        <div className="ml-auto" />
        <button className="px-3 py-1 border rounded" onClick={handlePrint}>Salvesta PDF</button>
      </div>

      {!schema ? <div>Laen skeemi...</div> : (
        <div className="grid md:grid-cols-4 gap-4">
          {/* Vasak külgriba */}
          <div className="space-y-3 no-print">
            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Standard</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {(['9001', '14001', '45001'] as Std[]).map(s => (
                  <button
                    key={s}
                    className={'px-3 py-1 text-sm rounded border ' + (stds.includes(s) ? 'bg-black text-white' : '')}
                    onClick={() => setStds(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  >
                    ISO {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Otsi</label>
              <input className="w-full border rounded px-2 py-1" value={query} onChange={e => setQuery(e.target.value)} placeholder="küsimus, klausel..." />
            </div>

            {role === 'admin' && (
              <div className="p-3 border rounded space-y-3">
                <div className="font-semibold">Redigeerimine</div>

                <div>
                  <div className="text-xs">Protsess</div>
                  <input className="border rounded px-2 py-1 mr-2" placeholder="id (nt ostmine)" value={depEdit.id} onChange={e => setDepEdit({ ...depEdit, id: e.target.value })} />
                  <input className="border rounded px-2 py-1 mr-2" placeholder="nimetus" value={depEdit.name} onChange={e => setDepEdit({ ...depEdit, name: e.target.value })} />
                  <div className="mt-1 space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={() => post('/api/departments', { id: depEdit.id, name: depEdit.name })}>Lisa</button>
                    <button className="px-2 py-1 border rounded" onClick={() => post('/api/departments/' + depEdit.id, { name: depEdit.name }, 'PUT')}>Muuda</button>
                    <button className="px-2 py-1 border rounded" onClick={() => del('/api/departments/' + depEdit.id)}>Kustuta</button>
                  </div>
                </div>

                <div>
                  <div className="text-xs">Küsimus ({qEdit.mode === 'add' ? 'lisa' : 'muuda'}):</div>
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="küsimuse id (nt Q-100)" value={qEdit.id} onChange={e => setQEdit({ ...qEdit, id: e.target.value })} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="department_id" value={qEdit.department_id || deptId} onChange={e => setQEdit({ ...qEdit, department_id: e.target.value })} />
                  <textarea className="border rounded px-2 py-1 w-full mb-1" placeholder="küsimuse tekst" value={qEdit.text} onChange={e => setQEdit({ ...qEdit, text: e.target.value })} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="Standardi nõue (klausel)" value={qEdit.clause} onChange={e => setQEdit({ ...qEdit, clause: e.target.value })} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="Standard (nt 9001 14001)" value={qEdit.stds} onChange={e => setQEdit({ ...qEdit, stds: e.target.value })} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="Juhend auditeerijale" value={qEdit.guidance} onChange={e => setQEdit({ ...qEdit, guidance: e.target.value })} />
                  <div className="space-x-2">
                    {qEdit.mode === 'add' ? (
                      <button className="px-2 py-1 border rounded" onClick={()=>post('/api/questions', { id: qEdit.id, department_id: qEdit.department_id || deptId, text: qEdit.text, clause: qEdit.clause, stds: qEdit.stds.split(' '), guidance: qEdit.guidance })}>Lisa küsimus</button>
                    ) : (
                      <>
                        <button className="px-2 py-1 border rounded" onClick={()=>post('/api/questions/'+qEdit.id, { department_id: qEdit.department_id || deptId, text: qEdit.text, clause: qEdit.clause, stds: qEdit.stds.split(' '), guidance: qEdit.guidance }, 'PUT')}>Salvesta</button>
                        <button className="px-2 py-1 border rounded" onClick={()=>{ setQEdit({mode:'add', id:'', department_id:'', text:'', clause:'', stds:'9001', guidance:''}) }}>Tühista</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Backend schema varundus/taastus */}
                <div className="border-t pt-2">
                  <div className="text-xs font-semibold mb-1">Varunda / taasta (JSON)</div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 border rounded" onClick={exportSchemaJSON}>Ekspordi JSON</button>
                    <label className="px-2 py-1 border rounded cursor-pointer">
                      Impordi JSON
                      <input type="file" className="hidden" accept="application/json"
                        onChange={e => e.target.files && importSchemaJSON(e.target.files[0])}/>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Põhisisu */}
          <div className="md:col-span-3 space-y-3">
            {!deptId ? (
              <div>Vali protsess päisest, seejärel vajuta “Ava küsimustik”.</div>
            ) : !questionsOpen ? (
              <div>Vajuta ülal olevale nupule “Ava küsimustik”.</div>
            ) : !dept ? (
              <div>Laen protsessi andmeid…</div>
            ) : visible.length === 0 ? (
              <div>Selles protsessis ei leitud sobivaid küsimusi (kontrolli valitud standardeid või otsingut).</div>
            ) : (
              visible.map((q) => {
                const a = answers[q.id] || {}
                const imgs = images[q.id] || []
                return (
                  <div key={q.id} className="p-3 border rounded print-avoid-break">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs border px-2 py-0.5 rounded">{q.id}</span>
                      {q.stds?.length > 0 && q.stds.map(s => (
                        <span key={s} className={
                          'text-xs border px-2 py-0.5 rounded ' +
                          (s==='9001' ? 'bg-blue-100 border-blue-600' :
                           s==='14001' ? 'bg-green-100 border-green-600' :
                           'bg-red-100 border-red-600')
                        }>ISO {s}</span>
                      ))}
                      {q.clause && <span className="text-xs border px-2 py-0.5 rounded">Standardi nõue: {q.clause}</span>}
                      <span className="ml-auto flex items-center gap-1">
                        {a.mv && <Excl color="red" title="Mittevastavus" />}
                        {!a.mv && a.pe && <Excl color="blue" title="Parendusettepanek" />}
                        {!a.mv && a.vs && <Check color="green" title="Vastab standardile" />}
                      </span>
                    </div>

                    <div className="mt-2">{q.text}</div>
                    {q.guidance && <div className="text-xs text-gray-600 mt-1">Juhend auditeerijale: {q.guidance}</div>}

                    {/* Staatuse checkboxid */}
                    <div className="mt-2 flex gap-3 flex-wrap items-center">
                      <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={!!a.vs}
                          onChange={() =>
                            setAnswers(p => {
                              const cur = p[q.id] || {}
                              const next = { ...cur, vs: !cur.vs }
                              if (next.vs) next.mv = false
                              return { ...p, [q.id]: next }
                            })
                          }
                        />
                        Vastab standardile
                      </label>

                      <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={!!a.pe}
                          onChange={() =>
                            setAnswers(p => {
                              const cur = p[q.id] || {}
                              const next = { ...cur, pe: !cur.pe }
                              if (next.pe) next.mv = false
                              return { ...p, [q.id]: next }
                            })
                          }
                        />
                        Parendusettepanek
                      </label>

                      <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={!!a.mv}
                          onChange={() =>
                            setAnswers(p => {
                              const cur = p[q.id] || {}
                              const next = { ...cur, mv: !cur.mv }
                              if (next.mv) { next.vs = false; next.pe = false }
                              return { ...p, [q.id]: next }
                            })
                          }
                        />
                        Mittevastavus
                      </label>
                    </div>

                    {/* Tõendid (üleval) + Märkus (otse all) — vertikaalne paigutus */}
                    <div className="mt-2 space-y-2 qa-fields">
                      <div>
                        <div className="text-xs font-semibold mb-1">Tõendid</div>
                        {/* ekraanil textarea */}
                        <textarea
                          className="border rounded px-2 py-1 w-full min-h-32 resize-y ev-field hide-in-print"
                          placeholder="Tõendid"
                          value={a.evidence || ''}
                          onInput={autoResize}
                          onChange={e => setAnswers(p => ({ ...p, [q.id]: { ...p[q.id], evidence: e.target.value } }))}
                        />
                        {/* prindis tekstiplokk – murdub lehtede vahel */}
                        <div className="print-only textarea-print ev-field">{a.evidence || ''}</div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold mb-1">Märkus: PE/MV</div>
                        {/* ekraanil textarea */}
                        <textarea
                          id={'note-' + q.id}
                          className={
                            'border rounded px-2 py-1 w-full min-h-32 resize-y note-field hide-in-print ' +
                            (((a.mv || a.pe) && !(a.note && a.note.trim())) ? 'border-red-500 ring-1 ring-red-300' : '')
                          }
                          placeholder={((a.mv || a.pe) && !(a.note && a.note.trim())) ? 'Märkus: PE/MV (kohustuslik)' : 'Märkus: PE/MV'}
                          value={a.note || ''}
                          onInput={autoResize}
                          onChange={e => setAnswers(p => ({ ...p, [q.id]: { ...p[q.id], note: e.target.value } }))}
                        />
                        {/* prindis tekstiplokk – murdub lehtede vahel */}
                        <div className="print-only textarea-print note-field">{a.note || ''}</div>
                      </div>
                    </div>

                    {/* PILDID – allpool tõenditest/märkustest */}
                    <div className="mt-2">
                      <div className="text-xs font-semibold mb-1">Lisa pilt</div>
                      <input type="file" accept="image/*" multiple onChange={e => addImages(q.id, e.target.files)} className="no-print" />
                      {imgs.length > 0 && (
                        <div className="mt-2 grid md:grid-cols-2 gap-2">
                          {imgs.map((src, i) => (
                            <div key={i} className="border rounded p-1 no-break">
                              <img src={src} alt={`Foto ${i+1}`} className="w-full h-auto img-print" />
                              <div className="text-xs text-gray-600 mt-1">Foto {i+1}</div>
                              <button className="no-print text-xs underline mt-1" onClick={() => removeImage(q.id, i)}>Eemalda</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}

            {/* KOKKUVÕTE */}
            {questionsOpen && summary.length > 0 && (
              <div className="p-3 border rounded print-avoid-break">
                <div className="font-semibold mb-2">Kokkuvõte — Parendusettepanekud ja Mittevastavused</div>
                <div className="space-y-2">
                  {summary.map((s, idx) => (
                    <div key={idx} className="text-sm border rounded p-2">
                      <div className="flex flex-wrap gap-2 text-xs mb-1">
                        <span className="border px-2 py-0.5 rounded">Küsimus: {s.id}</span>
                        {s.stds?.map(st => (
                          <span key={st} className={
                            'border px-2 py-0.5 rounded ' +
                            (st==='9001' ? 'bg-blue-100 border-blue-600' :
                             st==='14001' ? 'bg-green-100 border-green-600' :
                             'bg-red-100 border-red-600')
                          }>ISO {st}</span>
                        ))}
                        {s.clause && <span className="border px-2 py-0.5 rounded">Nõue: {s.clause}</span>}
                        <span className={'border px-2 py-0.5 rounded ' + (s.type==='Mittevastavus' ? 'bg-red-100 border-red-600' : 'bg-blue-100 border-blue-600')}>
                          {s.type}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap">{s.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Excl({ color, title }: { color: 'red' | 'blue'; title: string }) {
  const cn = color === 'red' ? 'text-red-600' : 'text-blue-600'
  return (
    <span title={title} className={cn} aria-label={title}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    </span>
  )
}

function Check({ color, title }: { color: 'green'; title: string }) {
  return (
    <span title={title} className="text-green-600" aria-label={title}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 13.3-3.1-3.1 1.4-1.4 1.7 1.7 3.9-3.9 1.4 1.4-5.3 5.3z"/>
      </svg>
    </span>
  )
}

function LoginForm({ defaultEmail, defaultPass, onLogin }: { defaultEmail: string; defaultPass: string; onLogin: (e: string, p: string) => void }) {
  const [email, setEmail] = useState(defaultEmail)
  const [pass, setPass] = useState(defaultPass)
  return (
    <div className="flex items-center gap-2">
      <input className="border rounded px-2 py-1" placeholder="e-post" value={email} onChange={e=>setEmail(e.target.value)} />
      <input type="password" className="border rounded px-2 py-1" placeholder="parool" value={pass} onChange={e=>setPass(e.target.value)} />
      <button className="px-3 py-1 border rounded" onClick={()=>onLogin(email, pass)}>Logi sisse</button>
    </div>
  )
}





