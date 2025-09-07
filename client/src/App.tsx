import React, { useEffect, useMemo, useRef, useState } from 'react'
import Logo from './components/Logo'
import AuditorHeader from './components/AuditorHeader'
import DepartmentSelect from './components/DepartmentSelect'
import Summary, { SummaryItem } from './components/summary'
import Login from './pages/Login'

type Verdict = 'VS' | 'PE' | 'MV' | null
type Question = {
  id: string
  text: string
  clause?: string
  department?: string
  verdict: Verdict
  note?: string
  evidence?: string
}

function AutoResizeTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const onInput: React.FormEventHandler<HTMLTextAreaElement> = (e) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
    props.onInput?.(e)
  }
  useEffect(() => {
    const el = ref.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [props.value])
  return <textarea {...props} ref={ref} onInput={onInput} className={'w-full border rounded p-2 resize-none ' + (props.className ?? '')} rows={1} />
}

async function fetchQuestionsMock(): Promise<Question[]> {
  return [
    { id: 'Q-001', text: 'Kas riskihindamine on ajakohastatud?', clause: 'ISO 45001: 6.1.2', department: 'Tööohutus', verdict: null, note: '', evidence: '' },
    { id: 'Q-002', text: 'Kas keskkonnaaspektide register on üle vaadatud?', clause: 'ISO 14001: 6.1.2', department: 'Keskkond', verdict: null, note: '', evidence: '' },
    { id: 'Q-003', text: 'Kas kvaliteedieesmärgid on mõõdetavad?', clause: 'ISO 9001: 6.2', department: 'Kvaliteet', verdict: null, note: '', evidence: '' },
  ]
}

export default function App() {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('token'))
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [department, setDepartment] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await fetchQuestionsMock()
        if (!mounted) return
        setQuestions(data)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('audit-questions')
    if (raw) {
      try {
        const restored: Question[] = JSON.parse(raw)
        if (restored?.length) setQuestions(restored)
      } catch {}
    }
  }, [])
  useEffect(() => {
    if (!loading) localStorage.setItem('audit-questions', JSON.stringify(questions))
  }, [questions, loading])

  function setVerdict(id: string, verdict: Verdict) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, verdict } : q)))
  }
  function setNote(id: string, note: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, note } : q)))
  }
  function setEvidence(id: string, evidence: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, evidence } : q)))
  }

  const summaryMV: SummaryItem[] = useMemo(
    () => questions.filter((q) => q.verdict === 'MV').map((q) => ({ id: q.id, text: q.text, note: q.note || '', clause: q.clause })),
    [questions]
  )
  const summaryPE: SummaryItem[] = useMemo(
    () => questions.filter((q) => q.verdict === 'PE').map((q) => ({ id: q.id, text: q.text, note: q.note || '', clause: q.clause })),
    [questions]
  )

  if (!authed) {
    return <Login onLoggedIn={() => setAuthed(true)} />
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <Logo />
        <button
          className="text-sm underline"
          onClick={() => { sessionStorage.removeItem('token'); setAuthed(false); }}
        >
          Logi välja
        </button>
      </div>

      <AuditorHeader auditId="draft" />

      <div className="border rounded bg-white/40 p-4">
        <div className="font-semibold mb-2">Osakond</div>
        <DepartmentSelect value={department} onChange={setDepartment} />
      </div>

      <div className="border rounded bg-white/40">
        <div className="px-4 py-3 border-b font-semibold">Küsimused</div>
        {loading ? (
          <div className="p-4 text-sm text-gray-600">Laen...</div>
        ) : questions.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">Küsimusi ei leitud.</div>
        ) : (
          <ul className="divide-y">
            {questions.map((q) => (
              <li key={q.id} className="p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="text-xs px-2 py-0.5 rounded border font-mono">{q.id}</span>
                  {q.clause ? <span className="text-xs px-2 py-0.5 rounded border">Standardi nõue: {q.clause}</span> : null}
                  <span className="text-xs px-2 py-0.5 rounded border">{department || q.department || '—'}</span>
                </div>

                <div className="mt-1">{q.text}</div>

                <div className="mt-2 flex items-center gap-4">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={q.verdict === 'VS'} onChange={() => setVerdict(q.id, q.verdict === 'VS' ? null : 'VS')} />
                    <span>VS</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={q.verdict === 'PE'} onChange={() => setVerdict(q.id, q.verdict === 'PE' ? null : 'PE')} />
                    <span>PE</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={q.verdict === 'MV'} onChange={() => setVerdict(q.id, q.verdict === 'MV' ? null : 'MV')} />
                    <span className="text-red-700 font-medium">MV</span>
                  </label>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Märkus</div>
                    <AutoResizeTextarea value={q.note ?? ''} onChange={(e) => setNote(q.id, e.target.value)} placeholder="Lisa märkus..." />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Tõendid</div>
                    <AutoResizeTextarea value={q.evidence ?? ''} onChange={(e) => setEvidence(q.id, e.target.value)} placeholder="Lisa tõendid..." />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Summary mv={summaryMV} pe={summaryPE} />
    </div>
  )
}
