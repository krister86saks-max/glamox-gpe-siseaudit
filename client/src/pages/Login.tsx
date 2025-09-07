import React, { useState } from 'react'

const ENDPOINTS = ['/api/login', '/api/admin/login', '/api/auth/login']

async function tryLogin(email: string, password: string): Promise<string> {
  const payload = JSON.stringify({ email, password })
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const token = data?.token || (data?.ok && 'ok') || ''
        if (token) return token
        throw new Error('Login vastus ei sisalda tokenit.')
      } else if (res.status === 404 || res.status === 405) {
        continue
      } else {
        const text = await res.text().catch(() => 'Viga')
        throw new Error(text)
      }
    } catch (e) {
      continue
    }
  }
  throw new Error('Login endpoint puudub (404/405). Seadista serveri /api/login või /api/admin/login.')
}

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [devBypass, setDevBypass] = useState(false)

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)
    try {
      let token = ''
      if (devBypass) {
        token = 'dev'
      } else {
        token = await tryLogin(email, password)
      }
      sessionStorage.setItem('token', token)
      onLoggedIn()
    } catch (err: any) {
      setMsg(err?.message || 'Sisselogimine ebaõnnestus')
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
        <label className="text-sm inline-flex items-center gap-2">
          <input type="checkbox" checked={devBypass} onChange={(e) => setDevBypass(e.target.checked)} />
          Dev-bypass (loo ajutine sessioon ilma serverita)
        </label>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded py-2 disabled:opacity-60"
        >
          {loading ? 'Sisselogimine...' : 'Logi sisse'}
        </button>
        {msg && <div className="text-sm text-red-700 whitespace-pre-wrap">{msg}</div>}
        {!msg && (
          <div className="text-xs text-gray-600">
            Kui näed viga <code>Cannot POST /api/login</code>, märgi korraks <b>Dev-bypass</b>, et edasi liikuda.
          </div>
        )}
      </form>
    </div>
  )
}
