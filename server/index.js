// server/index.js — LowDB + ESM + fallback serve (public || client/dist)
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import crypto from 'crypto'

// LowDB
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_FILE = path.join(DATA_DIR, 'db.json')
const adapter = new JSONFile(DB_FILE)
const db = new Low(adapter, {
  users: [],
  departments: [],
  questions: [],
  audits: [],
  answers: [],
  supplier_audit_templates: []
})
await db.read()
if (!db.data) {
  db.data = {
    users: [],
    departments: [],
    questions: [],
    audits: [],
    answers: [],
    supplier_audit_templates: []
  }
  await db.write()
}

const app = express()
app.use(express.json())
app.use(helmet())
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }))
app.use(cors())

const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

// --- admin bootstrap ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!'
const existingAdmin = db.data.users.find(u => u.email === ADMIN_EMAIL)
if (!existingAdmin) {
  db.data.users.push({
    id: crypto.randomUUID(),
    email: ADMIN_EMAIL,
    role: 'admin',
    password_hash: bcrypt.hashSync(ADMIN_PASSWORD, 10)
  })
  await db.write()
  console.log('Bootstrap: loodud admin ->', ADMIN_EMAIL)
}

// --- auth middlewares ---
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
  const allow = Array.isArray(role) ? role : [role]
  return (req, res, next) => {
    if (!req.user || !allow.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}

// --- AUTH ---
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  const user = db.data.users.find(u => u.email === email)
  if (!user) return res.status(401).json({ error: 'invalid credentials' })
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'invalid credentials' })
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, role: user.role, email: user.email })
})

// --- SCHEMA (departments + questions) ---
app.get('/api/schema', async (_req, res) => {
  const deps = [...db.data.departments].sort((a, b) => a.name.localeCompare(b.name))
  const qs = db.data.questions
  const byDep = new Map(deps.map(d => [d.id, []]))
  for (const q of qs) {
    const arr = byDep.get(q.department_id)
    if (arr) arr.push({
      id: q.id, text: q.text,
      clause: q.clause || '', stds: q.stds || [], guidance: q.guidance || ''
    })
  }
  res.json({
    meta: { version: 'lowdb', org: 'Glamox' },
    departments: deps.map(d => ({ id: d.id, name: d.name, questions: byDep.get(d.id) || [] }))
  })
})

// --- Departments CRUD ---
app.post('/api/departments', authRequired, requireRole('admin'), async (req, res) => {
  const { id, name } = req.body || {}
  if (!id || !name) return res.status(400).json({ error: 'id and name required' })
  if (db.data.departments.find(d => d.id === id)) return res.status(400).json({ error: 'id exists' })
  db.data.departments.push({ id, name })
  await db.write()
  res.json({ ok: true })
})
app.put('/api/departments/:id', authRequired, requireRole('admin'), async (req, res) => {
  const d = db.data.departments.find(x => x.id === req.params.id)
  if (!d) return res.status(404).json({ error: 'not found' })
  d.name = req.body.name ?? d.name
  await db.write()
  res.json({ ok: true })
})
app.delete('/api/departments/:id', authRequired, requireRole('admin'), async (req, res) => {
  const depId = req.params.id
  db.data.questions = db.data.questions.filter(q => q.department_id !== depId)
  db.data.departments = db.data.departments.filter(d => d.id !== depId)
  await db.write()
  res.json({ ok: true })
})

// --- Questions CRUD ---
app.post('/api/questions', authRequired, requireRole('admin'), async (req, res) => {
  const { id, department_id, text, clause, stds, guidance } = req.body || {}
  if (!id || !department_id || !text) return res.status(400).json({ error: 'id, department_id, text required' })
  if (db.data.questions.find(q => q.id === id)) return res.status(400).json({ error: 'id exists' })
  db.data.questions.push({
    id, department_id, text,
    clause: clause || '',
    stds: Array.isArray(stds) ? stds : String(stds || '').split(/[ ,;]+/).filter(Boolean),
    guidance: guidance || ''
  })
  await db.write()
  res.json({ ok: true })
})
app.put('/api/questions/:id', authRequired, requireRole('admin'), async (req, res) => {
  const q = db.data.questions.find(x => x.id === req.params.id)
  if (!q) return res.status(404).json({ error: 'not found' })
  if (req.body.text !== undefined) q.text = req.body.text
  if (req.body.clause !== undefined) q.clause = req.body.clause
  if (req.body.stds !== undefined) q.stds = Array.isArray(req.body.stds) ? req.body.stds : String(req.body.stds || '').split(/[ ,;]+/).filter(Boolean)
  if (req.body.guidance !== undefined) q.guidance = req.body.guidance
  if (req.body.department_id !== undefined) q.department_id = req.body.department_id
  await db.write()
  res.json({ ok: true })
})
app.delete('/api/questions/:id', authRequired, requireRole('admin'), async (req, res) => {
  db.data.questions = db.data.questions.filter(q => q.id !== req.params.id)
  await db.write()
  res.json({ ok: true })
})

// --- Supplier Audit Templates (toetame mõlemat rada) ---
const listTemplates = () => [...db.data.supplier_audit_templates].sort((a, b) => a.name.localeCompare(b.name))
const getTpl = id => db.data.supplier_audit_templates.find(x => x.id === id)

function supplierRoutes(prefix) {
  app.get(`${prefix}`, async (_req, res) => {
    res.json(listTemplates())
  })
  app.post(`${prefix}`, authRequired, requireRole('admin'), async (req, res) => {
    const { name, points } = req.body || {}
    const doc = { id: crypto.randomUUID(), name: String(name || 'Uus audit'), points: Array.isArray(points) ? points : [] }
    db.data.supplier_audit_templates.push(doc)
    await db.write()
    res.status(201).json(doc)
  })
  app.get(`${prefix}/:id`, async (req, res) => {
    const t = getTpl(req.params.id)
    if (!t) return res.status(404).json({ error: 'not found' })
    res.json(t)
  })
  app.put(`${prefix}/:id`, authRequired, requireRole('admin'), async (req, res) => {
    const t = getTpl(req.params.id)
    if (!t) return res.status(404).json({ error: 'not found' })
    if (req.body.name !== undefined) t.name = String(req.body.name)
    if (req.body.points !== undefined) t.points = Array.isArray(req.body.points) ? req.body.points : []
    await db.write()
    res.json(t)
  })
  app.delete(`${prefix}/:id`, authRequired, requireRole('admin'), async (req, res) => {
    db.data.supplier_audit_templates = db.data.supplier_audit_templates.filter(x => x.id !== req.params.id)
    await db.write()
    res.json({ ok: true })
  })
}
supplierRoutes('/api/supplier/templates')
supplierRoutes('/api/supplier-audit-templates')

// --- serveeri frontend: server/public või fallback client/dist ---
const SERVER_PUBLIC = path.join(__dirname, 'public')
const CLIENT_DIST = path.resolve(__dirname, '../client/dist')

let STATIC_ROOT = null
if (fs.existsSync(path.join(SERVER_PUBLIC, 'index.html'))) {
  STATIC_ROOT = SERVER_PUBLIC
  console.log('Frontend: serving from server/public')
} else if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  STATIC_ROOT = CLIENT_DIST
  console.log('Frontend: serving from client/dist (fallback)')
} else {
  console.warn('Frontend: no build found (neither server/public nor client/dist)')
}

if (STATIC_ROOT) {
  app.use(express.static(STATIC_ROOT))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Glamox Auditor (LowDB) http://localhost:${PORT}`)
})
