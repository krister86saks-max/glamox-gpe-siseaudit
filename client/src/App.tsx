import React, { useEffect, useMemo, useState } from 'react'

type Std = '9001' | '14001' | '45001'
type Question = { id: string; text: string; clause?: string; stds: Std[]; guidance?: string }
type Department = { id: string; name: string; questions: Question[] }
type Schema = { meta: { version: string; org: string }; departments: Department[] }
type Answer = { vs?: boolean; pe?: boolean; mv?: boolean; evidence?: string; note?: string }
type ImgItem = { id: string; name: string; dataUrl: string }

const API = (import.meta.env.VITE_API_URL ?? window.location.origin)

export default function App() {
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole]   = useState<'admin'|'auditor'|'external'|null>(null)
  const [schema, setSchema] = useState<Schema | null>(null)

  const [deptId, setDeptId] = useState<string>('')           // protsess
  const [questionsOpen, setQuestionsOpen] = useState(false)  // küsimustik

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [images,  setImages]  = useState<Record<string, ImgItem[]>>({}) // pildid küsimuse kaupa (sessioonis)
  const [stds, setStds] = useState<Std[]>(['9001','14001','45001'])
  const [query, setQuery] = useState('')

  // Päise väljad
  const [date, setDate] = useState<string>(() => {
    const d = new Date(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0')
    return `${d.getFullYear()}-${mm}-${dd}`
  })
  const [auditor, setAuditor] = useState('')
  const [auditee, setAuditee] = useState('')
  const [auditeeTitle, setAuditeeTitle] = useState('')
  const [subDept, setSubDept] = useState('')

  // Admin edit
  const [qEdit, setQEdit] = useState<{mode:'add'|'edit', id:string, department_id:string, text:string, clause:string, stds:string, guidance:string}>(
    {mode:'add', id:'', department_id:'', text:'', clause:'', stds:'9001', guidance:''}
  )
  const [depEdit, setDepEdit] = useState<{ id:string; name:string }>({ id:'', name:'' })

  async function refreshSchema() {
    const s: Schema = await fetch(API + '/api/schema').then(r => r.json())
    setSchema(s)
  }
  useEffect(() => { refreshSchema() }, [])

  async function login(email: string, password: string) {
    const r = await fetch(API + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
    const j = await r.json()
    if (r.ok) { setToken(j.token); setRole(j.role) } else alert(j.error || 'login failed')
  }

  const dept = schema?.departments.find(d => d.id === deptId)

  // Protsessi küsimuste standardid (päises)
  const deptStandards = useMemo<Std[]>(() => {
    if (!dept) return []
    const set = new Set<Std>()
    for (const q of dept.questions) for (const s of q.stds) set.add(s as Std)
    return Array.from(set).sort() as Std[]
  }, [dept])

  // Kuvarida
  const visible = useMemo(() => {
    if (!dept) return []
    const active = new Set(stds)
    let qs = dept.questions.filter(q => q.stds.some(x => active.has(x)))
    const qq = query.trim().toLowerCase()
    if (qq) qs = qs.filter(q => [q.id, q.text, q.clause || '', dept?.name].join(' ').toLowerCase().includes(qq))
    return qs
  }, [dept, stds, query])

  // --- Admin API helperid ---
  async function post(url: string, body: any, method='POST') {
    const r = await fetch(API + url, { method, headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
    const j = await r.json(); if (!r.ok) { alert(j.error || 'error') } else await refreshSchema()
  }
  async function del(url: string) {
    const r = await fetch(API + url, { method:'DELETE', headers: { Authorization: 'Bearer ' + token } })
    const j = await r.json(); if (!r.ok) { alert(j.error || 'error') } else await refreshSchema()
  }
  function startEditQuestion(q: Question) {
    setQEdit({ mode:'edit', id: q.id, department_id: deptId, text: q.text, clause: q.clause || '', stds: q.stds.join(' '), guidance: q.guidance || '' })
  }

  // --- Pildid (sessioon) ---
  function addImages(qid: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    const readers = list.map(f => new Promise<ImgItem>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve({
        id: qid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        name: f.name,
        dataUrl: String(fr.result)
      })
      fr.onerror = () => reject(fr.error)
      fr.readAsDataURL(f)
    }))
    Promise.all(readers).then(items => {
      setImages(prev => ({ ...prev, [qid]: [ ...(prev[qid] || []), ...items ] }))
    })
  }
  function removeImage(qid: string, imgId: string) {
    setImages(p => ({ ...p, [qid]: (p[qid]||[]).filter(x => x.id !== imgId) }))
  }

  // --- Poolik audit failina (sh pildid) ---
  function downloadPartial() {
    const payload = { date, auditor, auditee, auditeeTitle, subDept, deptId, stds, answers, images }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'poolik-audit.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  function uploadPartial(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const fr = new FileReader()
    fr.onload = () => {
      try {
        const j = JSON.parse(String(fr.result))
        setDate(j.date||''); setAuditor(j.auditor||''); setAuditee(j.auditee||''); setAuditeeTitle(j.auditeeTitle||''); setSubDept(j.subDept||'')
        setDeptId(j.deptId||''); setStds(j.stds||[]); setAnswers(j.answers||{}); setImages(j.images||{})
        setQuestionsOpen(!!j.deptId)
      } catch { alert('Vigane fail') }
    }
    fr.readAsText(f)
    e.currentTarget.value = ''
  }

  // --- JSON Import / Export (admin) ---
  async function exportSchemaJSON() {
    const s: Schema = await fetch(API + '/api/schema').then(r => r.json())
    const blob = new Blob([JSON.stringify(s, null, 2)], { type:'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'schema-export.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  async function importSchemaJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    try {
      const text = await f.text()
      const data: Schema = JSON.parse(text)
      // osakonnad
      for (const d of data.departments) {
        let r = await fetch(API + '/api/departments', {
          method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token },
          body: JSON.stringify({ id: d.id, name: d.name })
        })
        if (!r.ok) {
          await fetch(API + '/api/departments/'+d.id, {
            method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token },
            body: JSON.stringify({ name: d.name })
          })
        }
      }
      // küsimused
      for (const d of data.departments) {
        for (const q of d.questions) {
          const body = { id: q.id, department_id: d.id, text: q.text, clause: q.clause||'', stds: q.stds, guidance: q.guidance||'' }
          let r = await fetch(API + '/api/questions', {
            method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token }, body: JSON.stringify(body)
          })
          if (!r.ok) {
            await fetch(API + '/api/questions/'+q.id, {
              method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token },
              body: JSON.stringify({ department_id: d.id, text: q.text, clause: q.clause||'', stds: q.stds, guidance: q.guidance||'' })
            })
          }
        }
      }
      await refreshSchema()
      alert('Import õnnestus')
    } catch (e) {
      console.error(e)
      alert('Import ebaõnnestus')
    } finally {
      e.currentTarget.value = ''
    }
  }

  function autoResize(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 800) + 'px'
  }
  function handlePrint() { window.print() }

  // värvikoodiga sildid
  const stdChip = (s: Std) => {
    const base = 'text-xs px-2 py-0.5 rounded border'
    const map: Record<Std,string> = {
      '9001':  'bg-blue-50 border-blue-300',
      '14001': 'bg-green-50 border-green-300',
      '45001': 'bg-red-50 border-red-300'
    }
    return <span key={s} className={`${base} ${map[s]}`}>ISO {s}</span>
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* PRINT CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          textarea { border: 1px solid #000 !important; }
          select, input { border: 1px solid #000 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ev-field   { min-height: 8rem !important; }
          .note-field { min-height: 10.4rem !important; } /* ~30% kõrgem */
          .img-box { break-inside: avoid; page-break-inside: avoid; }
          .img-box img { max-width: 100%; height: auto; }
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

      {/* PÄIS */}
      <section className="mb-3 p-3 border rounded">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="hdr-date" className="block text-xs font-semibold">Kuupäev *</label>
            <input id="hdr-date" type="date" className="w-full border rounded px-2 py-1" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="hdr-auditor" className="block text-xs font-semibold">Auditeerija nimi *</label>
            <input id="hdr-auditor" className="w-full border rounded px-2 py-1" placeholder="nimi" value={auditor} onChange={e=>setAuditor(e.target.value)} />
          </div>
          <div>
            <label htmlFor="hdr-auditee" className="block text-xs font-semibold">Auditeeritav *</label>
            <input id="hdr-auditee" className="w-full border rounded px-2 py-1" placeholder="nimi" value={auditee} onChange={e=>setAuditee(e.target.value)} />
          </div>
          <div>
            <label htmlFor="hdr-title" className="block text-xs font-semibold">Amet *</label>
            <input id="hdr-title" className="w-full border rounded px-2 py-1" placeholder="amet" value={auditeeTitle} onChange={e=>setAuditeeTitle(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold">Auditeeritav protsess</label>
            <select className="w-full border rounded px-2 py-1" value={deptId} onChange={e=>{ setDeptId(e.target.value); setQuestionsOpen(false) }} disabled={!schema}>
              <option value="">— Vali protsess —</option>
              {schema?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="hdr-subdept" className="block text-xs font-semibold">Alamosakond (kui kohandub)</label>
            <input id="hdr-subdept" className="w-full border rounded px-2 py-1" placeholder="nt alamosakond" value={subDept} onChange={e=>setSubDept(e.target.value)} />
          </div>

          {dept && (
            <div className="md:col-span-2">
              <div className="block text-xs font-semibold">Kohaldatavad standardid</div>
              <div className="mt-1 flex gap-2 flex-wrap">
                {deptStandards.length === 0 ? <span className="text-xs text-gray-500">–</span> : deptStandards.map(stdChip)}
              </div>
            </div>
          )}
        </div>

        {/* NUPPUDERIDA */}
        <div className="mt-3 flex flex-wrap gap-2 no-print">
          <button
            className="px-3 py-1 border rounded"
            style={{ background:'#d9fbe0', borderColor:'#86efac' }}  // heleroheline
            disabled={!deptId}
            onClick={()=>setQuestionsOpen(v=>!v)}
            title={!deptId ? 'Vali enne protsess' : ''}
          >
            {questionsOpen ? 'Sulge küsimustik' : 'Ava küsimustik'}
          </button>

          <button className="px-3 py-1 border rounded" onClick={downloadPartial}>Laadi alla poolik audit</button>

          <label className="px-3 py-1 border rounded cursor-pointer">
            Ava poolik audit
            <input type="file" accept="application/json" className="hidden" onChange={uploadPartial} />
          </label>

          <button className="px-3 py-1 border rounded ml-auto" onClick={handlePrint}>Salvesta PDF</button>
        </div>
      </section>

      {!schema ? <div>Laen skeemi...</div> : (
        <div className="grid md:grid-cols-4 gap-4">
          {/* Vasak külg */}
          <div className="space-y-3 no-print">
            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Standard</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {(['9001','14001','45001'] as Std[]).map(s => (
                  <button key={s} className={'px-3 py-1 text-sm rounded border ' + (stds.includes(s) ? 'bg-black text-white' : '')} onClick={() => setStds(prev => prev.includes(s)? prev.filter(x=>x!==s) : [...prev,s])}>
                    ISO {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Otsi</label>
              <input className="w-full border rounded px-2 py-1" value={query} onChange={e=>setQuery(e.target.value)} placeholder="küsimus, klausel..." />
            </div>

            {role === 'admin' && (
              <div className="p-3 border rounded space-y-3">
                <div className="font-semibold">Redigeerimine</div>

                <div>
                  <div className="text-xs">Protsess</div>
                  <input className="border rounded px-2 py-1 mr-2" placeholder="id (nt ostmine)" value={depEdit.id} onChange={e=>setDepEdit({...depEdit, id:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2" placeholder="nimetus" value={depEdit.name} onChange={e=>setDepEdit({...depEdit, name:e.target.value})} />
                  <div className="mt-1 space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={()=>post('/api/departments', { id: depEdit.id, name: depEdit.name })}>Lisa</button>
                    <button className="px-2 py-1 border rounded" onClick={()=>post('/api/departments/'+depEdit.id, { name: depEdit.name }, 'PUT')}>Muuda</button>
                    <button className="px-2 py-1 border rounded" onClick={()=>del('/api/departments/'+depEdit.id)}>Kustuta</button>
                  </div>
                </div>

                <div>
                  <div className="text-xs">Küsimus ({qEdit.mode === 'add' ? 'lisa' : 'muuda'}):</div>
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="küsimuse id (nt Q-100)" value={qEdit.id} onChange={e=>setQEdit({...qEdit, id:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="department_id" value={qEdit.department_id || deptId} onChange={e=>setQEdit({...qEdit, department_id:e.target.value})} />
                  <textarea className="border rounded px-2 py-1 w-full mb-1" placeholder="küsimuse tekst" value={qEdit.text} onChange={e=>setQEdit({...qEdit, text:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="Standardi nõue (klausel)" value={qEdit.clause} onChange={e=>setQEdit({...qEdit, clause:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="Standard (nt 9001 14001)" value={qEdit.stds} onChange={e=>setQEdit({...qEdit, stds:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="Juhend auditeerijale" value={qEdit.guidance} onChange={e=>setQEdit({...qEdit, guidance:e.target.value})} />
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

                {/* JSON imp/exp */}
                <div>
                  <div className="text-xs font-semibold mb-1">Varunda / taasta (JSON)</div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 border rounded" onClick={exportSchemaJSON}>Ekspordi JSON</button>
                    <label className="px-2 py-1 border rounded cursor-pointer">
                      Impordi JSON
                      <input type="file" accept="application/json" className="hidden" onChange={importSchemaJSON} />
                    </label>
                  </div>
                  <div className="text-[11px] mt-1 text-gray-600">Impordiga kirjutatakse protsessid ja küsimused üle / sünkroniseeritakse.</div>
                </div>
              </div>
            )}
          </div>

          {/* Põhikolumn */}
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
              visible.map(q => {
                const a = answers[q.id] || {}
                const imgs = images[q.id] || []
                return (
                  <div key={q.id} className="p-3 border rounded print-avoid-break">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs border px-2 py-0.5 rounded bg-gray-50">{q.id}</span>
                      {q.stds?.length > 0 && q.stds.map(stdChip)}
                      {q.clause && <span className="text-xs border px-2 py-0.5 rounded bg-gray-50">Standardi nõue: {q.clause}</span>}
                      <span className="ml-auto flex items-center gap-1">
                        {a.mv && <Excl color="red" title="Mittevastavus" />}
                        {!a.mv && a.pe && <Excl color="blue" title="Parendusettepanek" />}
                        {!a.mv && a.vs && <Check color="green" title="Vastab standardile" />}
                      </span>
                    </div>

                    <div className="mt-2">{q.text}</div>
                    {q.guidance && <div className="text-xs text-gray-600 mt-1">Juhend auditeerijale: {q.guidance}</div>}

                    {/* Staatus */}
                    <div className="mt-2 flex gap-3 flex-wrap items-center">
                      <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                        <input type="checkbox" checked={!!a.vs} onChange={() =>
                          setAnswers(p => { const cur = p[q.id]||{}; const next = { ...cur, vs: !cur.vs }; if (next.vs) next.mv=false; return { ...p, [q.id]: next } })
                        }/>
                        Vastab standardile
                      </label>
                      <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                        <input type="checkbox" checked={!!a.pe} onChange={() =>
                          setAnswers(p => { const cur = p[q.id]||{}; const next = { ...cur, pe: !cur.pe }; if (next.pe) next.mv=false; return { ...p, [q.id]: next } })
                        }/>
                        Parendusettepanek
                      </label>
                      <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                        <input type="checkbox" checked={!!a.mv} onChange={() =>
                          setAnswers(p => { const cur = p[q.id]||{}; const next = { ...cur, mv: !cur.mv, vs:false, pe:false }; return { ...p, [q.id]: next } })
                        }/>
                        Mittevastavus
                      </label>
                    </div>

                    {/* Väljad + pildid */}
                    <div className="mt-2 grid md:grid-cols-3 gap-2 items-stretch qa-fields">
                      <div className="md:col-span-1">
                        <div className="text-xs font-semibold mb-1">Tõendid</div>
                        <textarea
                          className="border rounded px-2 py-1 w-full min-h-32 resize-y ev-field"
                          placeholder="Tõendid"
                          value={a.evidence || ''}
                          onInput={autoResize}
                          onChange={e=>setAnswers(p=>({ ...p, [q.id]: { ...p[q.id], evidence: e.target.value } }))}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs font-semibold mb-1">Märkus: PE/MV</div>
                        <textarea
                          id={'note-' + q.id}
                          className={'border rounded px-2 py-1 w-full min-h-32 resize-y note-field ' + (((a.mv||a.pe) && !(a.note && a.note.trim())) ? 'border-red-500 ring-1 ring-red-300' : '')}
                          placeholder={((a.mv||a.pe) && !(a.note && a.note.trim())) ? 'Märkus: PE/MV (kohustuslik)' : 'Märkus: PE/MV'}
                          value={a.note || ''}
                          onInput={autoResize}
                          onChange={e=>setAnswers(p=>({ ...p, [q.id]: { ...p[q.id], note: e.target.value } }))}
                        />
                      </div>
                    </div>

                    {/* Pildid */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold">Pildid</div>
                        <label className="no-print px-2 py-1 border rounded cursor-pointer">
                          Lisa pildid
                          <input type="file" accept="image/*" multiple className="hidden" onChange={e=>addImages(q.id, e.target.files)} />
                        </label>
                      </div>
                      {imgs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {imgs.map(img => (
                            <div key={img.id} className="img-box border rounded p-1" style={{width:'240px'}}>
                              <img src={img.dataUrl} alt={img.name} />
                              <div className="text-[11px] mt-1 truncate">{img.name}</div>
                              <button className="no-print mt-1 text-xs px-2 py-0.5 border rounded" onClick={()=>removeImage(q.id, img.id)}>Eemalda</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Excl({ color, title }: { color: 'red'|'blue'; title: string }) {
  const cn = color === 'red' ? 'text-red-600' : 'text-blue-600'
  return (
    <span title={title} className={cn} aria-label={title}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
    </span>
  )
}
function Check({ color, title }: { color: 'green'; title: string }) {
  return (
    <span title={title} className="text-green-600" aria-label={title}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 13.3-3.1-3.1 1.4-1.4 1.7 1.7 3.9-3.9 1.4 1.4-5.3 5.3z"/></svg>
    </span>
  )
}
function LoginForm({ defaultEmail, defaultPass, onLogin }: { defaultEmail:string; defaultPass:string; onLogin:(e:string,p:string)=>void }) {
  const [email, setEmail] = useState(defaultEmail); const [pass, setPass] = useState(defaultPass)
  return (
    <div className="flex items-center gap-2">
      <input className="border rounded px-2 py-1" placeholder="e-post" value={email} onChange={e=>setEmail(e.target.value)} />
      <input type="password" className="border rounded px-2 py-1" placeholder="parool" value={pass} onChange={e=>setPass(e.target.value)} />
      <button className="px-3 py-1 border rounded" onClick={()=>onLogin(email, pass)}>Logi sisse</button>
    </div>
  )
}

