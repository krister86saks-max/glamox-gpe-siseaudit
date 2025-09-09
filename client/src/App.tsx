import React, { useEffect, useMemo, useState } from 'react'

type Std = '9001' | '14001' | '45001'
type Question = { id: string; text: string; clause?: string; stds: Std[]; guidance?: string }
type Department = { id: string; name: string; questions: Question[] }
type Schema = { meta: { version: string; org: string }; departments: Department[] }
type Answer = { vs?: boolean; pe?: boolean; mv?: boolean; evidence?: string; note?: string; images?: string[] }

const API = (import.meta.env.VITE_API_URL ?? window.location.origin)

// pildi üleslaadimise piirangud (brauseris)
const MAX_IMAGES_PER_Q = 5
const MAX_EDGE_PX = 1280
const JPEG_QUALITY = 0.8

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

    // NB: ei saada images välja serverisse
    const payload = {
      department_id: dept.id,
      standards: stds,
      answers: Object.entries(answers).map(([id, a]) => {
        const { vs, pe, mv, evidence, note } = a || {}
        return { question_id: id, vs, pe, mv, evidence, note }
      }),
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

  // -------- Piltide lisamine (ainult brauseri mälus) --------

  function removeImage(qid: string, idx: number) {
    setAnswers(p => {
      const cur = p[qid] || {}
      const imgs = (cur.images || []).slice()
      imgs.splice(idx, 1)
      return { ...p, [qid]: { ...cur, images: imgs } }
    })
  }

  async function handleAddImages(qid: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const toProcess = Array.from(files).slice(0, MAX_IMAGES_PER_Q)

    const processed: string[] = []
    for (const f of toProcess) {
      if (!/^image\//.test(f.type)) continue
      try {
        const dataUrl = await downscaleToDataURL(f, MAX_EDGE_PX, JPEG_QUALITY)
        processed.push(dataUrl)
      } catch (e) {
        console.warn('pildi töötlus ebaõnnestus:', e)
      }
    }

    setAnswers(p => {
      const cur = p[qid] || {}
      const existing = cur.images || []
      const next = existing.concat(processed).slice(0, MAX_IMAGES_PER_Q)
      return { ...p, [qid]: { ...cur, images: next } }
    })
  }

  function downscaleToDataURL(file: File, maxEdge: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
          const w = Math.max(1, Math.round(img.width * scale))
          const h = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('canvas ctx puudub'))
          ctx.drawImage(img, 0, 0, w, h)
          const mime = 'image/jpeg'
          const dataUrl = canvas.toDataURL(mime, quality)
          resolve(dataUrl)
        }
        img.onerror = reject
        img.src = String(reader.result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
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

          /* väljade min-kõrgused PDF-is */
          .ev-field   { min-height: 8rem !important; }
          .note-field { min-height: 10.4rem !important; }

          /* PILDID: ära murra ühe pildi sees — kui ei mahu, mine järgmisele lehele */
          .qa-images       { break-inside: avoid; page-break-inside: avoid; }
          .qa-image        { break-inside: avoid; page-break-inside: avoid; }
          .qa-image img    { break-inside: avoid; page-break-inside: avoid; display:block; max-width:100%; height:auto; }
          .qa-images .img-actions { display: none !important; } /* peida kustutusnupud printimisel */
        }

        /* ekraanil pisike grid piltide eelvaadete jaoks */
        .qa-images-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: .5rem; }
        .qa-images figure { border: 1px solid #e5e7eb; border-radius: .25rem; padding: .25rem; }
        .qa-images img { width: 100%; height: auto; }
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
                  : deptStandards.map(s => <span key={s} className="text-xs border rounded px-2 py-0.5">ISO {s}</span>)}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end no-print">
          <button
            className="px-3 py-1 border rounded"
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
                      <button className="px-2 py-1 border rounded" onClick={() => post('/api/questions', { id: qEdit.id, department_id: qEdit.department_id || deptId, text: qEdit.text, clause: qEdit.clause, stds: qEdit.stds.split(' '), guidance: qEdit.guidance })}>Lisa küsimus</button>
                    ) : (
                      <>
                        <button className="px-2 py-1 border rounded" onClick={() => post('/api/questions/' + qEdit.id, { department_id: qEdit.department_id || deptId, text: qEdit.text, clause: qEdit.clause, stds: qEdit.stds.split(' '), guidance: qEdit.guidance }, 'PUT')}>Salvesta</button>
                        <button className="px-2 py-1 border rounded" onClick={() => { setQEdit({ mode: 'add', id: '', department_id: '', text: '', clause: '', stds: '9001', guidance: '' }) }}>Tühista</button>
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
              visible.map((q) => {
                const a = answers[q.id] || {}
                return (
                  <div key={q.id} className="p-3 border rounded print-avoid-break">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs border px-2 py-0.5 rounded bg-gray-100">Q-{q.id.replace(/^Q-?/,'')}</span>

                      {q.stds?.length > 0 && q.stds.map(s => (
                        <span
                          key={s}
                          className={
                            'text-xs border px-2 py-0.5 rounded ' +
                            (s === '9001' ? 'bg-blue-100 border-blue-300' :
                             s === '14001' ? 'bg-green-100 border-green-300' :
                             s === '45001' ? 'bg-red-100 border-red-300' : 'bg-gray-100')
                          }
                        >
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
                          <button className="text-xs px-2 py-0.5 border rounded" onClick={() => startEditQuestion(q)}>Muuda</button>
                          <button className="text-xs px-2 py-0.5 border rounded" onClick={() => del('/api/questions/' + q.id)}>Kustuta</button>
                        </span>
                      )}
                    </div>

                    <div className="mt-2">{q.text}</div>
                    {q.guidance && <div className="text-xs text-gray-600 mt-1">Juhend auditeerijale: {q.guidance}</div>}

                    {/* väljad */}
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

                    {/* Pildid (ainult mälus / prinditakse PDF-i) */}
                    <div className="mt-3 qa-images">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-semibold">Pildid (ei salvestata serverisse)</div>
                        <label className="no-print text-xs px-2 py-1 border rounded cursor-pointer">
                          Lisa pilt
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleAddImages(q.id, e.currentTarget.files)}
                          />
                        </label>
                      </div>

                      {(a.images?.length ?? 0) > 0 && (
                        <div className="qa-images-grid">
                          {a.images!.map((src, idx) => (
                            <figure key={idx} className="qa-image">
                              <img src={src} alt={`pilt-${idx + 1}`} />
                              <div className="img-actions mt-1 flex gap-2 justify-end no-print">
                                <button className="text-xs px-2 py-0.5 border rounded"
                                  onClick={() => removeImage(q.id, idx)}>Kustuta</button>
                              </div>
                            </figure>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div className="flex justify-end gap-2 no-print">
              <button className="px-4 py-2 rounded border" onClick={submitAudit}>Salvesta audit</button>
              <button className="px-4 py-2 rounded border" onClick={handlePrint}>Salvesta PDF</button>
            </div>
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



