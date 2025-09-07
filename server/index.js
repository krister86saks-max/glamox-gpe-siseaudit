// server/index.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import crypto from 'crypto' // <-- lisatud

const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

// --- middleware ---
app.use(express.json())
app.use(helmet())
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }))
app.use(cors())

// __dirname (ESM)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// --- LowDB setup ---
const dataDir = process.env.DATA_DIR || '/tmp'
fs.mkdirSync(dataDir, { recursive: true })
const dbFile = path.join(dataDir, 'data.json')
const adapter = new JSONFile(dbFile)
const db = new Low(adapter, { users: [], departments: [], questions: [], audits: [], answers: [] })
await db.read()
db.data ||= { users: [], departments: [], questions: [], audits: [], answers: [] }
const save = () => db.write()

// --- Admin auto-bootstrap (kui baasis pole kasutajaid) ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
if ((db.data.users?.length ?? 0) === 0 && ADMIN_EMAIL && ADMIN_PASSWORD) {
  const password_hash = bcrypt.hashSync(ADMIN_PASSWORD, 10)
  db.data.users.push({
    id: crypto.randomUUID(),
    email: ADMIN_EMAIL,
    role: 'admin',
    password_hash,
  })
  await save()
  console.log('Bootstrap: loodud admin kasutaja ->', ADMIN_EMAIL)
}

// --- (valikuline) Auto-seed kui tühi (ainult kui tabelid on tühjad) ---
if ((db.data.departments?.length ?? 0) === 0 && (db.data.questions?.length ?? 0) === 0) {
  db.data.departments.push(
    { id: 'dep-too', name: 'Tööohutus' },
    { id: 'dep-keskk', name: 'Keskkond' },
    { id: 'dep-kval', name: 'Kvaliteet' }
  )
  db.data.questions.push(
    {
      id: 'q-001',
      department_id: 'dep-too',
      text: 'Kas riskihindamine on ajakohastatud?',
      clause: '6.1.2',
      stds: ['ISO45001:6.1.2'],
      guidance: null,
      tags: ['tööohutus']
    },
    {
      id: 'q-002',
      department_id: 'dep-keskk',
      text: 'Kas keskkonnaaspektide register on üle vaadatud?',
      clause: '6.1.2',
      stds: ['ISO14001:6.1.2'],
      guidance: null,
      tags: ['keskkond']
    },
    {
      id: 'q-003',
      department_id: 'dep-kval',
      text: 'Kas kvaliteedieesmärgid on mõõdetavad?',
      clause: '6.2',
      stds: ['ISO9001:6.2'],
      guidance: null,
      tags: ['kvaliteet']
    }
  )
  await save()
  console.log('Auto-seed: lisasin demo osakonnad ja küsimused (tühja baasi korral).')
}

// --- AUTH MIDDLEWARE ---
function authRequired(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: 'missing token' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'invalid token' })
  }
}
function requireRole(role) {
  return (req, res, next) => {
    const roles = Array.isArray(role) ? role : [role]
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    next()
  }
}

// --- Healthcheck ---
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// --- LOGIN ---
async function handleLogin(req, res) {
  const { email, password } = req.body || {}
  const user = db.data.users.find(u => u.email === email)
  if (!user) return res.status(401).json({ error: 'invalid credentials' })
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' })
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '6h' }
  )
  res.json({ token, role: user.role, email: user.email })
}
app.post('/auth/login', handleLogin)        // backward compat
app.post('/api/admin/login', handleLogin)   // UI kasutab seda
app.post('/api/login', handleLogin)

// --- Avalik skeem (dept + nende küsimused) ---
app.get('/api/schema', (_req, res) => {
  const deps = db.data.departments
  const questions = db.data.questions
  const schema = {
    meta: { version: 'glx-gpe-render', org: '(server)' },
    departments: deps.map(d => ({
      id: d.id,
      name: d.name,
      questions: questions
        .filter(q => q.department_id === d.id)
        .map(q => ({
          id: q.id,
          text: q.text,
          clause: q.clause || undefined,
          stds: q.stds || [],
          guidance: q.guidance || undefined,
          tags: q.tags || []
        }))
    }))
  }
  res.json(schema)
})

// --- Osakonnad (GET + CRUD) ---
app.get('/api/departments', authRequired, requireRole(['admin', 'auditor', 'external']), (_req, res) => {
  res.json(db.data.departments || [])
})
app.get('/api/departments/:id', authRequired, requireRole(['admin', 'auditor', 'external']), (req, res) => {
  const dep = (db.data.departments || []).find(d => d.id === req.params.id)
  if (!dep) return res.status(404).json({ error: 'not found' })
  res.json(dep)
})
app.post('/api/departments', authRequired, requireRole('admin'), async (req, res) => {
  const { id, name } = req.body || {}
  if (!id || !name) return res.status(400).json({ error: 'id and name required' })
  if (db.data.departments.find(d => d.id === id)) return res.status(400).json({ error: 'id exists' })
  db.data.departments.push({ id, name })
  await save()
  res.json({ ok: true })
})
app.put('/api/departments/:id', authRequired, requireRole('admin'), async (req, res) => {
  const dep = db.data.departments.find(d => d.id === req.params.id)
  if (!dep) return res.status(404).json({ error: 'not found' })
  dep.name = req.body.name ?? dep.name
  await save()
  res.json({ ok: true })
})
app.delete('/api/departments/:id', authRequired, requireRole('admin'), async (req, res) => {
  db.data.questions = db.data.questions.filter(q => q.department_id !== req.params.id)
  db.data.departments = db.data.departments.filter(d => d.id !== req.params.id)
  await save()
  res.json({ ok: true })
})

// --- Küsimused (CRUD) ---
app.post('/api/questions', authRequired, requireRole('admin'), async (req, res) => {
  const { id, department_id, text, clause, stds, guidance, tags } = req.body || {}
  if (!id || !department_id || !text || !stds) {
    return res.status(400).json({ error: 'id, department_id, text, stds required' })
  }
  db.data.questions.push({
    id,
    department_id,
    text,
    clause: clause || null,
    stds: Array.isArray(stds) ? stds : String(stds).split(' '),
    guidance: guidance || null,
    tags: tags || []
  })
  await save()
  res.json({ ok: true })
})
app.put('/api/questions/:id', authRequired, requireRole('admin'), async (req, res) => {
  const q = db.data.questions.find(x => x.id === req.params.id)
  if (!q) return res.status(404).json({ error: 'not found' })
  const { text, clause, stds, guidance, department_id } = req.body || {}
  if (text !== undefined) q.text = text
  if (clause !== undefined) q.clause = clause
  if (stds !== undefined) q.stds = Array.isArray(stds) ? stds : String(stds).split(' ')
  if (guidance !== undefined) q.guidance = guidance
  if (department_id !== undefined) q.department_id = department_id
  await save()
  res.json({ ok: true })
})
app.delete('/api/questions/:id', authRequired, requireRole('admin'), async (req, res) => {
  db.data.questions = db.data.questions.filter(q => q.id !== req.params.id)
  await save()
  res.json({ ok: true })
})

// --- Auditid ---
app.post('/api/audits', authRequired, requireRole(['admin', 'auditor']), async (req, res) => {
  const { org, department_id, standards, answers } = req.body || {}
  const id = (db.data.audits.at(-1)?.id || 0) + 1
  db.data.audits.push({
    id,
    org: org || null,
    department_id,
    standards: standards || [],
    created_at: new Date().toISOString()
  })
  for (const a of (answers || [])) db.data.answers.push({ audit_id: id, ...a })
  await save()
  res.json({ ok: true, audit_id: id })
})
app.get('/api/audits/:id', authRequired, requireRole(['admin', 'auditor', 'external']), (req, res) => {
  const a = db.data.audits.find(x => x.id === Number(req.params.id))
  if (!a) return res.status(404).json({ error: 'not found' })
  const ans = db.data.answers.filter(x => x.audit_id === a.id)
  res.json({ audit: a, answers: ans })
})
app.put('/api/audits/:id/header', authRequired, requireRole(['admin', 'auditor']), async (req, res) => {
  const audit = db.data.audits.find(x => x.id === Number(req.params.id))
  if (!audit) return res.status(404).json({ error: 'not found' })
  const { date, auditor_name, auditee_name, sub_department } = req.body || {}
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Kuupäev (YYYY-MM-DD) on kohustuslik' })
  }
  if (!auditor_name) return res.status(400).json({ error: 'Auditeerija nimi on kohustuslik' })
  if (!auditee_name) return res.status(400).json({ error: 'Auditeeritav on kohustuslik' })
  audit.date = date
  audit.auditor_name = auditor_name
  audit.auditee_name = auditee_name
  audit.sub_department = sub_department ?? null
  await save()
  res.json({ ok: true })
})

// --- Serveeri Vite build (client/dist) ---
const clientDist = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  // Kõik mitte-API teed -> index.html (SPA)
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
} else {
  console.warn('Client dist not found. Did you run "cd client && npm run build"?')
}

app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`)
})
