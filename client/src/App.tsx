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

  // Kaart küsimuste järgi, et kokkuvõttes näidata
  const questionById = useMemo(() => {
    const map = new Map<string, Question>()
    schema?.departments.forEach(d => d.questions.forEach(q => map.set(q.id, q)))
    return map
  }, [schema])

  const summaryPE = useMemo(() => {
    return Object.entries(answers)
      .filter(([, a]) => a?.pe && !a.mv)
      .map(([id, a]) => ({
        id,
        text: questionById.get(id)?.text ?? '(küsimus puudub skeemist)',
        note: a?.note || '',
      }))
  }, [answers, questionById])

  const summaryMV = useMemo(() => {
    return Object.entries(answers)
      .filter(([, a]) => a?.mv)
      .map(([id, a]) => ({
        id,
        text: questionById.get(id)?.text ?? '(küsimus puudub skeemist)',
        note: a?.note || '',
      }))
  }, [answers, questionById])

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
                    <span className="ml-auto flex items-center gap-1">
                      {a.mv && <Excl color="red" title="Mittevastavus" />}
                      {!a.mv && a.pe && <Excl color="blue" title="Parendusettepanek" />}
                      {!a.mv && a.vs && <Check color="green" title="Vastab standardile" />}
                    </span>
                  </div>
                  <div className="mt-2">{q.text}</div>
                  {q.guidance && <div className="text-xs text-gray-600 mt-1">Juhend auditeerijale: {q.guidance}</div>}

                  {/* Checkboxid valikuteks */}
                  <div className="mt-2 grid sm:grid-cols-3 gap-3">
                    <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={!!a.vs}
                        onChange={() =>
                          setAnswers(p => {
                            const cur = p[q.id] || {}
                            const next = cur.vs ? { ...cur, vs: false } : { ...cur, vs: true, pe: false, mv: false }
                            return { ...p, [q.id]: next }
                          })
                        }
                      />
                      <span>Vastab standardile</span>
                      {!!a.vs && <Check color="green" title="Vastab standardile" />}
                    </label>

                    <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={!!a.pe && !a.mv}
                        onChange={() =>
                          setAnswers(p => {
                            const cur = p[q.id] || {}
                            const next = cur.pe && !cur.mv
                              ? { ...cur, pe: false }
                              : { ...cur, pe: true, mv: false, vs: false }
                            return { ...p, [q.id]: next }
                          })
                        }
                      />
                      <span>Parendusettepanek</span>
                      {!!a.pe && !a.mv && <Excl color="blue" title="Parendusettepanek" />}
                    </label>

                    <label className="inline-flex items-center gap-2 border rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={!!a.mv}
                        onChange={() =>
                          setAnswers(p => {
                            const cur = p[q.id] || {}
                            const next = cur.mv
                              ? { ...cur, mv: false }
                              : { ...cur, mv: true, vs: false, pe: false }
                            return { ...p, [q.id]: next }
                          })
                        }
                      />
                      <span>Mittevastavus</span>
                      {!!a.mv && <Excl color="red" title="Mittevastavus" />}
                    </label>
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

            {/* Kokkuvõte */}
            {(summaryMV.length > 0 || summaryPE.length > 0) && (
              <div className="mt-8 p-4 border rounded">
                <h2 className="text-lg font-semibold mb-3">Kokkuvõte</h2>

                {summaryMV.length > 0 && (
                  <div className="mb-4">
                    <div className="font-semibold flex items-center gap-2">
                      <Excl color="red" title="Mittevastavused" /> Mittevastavused ({summaryMV.length})
                    </div>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      {summaryMV.map(item => (
                        <li key={'mv-' + item.id}>
                          <span className="font-mono">{item.id}</span> — {item.text}
                          {item.note ? <span className="block text-sm text-gray-600">Märkus: {item.note}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summaryPE.length > 0 && (
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      <Excl color="blue" title="Parendusettepanekud" /> Parendusettepanekud ({summaryPE.length})
                    </div>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      {summaryPE.map(item => (
                        <li key={'pe-' + item.id}>
                          <span className="font-mono">{item.id}</span> — {item.text}
                          {item.note ? <span className="block text-sm text-gray-600">Märkus: {item.note}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

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


