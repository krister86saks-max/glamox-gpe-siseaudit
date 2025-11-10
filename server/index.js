// server/index.js — Mongo + Supplier Templates CRUD + fallback static + version
import 'dotenv/config'
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
import { MongoClient } from 'mongodb'

// --- VERSION TAG (näidatakse logis ja /__version vastuses)
const APP_VERSION = 'v-2025-11-10-supplier-templates'

const app = express()
// NB: mallid võivad olla suured -> tõstame limiiti
app.use(express.json({ limit: '2mb' }))
app.use(helmet())
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }))
app.use(cors())

const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------- MongoDB ----------
const MONGODB_URI = process.env.MONGODB_URI
const MONGODB_DB  = process.env.MONGODB_DB || 'glamox_gpe'
if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI env var')
  process.exit(1)
}
const client = new MongoClient(MONGODB_URI)
await client.connect()
const db = client.db(MONGODB_DB)

const Users       = db.collection('users')
const Departments = db.collection('departments')
const Questions   = db.collection('questions')
const Audits      = db.collection('audits')
const Answers     = db.collection('answers')
// UUS: tarnijaauditi mallid
const SupplierTemplates = db.collection('supplier_audit_templates')

await Users.createIndex({ email: 1 }, { unique: true })
await Departments.createIndex({ id: 1 }, { unique: true })
await Questions.createIndex({ id: 1 }, { unique: true })
await Audits.createIndex({ id: 1 }, { unique: true })
// UUS: indeksid mallidele
await SupplierTemplates.createIndex({ id: 1 }, { unique: true })
await SupplierTemplates.createIndex({ name: 1 })

// --- Admin bootstrap ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const existing = await Users.findOne({ email: ADMIN_EMAIL })
  const password_hash = bcrypt.hashSync(ADMIN_PASSWORD, 10)
  if (!existing) {
    await Users.insertOne({ id: crypto.randomUUID(), email: ADMIN_EMAIL, role: 'admin', password_hash })
    console.log('Bootstrap: loodud admin kasutaja ->', ADMIN_EMAIL)
  } else if (!bcrypt.compareSync(ADMIN_PASSWORD, existing.password_hash)) {
    await Users.updateOne({ _id: existing._id }, { $set: { password_hash } })
    console.log('Bootstrap: uuendasin admin parooli ->', ADMIN_EMAIL)
  }
}

// --- Auth helpers ---
function authRequired(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: 'missing token' })
  try { req.user = jwt.verify(token, JWT_SECRET); next() } catch { res.status(401).json({ error: 'invalid token' }) }
}
function requireRole(role) {
  return (req, res, next) => {
    const roles = Array.isArray(role) ? role : [role]
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}

// --- Login ---
app.post('/auth/login', async (req,res) => {
  const { email, password } = req.body || {}
  const user = await Users.findOne({ email })
  if (!user) return res.status(401).json({ error: 'invalid credentials' })
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'invalid credentials' })
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '6h' })
  res.json({ token, role: user.role, email: user.email })
})

// --- Schema ---
app.get('/api/schema', async (_req,res) => {
  const deps = await Departments.find({}).sort({ name: 1 }).toArray()
  const qs   = await Questions.find({}).toArray()
  const byDep = new Map(deps.map(d => [d.id, []]))
  for (const q of qs) {
    const list = byDep.get(q.department_id)
    if (list) list.push({
      id: q.id, text: q.text, clause: q.clause || undefined, stds: q.stds || [], guidance: q.guidance || undefined, tags: q.tags || []
    })
  }
  res.json({ meta: { version: 'glx-gpe-mongo', org: '(server)' },
             departments: deps.map(d => ({ id: d.id, name: d.name, questions: byDep.get(d.id) || [] })) })
})

// --- Departments CRUD ---
app.post('/api/departments', authRequired, requireRole('admin'), async (req,res) => {
  const { id, name } = req.body || {}
  if (!id || !name) return res.status(400).json({ error: 'id and name required' })
  try { await Departments.insertOne({ id, name }); res.json({ ok: true }) }
  catch (e) { if (String(e).includes('E11000')) return res.status(400).json({ error: 'id exists' }); throw e }
})
app.put('/api/departments/:id', authRequired, requireRole('admin'), async (req,res) => {
  const r = await Departments.updateOne({ id: req.params.id }, { $set: { name: req.body.name } })
  if (!r.matchedCount) return res.status(404).json({ error: 'not found' })
  res.json({ ok: true })
})
app.delete('/api/departments/:id', authRequired, requireRole('admin'), async (req,res) => {
  await Questions.deleteMany({ department_id: req.params.id })
  await Departments.deleteOne({ id: req.params.id })
  res.json({ ok: true })
})

// --- Questions CRUD ---
app.post('/api/questions', authRequired, requireRole('admin'), async (req,res) => {
  const { id, department_id, text, clause, stds, guidance, tags } = req.body || {}
  if (!id || !department_id || !text || !stds) return res.status(400).json({ error: 'id, department_id, text, stds required' })
  try {
    await Questions.insertOne({
      id, department_id, text,
      clause: clause || null,
      stds: Array.isArray(stds) ? stds : String(stds).split(' '),
      guidance: guidance || null,
      tags: tags || []
    })
    res.json({ ok: true })
  } catch (e) {
    if (String(e).includes('E11000')) return res.status(400).json({ error: 'id exists' })
    throw e
  }
})
app.put('/api/questions/:id', authRequired, requireRole('admin'), async (req,res) => {
  const { text, clause, stds, guidance, department_id } = req.body || {}
  const doc = {}
  if (text !== undefined) doc.text = text
  if (clause !== undefined) doc.clause = clause
  if (stds !== undefined) doc.stds = Array.isArray(stds) ? stds : String(stds).split(' ')
  if (guidance !== undefined) doc.guidance = guidance
  if (department_id !== undefined) doc.department_id = department_id
  const r = await Questions.updateOne({ id: req.params.id }, { $set: doc })
  if (!r.matchedCount) return res.status(404).json({ error: 'not found' })
  res.json({ ok: true })
})
app.delete('/api/questions/:id', authRequired, requireRole('admin'), async (_req,res) => {
  await Questions.deleteOne({ id: _req.params.id })
  res.json({ ok: true })
})

// --- Audits ---
app.post('/api/audits', authRequired, requireRole(['admin','auditor']), async (req,res) => {
  const { department_id, standards, answers } = req.body || {}
  const last = await Audits.find({}).sort({ id: -1 }).limit(1).toArray()
  const id = (last[0]?.id || 0) + 1
  await Audits.insertOne({ id, department_id, standards: standards || [], created_at: new Date().toISOString() })
  if (Array.isArray(answers) && answers.length) {
    const docs = answers.map(a => ({ audit_id: id, ...a }))
    await Answers.insertMany(docs)
  }
  res.json({ ok: true, audit_id: id })
})
app.get('/api/audits/:id', authRequired, requireRole(['admin','auditor','external']), async (req,res) => {
  const id = Number(req.params.id)
  const a = await Audits.findOne({ id })
  if (!a) return res.status(404).json({ error: 'not found' })
  const ans = await Answers.find({ audit_id: id }).toArray()
  res.json({ audit: a, answers: ans })
})

/* ===========================  Supplier Audit Templates  =========================== */
/* Toetame mõlemat path'i: /api/supplier/templates ja /api/supplier-audit-templates  */

function supplierTemplateRoutes(prefix) {
  // GET list
  app.get(`${prefix}`, async (_req, res) => {
    const list = await SupplierTemplates.find({}).project({ _id: 0 }).sort({ name: 1 }).toArray()
    res.json(list.map(t => ({ id: t.id, name: t.name, points: t.points || [] })))
  })

  // POST create (admin)
  app.post(`${prefix}`, authRequired, requireRole('admin'), async (req, res) => {
    const { name, points } = req.body || {}
    const doc = {
      id: crypto.randomUUID(),
      name: String(name || 'Uus mall'),
      points: Array.isArray(points) ? points : []
    }
    await SupplierTemplates.insertOne(doc)
    res.status(201).json({ id: doc.id, name: doc.name, points: doc.points })
  })

  // GET one
  app.get(`${prefix}/:id`, async (req, res) => {
    const t = await SupplierTemplates.findOne({ id: req.params.id })
    if (!t) return res.status(404).json({ error: 'not found' })
    res.json({ id: t.id, name: t.name, points: t.points || [] })
  })

  // PUT update (admin)
  app.put(`${prefix}/:id`, authRequired, requireRole('admin'), async (req, res) => {
    const patch = {}
    if (req.body.name !== undefined)   patch.name = String(req.body.name)
    if (req.body.points !== undefined) patch.points = Array.isArray(req.body.points) ? req.body.points : []
    const r = await SupplierTemplates.findOneAndUpdate(
      { id: req.params.id },
      { $set: patch },
      { returnDocument: 'after' }
    )
    if (!r.value) return res.status(404).json({ error: 'not found' })
    const t = r.value
    res.json({ id: t.id, name: t.name, points: t.points || [] })
  })

  // DELETE (admin)
  app.delete(`${prefix}/:id`, authRequired, requireRole('admin'), async (req, res) => {
    await SupplierTemplates.deleteOne({ id: req.params.id })
    res.json({ ok: true })
  })
}

supplierTemplateRoutes('/api/supplier/templates')
supplierTemplateRoutes('/api/supplier-audit-templates')
/* ================================================================================ */

// --- Version endpoint ---
app.get('/__version', (_req, res) => res.json({ version: APP_VERSION }))

// --- Static client: server/public või fallback client/dist ---
const SERVER_PUBLIC = path.join(__dirname, 'public')
const CLIENT_DIST   = path.resolve(__dirname, '../client/dist')

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

app.listen(PORT, () => console.log(`Glamox Auditor (Mongo) ${APP_VERSION} http://localhost:${PORT}`))
