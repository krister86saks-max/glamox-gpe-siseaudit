// server/index.js
// Täielik backend koos admin loginiga (avalik vaatamine, admin saab muuta)

import express from 'express'
import path from 'path'
import fs from 'fs'

const app = express()
app.use(express.json())

// -------------------- ANDMEPOOD --------------------
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const STORE_FILE = path.join(DATA_DIR, 'store.json')

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(STORE_FILE)) {
    const initial = { audits: {}, departments: [] }
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2))
  }
}
function readStore() {
  ensureStore()
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'))
  } catch {
    return { audits: {}, departments: [] }
  }
}
function writeStore(obj) {
  ensureStore()
  fs.writeFileSync(STORE_FILE, JSON.stringify(obj, null, 2))
}

// -------------------- ADMIN LOGIN --------------------
// Pane need Renderi keskkonnamuutujatesse (Settings → Environment)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me'

// Väga lihtne kaitse: Authorization: Bearer <ADMIN_TOKEN>
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\\s+/i, '')
  if (token === ADMIN_TOKEN) return next()
  return res.status(401).json({ error: 'Unauthorized' })
}

// POST /api/login -> { token }
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {}
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ token: ADMIN_TOKEN })
  }
  return res.status(401).json({ error: 'Invalid credentials' })
})

// -------------------- API (avalik vaatamine) --------------------
// Päise lugemine on avalik (kasutaja näeb valmis vaadet)
app.get('/api/audits/:id/header', (req, res) => {
  const store = readStore()
  const id = req.params.id
  const audit = store.audits[id] || {}
  res.json({
    auditor: audit.auditor || '',
    auditee: audit.auditee || '',
    date: audit.date || '',
  })
})

// Osakondade nimekiri (avalik lugemine)
app.get('/api/departments', (_req, res) => {
  const store = readStore()
  // kui tühi, initsialiseeri mõistliku komplektiga
  if (!Array.isArray(store.departments) || store.departments.length === 0) {
    store.departments = [
      'Juhatus',
      'Kvaliteet',
      'HR',
      'Müük',
      'Tootearendus',
      'Tööohutus',
      'Tootmine',
      'Tehniline meeskond',
      'Ostmine',
      'Logistika',
      'Ladu (valmistoodang)',
      'IT',
    ]
    writeStore(store)
  }
  res.json({ departments: store.departments.map((name) => ({ name })) })
})

// (soovi korral) Avalik kombineeritud vaatamiseks
app.get('/api/audits/:id', (req, res) => {
  const store = readStore()
  const id = req.params.id
  const audit = store.audits[id] || {}
  // Kui hiljem lisad "questions" salvestuse, lisa siia ka questions
  res.json({
    header: {
      auditor: audit.auditor || '',
      auditee: audit.auditee || '',
      date: audit.date || '',
    },
    questions: audit.questions || [],
  })
})

// -------------------- API (admin muudab) --------------------
// Päise salvestus – ainult admin
app.put('/api/audits/:id/header', requireAdmin, (req, res) => {
  const store = readStore()
  const id = req.params.id
  const { auditor = '', auditee = '', date = '' } = req.body || {}
  store.audits[id] = { ...(store.audits[id] || {}), auditor, auditee, date }
  writeStore(store)
  res.json({ ok: true })
})

// Osakondade uuendamine – ainult admin
app.put('/api/departments', requireAdmin, (req, res) => {
  const store = readStore()
  const list = req.body?.departments
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'Body peab sisaldama departments: string[]' })
  }
  store.departments = list
  writeStore(store)
  res.json({ ok: true, count: store.departments.length })
})

// (näidis) Küsimuste salvestus – ainult admin (kui tahad hiljem lisada)
app.put('/api/audits/:id/questions', requireAdmin, (req, res) => {
  const store = readStore()
  const id = req.params.id
  const questions = Array.isArray(req.body?.questions) ? req.body.questions : []
  store.audits[id] = { ...(store.audits[id] || {}), questions }
  writeStore(store)
  res.json({ ok: true, count: questions.length })
})

// Tervisekontroll
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// -------------------- STATIC CLIENT --------------------
const PUBLIC_DIR = path.join(process.cwd(), 'server', 'public')
app.use(express.static(PUBLIC_DIR))
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'))
})

// -------------------- START --------------------
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log('Server listening on', PORT))
