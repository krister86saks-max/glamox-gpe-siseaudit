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
  const [deptId, setDeptId] = useState<string>('')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [orgName, setOrgName] = useState('Glamox AS')
  const [stds, setStds] = useState<Std[]>(['9001', '14001', '45001'])
  const [query, setQuery] = useState('')

  const [qEdit, setQEdit] = useState<{mode:'add'|'edit', id:string, department_id:string, text:string, clause:string, stds:string, guidance:string}>(
    {mode:'add', id:'', department_id:'', text:'', clause:'', stds:'9001', guidance:''})
  const [depEdit, setDepEdit] = useState<{ id: string; name: string }>({ id: '', name: '' })

  async function refreshSchema() {
    const s: Schema = await fetch(API + '/api/schema').then(r => r.json())
    setSchema(s)
    if (!deptId && s.departments[0]) setDeptId(s.departments[0].id)
  }
  useEffect(() => { refreshSchema() }, [])

  async function login(email: string, password: string) {
    const r = await fetch(API + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
    const j = await r.json()
    if (r.ok) { setToken(j.token); setRole(j.role) } else alert(j.error || 'login failed')
  }

  const dept = schema?.departments.find(d => d.id === deptId)
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
    const bad = Object.entries(answers).find(([ , a]) => a && (a.mv || a.pe) && !(a.note && a.note.trim()))
    if (bad) {
      const id = bad[0]
      alert(`KÃ¼simusel ${id} on PE vÃµi MV â€” palun tÃ¤ida "MÃ¤rkus: PE/MV".`)
      setTimeout(() => document.getElementById('note-' + id)?.focus(), 0)
      return
    }
    const payload = {
      org: orgName,
      department_id: dept.id,
      standards: stds,
      answers: Object.entries(answers).map(([id, a]) => ({ question_id: id, ...a })),
    }
    const r = await fetch(API + '/api/audits', { method: 'POST', headers: { 'Content-Type':'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(payload) })
    const j = await r.json()
    if (r.ok) alert('Audit salvestatud. ID: ' + j.audit_id)
    else alert(j.error || 'Salvestus ebaÃµnnestus')
  }

  async function post(url: string, body: any, method='POST') {
    const r = await fetch(API + url, { method, headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
    const j = await r.json(); if (!r.ok) alert(j.error || 'error'); else await refreshSchema()
  }
  async function del(url: string) {
    const r = await fetch(API + url, { method:'DELETE', headers: { Authorization: 'Bearer ' + token } })
    const j = await r.json(); if (!r.ok) alert(j.error || 'error'); else await refreshSchema()
  }

  function startEditQuestion(q: Question) {
    setQEdit({ mode:'edit', id: q.id, department_id: deptId, text: q.text, clause: q.clause || '', stds: q.stds.join(' '), guidance: q.guidance || '' })
  }

  // --- teeb textarea'd sisuga automaatselt kÃµrgemaks (Ã¼lapiir 800px) ---
  function autoResize(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 800) + 'px'
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <header className="flex items-center gap-3 mb-4">
        <img src="/logo.webp" className="h-8" alt="Glamox" />
        <h1 className="text-2xl font-bold">Glamox GPE Siseaudit</h1>
        <div className="ml-auto flex items-center gap-2">
          {!token ? (
            <LoginForm defaultEmail="krister.saks@glamox.com" defaultPass="tipatapa86" onLogin={login} />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm px-2 py-1 border rounded">Role: {role}</span>
              <button className="px-2 py-1 border rounded" onClick={() => { setToken(null); setRole(null); }}>Logi vÃ¤lja</button>
            </div>
          )}
        </div>
      </header>

      {!schema ? <div>Laen skeemi...</div> : (
        <div className="grid md:grid-cols-4 gap-4">
          <div className="space-y-3">
            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">EttevÃµtte nimi</label>
              <input className="w-full border rounded px-2 py-1" value={orgName} onChange={e => setOrgName(e.target.value)} />
            </div>
            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Osakond</label>
              <select className="w-full border rounded px-2 py-1" value={deptId} onChange={e => setDeptId(e.target.value)}>
                {schema.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Standard</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {(['9001','14001','45001'] as Std[]).map(s => (
                  <button key={s} className={'px-3 py-1 text-sm rounded border ' + (stds.includes(s) ? 'bg-black text-white' : '')} onClick={() => setStds(prev => prev.includes(s)? prev.filter(x => x!==s) : [...prev,s])}>ISO {s}</button>
                ))}
              </div>
            </div>
            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Otsi</label>
              <input className="w-full border rounded px-2 py-1" value={query} onChange={e => setQuery(e.target.value)} placeholder="kÃ¼simus, klausel..." />
            </div>

            {role === 'admin' && (
              <div className="p-3 border rounded space-y-3">
                <div className="font-semibold">Redigeerimine</div>
                <div>
                  <div className="text-xs">Osakond</div>
                  <input className="border rounded px-2 py-1 mr-2" placeholder="id (nt ostmine)" value={depEdit.id} onChange={e=>setDepEdit({...depEdit, id:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2" placeholder="nimetus" value={depEdit.name} onChange={e=>setDepEdit({...depEdit, name:e.target.value})} />
                  <div className="mt-1 space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={()=>post('/api/departments', { id: depEdit.id, name: depEdit.name })}>Lisa</button>
                    <button className="px-2 py-1 border rounded" onClick={()=>post('/api/departments/'+depEdit.id, { name: depEdit.name }, 'PUT')}>Muuda</button>
                    <button className="px-2 py-1 border rounded" onClick={()=>del('/api/departments/'+depEdit.id)}>Kustuta</button>
                  </div>
                </div>

                <div>
                  <div className="text-xs">KÃ¼simus ({qEdit.mode === 'add' ? 'lisa' : 'muuda'}):</div>
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="kÃ¼simuse id (nt Q-100)" value={qEdit.id} onChange={e=>setQEdit({...qEdit, id:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="department_id" value={qEdit.department_id || deptId} onChange={e=>setQEdit({...qEdit, department_id:e.target.value})} />
                  <textarea className="border rounded px-2 py-1 w-full mb-1" placeholder="kÃ¼simuse tekst" value={qEdit.text} onChange={e=>setQEdit({...qEdit, text:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="Standardi nÃµue (klausel)" value={qEdit.clause} onChange={e=>setQEdit({...qEdit, clause:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="Standard (nt 9001 14001)" value={qEdit.stds} onChange={e=>setQEdit({...qEdit, stds:e.target.value})} />
                  <input className="border rounded px-2 py-1 mr-2 mb-1" placeholder="Juhend auditeerijale" value={qEdit.guidance} onChange={e=>setQEdit({...qEdit, guidance:e.target.value})} />
                  <div className="space-x-2">
                    {qEdit.mode === 'add' ? (
                      <button className="px-2 py-1 border rounded" onClick={()=>post('/api/questions', { id: qEdit.id, department_id: qEdit.department_id || deptId, text: qEdit.text, clause: qEdit.clause, stds: qEdit.stds.split(' '), guidance: qEdit.guidance })}>Lisa kÃ¼simus</button>
                    ) : (
                      <>
                        <button className="px-2 py-1 border rounded" onClick={()=>post('/api/questions/'+qEdit.id, { department_id: qEdit.department_id || deptId, text: qEdit.text, clause: qEdit.clause, stds: qEdit.stds.split(' '), guidance: qEdit.guidance }, 'PUT')}>Salvesta</button>
                        <button className="px-2 py-1 border rounded" onClick={()=>{ setQEdit({mode:'add', id:'', department_id:'', text:'', clause:'', stds:'9001', guidance:''}) }}>TÃ¼hista</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-3 space-y-3">
            {!dept ? <div>Vali osakond</div> : visible.map((q) => {
              const a = answers[q.id] || {}
              return (
              <div key={q.id} className="p-3 border rounded">
                <div className="flex items-start gap-2">
                  <span className="text-xs border px-2 py-0.5 rounded">{q.id}</span>
                  {q.clause && <span className="text-xs border px-2 py-0.5 rounded">Standardi nÃµue: {q.clause}</span>}
                  <span className="ml-auto flex items-center gap-1">
                    {a.mv && <Excl color="red" title="Mittevastavus" />}
                    {!a.mv && a.pe && <Excl color="blue" title="Parendusettepanek" />}
                    {!a.mv && a.vs && <Check color="green" title="Vastab standardile" />}
                  </span>
                  {role === 'admin' && (
                    <span className="ml-2 space-x-2">
                      <button className="text-xs px-2 py-0.5 border rounded" onClick={()=> startEditQuestion(q)}>Muuda</button>
                      <button className="text-xs px-2 py-0.5 border rounded" onClick={()=> del('/api/questions/'+q.id)}>Kustuta</button>
                    </span>
                  )}
                </div>
                <div className="mt-2">{q.text}</div>
                {q.guidance && <div className="text-xs text-gray-600 mt-1">Juhend auditeerijale: {q.guidance}</div>}

                {/* --- STAATUS (VS / PE / MV) CHECKBOXID --- */}
                <div className="mt-2 flex gap-3 flex-wrap items-center">
                  <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={!!a.vs}
                      onChange={() =>
                        setAnswers(p => {
                          const cur = p[q.id] || {}
                          const next = { ...cur, vs: !cur.vs }
                          if (next.vs) next.mv = false // VS sisse -> MV maha
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
                          if (next.pe) next.mv = false // PE sisse -> MV maha
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
                          if (next.mv) { next.vs = false; next.pe = false } // MV sisse -> VS/PE maha
                          return { ...p, [q.id]: next }
                        })
                      }
                    />
                    Mittevastavus
                  </label>
                </div>

                {/* --- TÃµendid / MÃ¤rkus: laiused vahetuses, 3Ã— kÃµrgem, auto-grow --- */}
                <div className="mt-2 grid md:grid-cols-3 gap-2 items-stretch">
                  {/* TÃµendid â€” 1/3 lai, min-h-32, kasvab sisuga */}
                  <textarea
                    className="border rounded px-2 py-1 md:col-span-1 min-h-32 resize-y"
                    placeholder="TÃµendid"
                    value={a.evidence || ''}
                    onInput={autoResize}
                    onChange={e =>
                      setAnswers(p => ({ ...p, [q.id]: { ...p[q.id], evidence: e.target.value } }))
                    }
                  />

                  {/* MÃ¤rkus â€” 2/3 lai, min-h-32, nÃµude korral punane raam, kasvab sisuga */}
                  <textarea
                    id={'note-' + q.id}
                    className={
                      'border rounded px-2 py-1 md:col-span-2 min-h-32 resize-y ' +
                      (((a.mv || a.pe) && !(a.note && a.note.trim())) ? 'border-red-500 ring-1 ring-red-300' : '')
                    }
                    placeholder={
                      ((a.mv || a.pe) && !(a.note && a.note.trim()))
                        ? 'MÃ¤rkus: PE/MV (kohustuslik)'
                        : 'MÃ¤rkus: PE/MV'
                    }
                    value={a.note || ''}
                    onInput={autoResize}
                    onChange={e =>
                      setAnswers(p => ({ ...p, [q.id]: { ...p[q.id], note: e.target.value } }))
                    }
                  />
                </div>
              </div>
            )})}
            <div className="flex justify-end">
              <button className="px-4 py-2 rounded border" onClick={submitAudit}>Salvesta audit</button>
            </div>
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

function LoginForm({ defaultEmail, defaultPass, onLogin }: { defaultEmail: string; defaultPass: string; onLogin: (e:string,p:string)=>void }) {
  const [email, setEmail] = useState(defaultEmail)
  const [pass, setPass] = useState(defaultPass)
  return (
    <div className="flex items-center gap-2">
      <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} />
      <input type="password" className="border rounded px-2 py-1" value={pass} onChange={e=>setPass(e.target.value)} />
      <button className="px-3 py-1 border rounded" onClick={()=>onLogin(email, pass)}>Login</button>
    </div>
  )
}

