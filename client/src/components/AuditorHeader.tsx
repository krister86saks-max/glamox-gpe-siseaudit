import React, { useEffect, useState } from 'react'

type AuditorHeaderProps = { auditId: string }

export default function AuditorHeader({ auditId }: AuditorHeaderProps) {
  const [auditor, setAuditor] = useState('')
  const [auditee, setAuditee] = useState('')
  const [date, setDate] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    // Try load header (no auth needed here)
    ;(async () => {
      try {
        const res = await fetch(`/api/audits/${auditId}/header`)
        if (res.ok) {
          const data = await res.json()
          setAuditor(data.auditor || '')
          setAuditee(data.auditee || '')
          setDate(data.date || '')
        }
      } catch {}
    })()
  }, [auditId])

  async function saveHeader() {
    try {
      const res = await fetch(`/api/audits/${auditId}/header`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditor, auditee, date }),
      })
      if (!res.ok) throw new Error(await res.text())
      setMessage('Salvestatud!')
      setTimeout(() => setMessage(null), 2000)
    } catch (err: any) {
      setMessage('Viga: ' + (err.message || 'salvestamisel'))
      setTimeout(() => setMessage(null), 4000)
    }
  }

  return (
    <div className="mb-6 p-4 border rounded bg-white/40">
      <h2 className="text-lg font-semibold mb-2">Audiitori info</h2>
      <div className="flex flex-col gap-2">
        <input type="text" className="border p-1 rounded" placeholder="Audiitor" value={auditor} onChange={e=>setAuditor(e.target.value)} />
        <input type="text" className="border p-1 rounded" placeholder="Auditeeritav" value={auditee} onChange={e=>setAuditee(e.target.value)} />
        <input type="date" className="border p-1 rounded" value={date} onChange={e=>setDate(e.target.value)} />
        <button onClick={saveHeader} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Salvesta päis</button>
        {message && <div className="text-sm mt-1">{message}</div>}
      </div>
    </div>
  )
}
