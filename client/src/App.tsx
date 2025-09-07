import React, { useEffect, useMemo, useState } from 'react'
import AuditorHeader from './components/AuditorHeader';

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
      alert(`Küsimusel ${id} on PE või MV — palun täida "Märkus: PE/MV".`)
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
    else alert(j.error || 'Salvestus ebaõnnestus')
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
              <button className="px-2 py-1 border rounded" onClick={() => { setToken(null); setRole(null); }}>Logi välja</button>
            </div>
          )}
        </div>
      </header>

      <AuditorHeader auditId="1" />

      {!schema ? <div>Laen skeemi...</div> : (
        <div className="grid md:grid-cols-4 gap-4">
          <div className="space-y-3">
            <div className="p-3 border rounded">
              <label className="block text-xs font-semibold">Ettevõtte nimi</label>
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
              <input className="w-full border rounded px-2 py-1" value={query} onChange={e => setQuery(e.target.value)} placeholder="küsimus, klausel..." />
            </div>
          </div>

          <div className="md:col-span-3 space-y-3">
            {!dept ? <div>Vali osakond</div> : visible.map((q) => {
              const a = answers[q.id] || {}
              return (
                <div key={q.id} className="p-3 border rounded">
                  <div className="flex items-start gap-2">
                    <span className="text-xs border px-2 py-0.5 rounded">{q.id}</span>
                    {q.clause && <span className="text-xs border px-2 py-0.5 rounded">Standardi nõue: {q.clause}</span>}
                  </div>
                  <div className="mt-2">{q.text}</div>
                  {q.guidance && <div className="text-xs text-gray-600 mt-1">Juhend auditeerijale: {q.guidance}</div>}

                  {/* Nupud */}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Toggle label="Vastab standardile" active={!!a.vs} color="green" onClick={()=> setAnswers(p=>{ const cur = p[q.id]||{}; if (cur.mv) return {...p, [q.id]: {...cur, mv:false, vs: !(cur.vs)} }; return {...p, [q.id]: {...cur, vs: !(cur.vs)} } })} />
                    <Toggle label="Parendusettepanek" active={!!a.pe} color="blue" onClick={()=> setAnswers(p=>{ const cur = p[q.id]||{}; if (cur.mv) return {...p, [q.id]: {...cur, mv:false, pe: !(cur.pe)} }; return {...p, [q.id]: {...cur, pe: !(cur.pe)} } })} />
                    <Toggle label="Mittevastavus" active={!!a.mv} color="red" onClick={()=> setAnswers(p=>{ const cur = p[q.id]||{}; return {...p, [q.id]: {...cur, mv: !(cur.mv), vs: false, pe:false } } })} />
                  </div>

                  {/* Märkus + Tõendid */}
                  <div className="mt-2 grid md:grid-cols-3 gap-2">
                    <textarea
                      id={'note-' + q.id}
                      className={'border rounded px-2 py-1 md:col-span-2 h-auto min-h-[6rem]'}
                      placeholder="Märkus: PE/MV"
                      value={a.note || ''}
                      onChange={e => setAnswers(p=>({...p, [q.id]: {...p[q.id], note:e.target.value}}))}
                      rows={3}
                      style={{ resize: 'vertical', overflow: 'hidden' }}
                      onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                    />
                    <textarea
                      className="border rounded px-2 py-1 h-auto min-h-[2.5rem]"
                      placeholder="Tõendid"
                      value={a.evidence || ''}
                      onChange={e => setAnswers(p=>({...p, [q.id]: {...p[q.id], evidence:e.target.value}}))}
                      rows={2}
                      style={{ resize: 'vertical', overflow: 'hidden' }}
                      onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                    />
                  </div>
                </div>
              )
            })}
            <div className="flex justify-end">
              <button className="px-4 py-2 rounded border" onClick={submitAudit}>Salvesta audit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ label, active, onClick, color }: { label: string; active: boolean; onClick: ()=>void; color: 'green'|'red'|'blue' }) {
  const colors: any = {
    green: active ? 'bg-green-600 text-white border-green-700' : 'border-green-600 text-green-700',
    red: active ? 'bg-red-600 text-white border-red-700' : 'border-red-600 text-red-700',
    blue: active ? 'bg-blue-600 text-white border-blue-700' : 'border-blue-600 text-blue-700',
  }
  return <button className={'px-3 py-1 rounded border ' + colors[color]} onClick={onClick}>{label}</button>
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


