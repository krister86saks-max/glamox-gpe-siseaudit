import React, { useEffect, useState } from 'react'

type Props = {
  value?: string
  onChange: (v: string) => void
}

export default function DepartmentSelect({ value = '', onChange }: Props) {
  const [options, setOptions] = useState<string[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const token = sessionStorage.getItem('token')
        const res = await fetch('/api/departments', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        if (!mounted) return
        const names = (data?.departments || data || []).map((d: any) => d.name || d)
        setOptions(names)
      } catch (e: any) {
        setMsg('Osakondade nimekirja ei saanud laadida; vali käsitsi.')
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <select
        className="border rounded p-2 min-w-[220px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Vali osakond —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
    </div>
  )
}
