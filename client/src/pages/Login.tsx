import React, { useState } from 'react'

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (!data?.token) throw new Error('Token puudub')
      sessionStorage.setItem('token', data.token)
      onLoggedIn()
    } catch (err: any) {
      setMsg(err.message || 'Sisselogimine ebaõnnestus')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 mt-10 border rounded bg-white/60">
      <h2 className="text-xl font-semibold mb-4">Logi sisse</h2>
      <form onSubmit={doLogin} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="E-post"
          className="border rounded p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Parool"
          className="border rounded p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded py-2 disabled:opacity-60"
        >
          {loading ? 'Sisselogimine...' : 'Logi sisse'}
        </button>
        {msg && <div className="text-sm text-red-700">{msg}</div>}
      </form>
    </div>
  )
}
