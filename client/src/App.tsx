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

  // küsimustiku avamine
  const [questionsOpen, setQuestionsOpen] = useState(false)

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [stds, setStds] = useState<Std[]>(['9001', '14001', '45001'])
  const [query, setQuery] = useState('')

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

  // Sessioonipildid (jäävad mällu ainult kuni leht on lahti)
  const [images, setImages] = useState<Record<string, string[]>>({})

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

  // --- Kokkuvõtte allikad (võtab KÕIK sellest protsessist, mitte ainult "visible")
  const summary = useMemo(() => {
    if (!dept) return { mv: [] as Array<{ q: Question; note: string }>, pe: [] as Array<{ q: Question; note: string }> }
    const mv: Array<{ q: Question; note: string }> = []
    const pe: Array<{ q: Question; note: string }> = []
    for (const q of dept.questions) {
      const a = answers[q.id]
      if (!a) continue
      if (a.mv) mv.push({ q, note: a.note || '' })
      else if (a.pe) pe.push({ q, note: a.note || '' })
    }
    return { mv, pe }
  }, [dept, answers])

  async function submitAudit() {
    if (!dept) return

    const missing: Array<{ id: string; msg: string }> = []
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) missing.push({ id: 'hdr-date', msg: 'Palun vali kuupäev.' })
    if (!auditor.trim()) missing.push({ id: 'hdr-auditor', msg: 'Palun täida auditeerija nimi.' })
    if (!auditee.trim()) missing.push({ id: 'hdr-auditee', msg: 'Palun täida auditeeritav.' })
    if (!auditeeTitle.trim()) missing.push({ id: 'hdr-title', msg: 'Palun täida auditeeritava amet.' })
    if (missing.length) {
      alert(missing[0].msg)
      setTimeout(() => document.getElementById(missing[0].id)?.focus(), 0)
      return
    }

    const bad = Object.entries(answers).find(([, a]) => a && (a.mv || a.pe) && !(a.note && a.note.trim()))
    if (bad) {
      const id = bad[0]
      alert(`Küsimusel ${id} on PE või MV — palun täida "Märkus: PE/MV".`)
      setTimeout(() => document.getElementById('note-' + id)?.focus(), 0)
      return
    }

    const payload = {
      department_id: dept.id,
      standards: stds,
      answers: Object.entries(answers).map(([id, a]) => ({ question_id: id, ...a })),
    }
    const r = await fetch(API + '/api/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(payload)
    })
    const j = await r.json()
    if (r.ok) alert('Audit salvestatud. ID: ' + j.audit_id)
    else alert(j.error || 'Salvestus ebaõnnestus')
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

  function autoResize(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 800) + 'px'
  }

  function handlePrint() { window.print() }

  function onAddImages(qid: string, files: FileList | null) {
    if (!files || !files.length) return
    const readers: Promise<string>[] = []
    for (const f of Array.from(files)) {
      readers.push(new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = reject
        fr.readAsDataURL(f)
      }))
    }
    Promise.all(readers).then(ds => {
      setImages(prev => ({ ...prev, [qid]: [...(prev[qid] || []), ...ds] }))
    })
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* print-spetsiifiline CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          textarea { border: 1px solid #000 !important; }
          select, input { border: 1px solid #000 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* Textarea baasmin-kõrgused prindis */
          .ev-field   { min-height: 8rem !important; }
          .note-field { min-height: 10.4rem !important; }

          /* Pildid ei tohi murduda */
          .photo-wrap { break-inside: avoid; page-break-inside: avoid; }
          .audit-photo { width: 24rem !important; height: auto !important; display: block; }
        }
      `}</style>

      <header className="flex items-center gap-3">
        <img src="/logo.webp" className="h-12" alt="Glamox" />
        <h1 className="text-2xl font-bold">Glamox GPE Siseaudit</h1>
        <div className="ml-auto flex items-center gap-2 no-print">
          <button className="px-3 py-1 border rounded bg-gray-100" onClick={handlePrint}>Salvesta PDF</button>
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

      <div className="mt-6" />

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
                  : deptStandards.map(s => <span key={s} className="text-xs border rounded px-2 py-0.5 bg-gray-100">ISO {s}</span>)}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end no-print">
          <button
            className="px-3 py-1 border rounded bg-green-100"
            disabled={!deptId}
            onClick={() => setQuestionsOpen(v => !v)}
            title={!deptId ? 'Vali enne protsess' : ''}
          >
            {questionsOpen ? 'Sulge küsimustik' : 'Ava küsimustik'}
          </button>
        </div>
      </section>

      {!schema ? <div>Laen skeemi...</div> : (
        <div className="grid md:grid-cols-4 gap-4">
          <div className="space-y-3 no-print">
            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Standard</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {(['9001', '14001', '45001'] as Std[]).map(s => (
                  <button
                    key={s}
                    className={'px-3 py-1 text-sm rounded border ' + (stds.includes(s) ? 'bg-black text-white' : 'bg-gray-100')}
                    onClick={() => setStds(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  >
                    ISO {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Otsi</label>
              <input className="w-full border rounded px-2 py-1 bg-white" value={query} onChange={e => setQuery(e.target.value)} placeholder="küsimus, klausel..." />
            </div>

            {role === 'admin' && (
              <div className="p-3 border rounded space-y-3">
                <div className="font-semibold">Redigeerimine</div>
                <div>
                  <div className="text-xs">Protsess</div>
                  <input className="border rounded px-2 py-1 mr-2" placeholder="id (nt ostmine)" value={depEdit.id} onChange={e => setDepEdit({ ...depEdit, id: e.target.value })} />
                  <input className="border rounded px-2 py-1 mr-2" placeholder="nimetus" value={depEdit.name} onChange={e => setDepEdit({ ...depEdit, name: e.target.value })} />
                  <div className="mt-1 space-x-2">
                    <button className="px-2 py-1 border rounded bg-gray-100" onClick={() => post('/api/departments', { id: depEdit.id, name: depEdit.name })}>Lisa</button>
                    <button className="px-2 py-1 border rounded bg-gray-100" onClick={() => post('/api/departments/' + depEdit.id, { name: depEdit.name }, 'PUT')}>Muuda</button>
                    <button className="px-2 py-1 border rounded bg-gray-100" onClick={() => del('/api/departments/' + depEdit.id)}>Kustuta</button>
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
                      <button className="px-2 py-1 border rounded bg-gray-100" onClick={() => post('/api/questions', { id: qEdit.id, department_id: qEdit.department_id || deptId, text: qEdit.text, clause: qEdit.clause, stds: qEdit.stds.split(' '), guidance: qEdit.guidance })}>Lisa küsimus</button>
                    ) : (
                      <>
                        <button className="px-2 py-1 border rounded bg-gray-100" onClick={() => post('/api/questions/' + qEdit.id, { department_id: qEdit.department_id || deptId, text: qEdit.text, clause: qEdit.clause, stds: qEdit.stds.split(' '), guidance: qEdit.guidance }, 'PUT')}>Salvesta</button>
                        <button className="px-2 py-1 border rounded bg-gray-100" onClick={() => { setQEdit({ mode: 'add', id: '', department_id: '', text: '', clause: '', stds: '9001', guidance: '' }) }}>Tühista</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-3 space-y-3">
            {!deptId ? (
              <div>Vali protsess päisest, seejärel vajuta “Ava küsimustik”.</div>
            ) : !questionsOpen ? (
              <div>Vajuta päise all olevale nupule “Ava küsimustik”.</div>
            ) : !dept ? (
              <div>Laen protsessi andmeid…</div>
            ) : visible.length === 0 ? (
              <div>Selles protsessis ei leitud sobivaid küsimusi (kontrolli valitud standardeid või otsingut).</div>
            ) : (
              <>
                {visible.map((q) => {
                  const a = answers[q.id] || {}
                  const imgs = images[q.id] || []
                  return (
                    <div key={q.id} className="p-3 border rounded print-avoid-break">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-xs border px-2 py-0.5 rounded bg-gray-100">{q.id}</span>
                        {q.stds?.length > 0 && q.stds.map(s => (
                          <span key={s} className={
                            "text-xs border px-2 py-0.5 rounded " +
                            (s === '9001' ? 'bg-blue-100'
                              : s === '14001' ? 'bg-green-100'
                              : 'bg-red-100')
                          }>
                            ISO {s}
                          </span>
                        ))}
                        {q.clause && <span className="text-xs border px-2 py-0.5 rounded bg-gray-100">Standardi nõue: {q.clause}</span>}
                        <span className="ml-auto flex items-center gap-1">
                          {a.mv && <Excl color="red" title="Mittevastavus" />}
                          {!a.mv && a.pe && <Excl color="blue" title="Parendusettepanek" />}
                          {!a.mv && a.vs && <Check color="green" title="Vastab standardile" />}
                        </span>
                        {role === 'admin' && (
                          <span className="ml-2 space-x-2 no-print">
                            <button className="text-xs px-2 py-0.5 border rounded bg-gray-100" onClick={() => startEditQuestion(q)}>Muuda</button>
                            <button className="text-xs px-2 py-0.5 border rounded bg-gray-100" onClick={() => del('/api/questions/' + q.id)}>Kustuta</button>
                          </span>
                        )}
                      </div>

                      <div className="mt-2">{q.text}</div>
                      {q.guidance && <div className="text-xs text-gray-600 mt-1">Juhend auditeerijale: {q.guidance}</div>}

                      {/* Staatus */}
                      <div className="mt-2 flex gap-3 flex-wrap items-center">
                        <label className="inline-flex items-center gap-2 border rounded px-2 py-1 bg-gray-100">
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

                        <label className="inline-flex items-center gap-2 border rounded px-2 py-1 bg-gray-100">
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

                        <label className="inline-flex items-center gap-2 border rounded px-2 py-1 bg-gray-100">
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

                      {/* Väljad */}
                      <div className="mt-2 grid md:grid-cols-3 gap-2 items-stretch qa-fields">
                        <div className="md:col-span-1">
                          <div className="text-xs font-semibold mb-1">Tõendid</div>
                          <textarea
                            className="border rounded px-2 py-1 w-full min-h-32 resize-y ev-field"
                            placeholder="Tõendid"
                            value={a.evidence || ''}
                            onInput={autoResize}
                            onChange={e => setAnswers(p => ({ ...p, [q.id]: { ...p[q.id], evidence: e.target.value } }))}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <div className="text-xs font-semibold mb-1">Märkus: PE/MV</div>
                          <textarea
                            id={'note-' + q.id}
                            className={
                              'border rounded px-2 py-1 w-full min-h-32 resize-y note-field ' +
                              (((a.mv || a.pe) && !(a.note && a.note.trim())) ? 'border-red-500 ring-1 ring-red-300' : '')
                            }
                            placeholder={((a.mv || a.pe) && !(a.note && a.note.trim())) ? 'Märkus: PE/MV (kohustuslik)' : 'Märkus: PE/MV'}
                            value={a.note || ''}
                            onInput={autoResize}
                            onChange={e => setAnswers(p => ({ ...p, [q.id]: { ...p[q.id], note: e.target.value } }))}
                          />
                        </div>
                      </div>

                      {/* Pildid */}
                      <div className="mt-3 no-print">
                        <label className="block text-xs font-semibold mb-1">Lisa pildid (ei salvestu serverisse)</label>
                        <input type="file" accept="image/*" multiple onChange={e => onAddImages(q.id, e.target.files)} />
                      </div>

                      {imgs.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                          {imgs.map((src, idx) => (
                            <div key={idx} className="photo-wrap">
                              <img src={src} alt="audit" className="audit-photo rounded border w-64 h-auto" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* --- AUTOMAATNE KOKKUVÕTE --- */}
                {(summary.mv.length > 0 || summary.pe.length > 0) && (
                  <section className="p-3 border rounded print-avoid-break bg-gray-50">
                    <h2 className="text-lg font-semibold mb-2">Kokkuvõte</h2>

                    {summary.mv.length > 0 && (
                      <div className="mb-3">
                        <div className="font-semibold mb-1">Mittevastavused</div>
                        <div className="space-y-2">
                          {summary.mv.map(({ q, note }) => (
                            <div key={'mv-' + q.id} className="border rounded p-2 bg-white print-avoid-break">
                              <div className="text-xs mb-1 flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-white bg-red-600">MV</span>
                                <span className="border rounded px-2 py-0.5 bg-gray-100">{q.id}</span>
                                {q.clause && <span className="border rounded px-2 py-0.5 bg-gray-100">Standardi nõue: {q.clause}</span>}
                              </div>
                              <div className="font-medium">{q.text}</div>
                              {note && <div className="mt-1 text-sm"><span className="font-semibold">Sisu: </span>{note}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {summary.pe.length > 0 && (
                      <div>
                        <div className="font-semibold mb-1">Parendusettepanekud</div>
                        <div className="space-y-2">
                          {summary.pe.map(({ q, note }) => (
                            <div key={'pe-' + q.id} className="border rounded p-2 bg-white print-avoid-break">
                              <div className="text-xs mb-1 flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-white bg-blue-600">PE</span>
                                <span className="border rounded px-2 py-0.5 bg-gray-100">{q.id}</span>
                                {q.clause && <span className="border rounded px-2 py-0.5 bg-gray-100">Standardi nõue: {q.clause}</span>}
                              </div>
                              <div className="font-medium">{q.text}</div>
                              {note && <div className="mt-1 text-sm"><span className="font-semibold">Sisu: </span>{note}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <div className="flex justify-end gap-2 no-print">
                  <button className="px-4 py-2 rounded border bg-gray-100" onClick={submitAudit}>Salvesta audit</button>
                  <button className="px-4 py-2 rounded border bg-gray-100" onClick={handlePrint}>Salvesta PDF</button>
                </div>
              </>
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
      <button className="px-3 py-1 border rounded bg-gray-100" onClick={()=>onLogin(email, pass)}>Logi sisse</button>
    </div>
  )
}


