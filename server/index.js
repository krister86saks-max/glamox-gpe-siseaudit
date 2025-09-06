
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

const app = express()
app.use(express.json())

app.use(helmet())
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }))
app.use(cors())

const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR || process.cwd()
const dbFile = path.join(dataDir, 'data.json')
const adapter = new JSONFile(dbFile)
const db = new Low(adapter, { users: [], departments: [], questions: [], audits: [], answers: [] })
await db.read()
db.data ||= { users: [], departments: [], questions: [], audits: [], answers: [] }
const save = () => db.write()

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

app.post('/auth/login', async (req,res) => {
  const { email, password } = req.body || {}
  const user = db.data.users.find(u => u.email === email)
  if (!user) return res.status(401).json({ error: 'invalid credentials' })
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'invalid credentials' })
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '6h' })
  res.json({ token, role: user.role, email: user.email })
})

app.get('/api/schema', (req,res) => {
  const deps = db.data.departments, questions = db.data.questions
  const schema = {
    meta: { version: 'glx-gpe-render', org: '(server)' },
    departments: deps.map(d => ({
      id: d.id, name: d.name,
      questions: questions.filter(q => q.department_id === d.id).map(q => ({
        id: q.id, text: q.text, clause: q.clause || undefined, stds: q.stds || [], guidance: q.guidance || undefined, tags: q.tags || []
      }))
    }))
  }
  res.json(schema)
})

app.post('/api/departments', authRequired, requireRole('admin'), async (req,res) => {
  const { id, name } = req.body || {}
  if (!id || !name) return res.status(400).json({ error: 'id and name required' })
  if (db.data.departments.find(d => d.id === id)) return res.status(400).json({ error: 'id exists' })
  db.data.departments.push({ id, name }); await save(); res.json({ ok: true })
})
app.put('/api/departments/:id', authRequired, requireRole('admin'), async (req,res) => {
  const dep = db.data.departments.find(d => d.id === req.params.id)
  if (!dep) return res.status(404).json({ error: 'not found' })
  dep.name = req.body.name ?? dep.name; await save(); res.json({ ok: true })
})
app.delete('/api/departments/:id', authRequired, requireRole('admin'), async (req,res) => {
  db.data.questions = db.data.questions.filter(q => q.department_id !== req.params.id)
  db.data.departments = db.data.departments.filter(d => d.id !== req.params.id)
  await save(); res.json({ ok: true })
})

app.post('/api/questions', authRequired, requireRole('admin'), async (req,res) => {
  const { id, department_id, text, clause, stds, guidance, tags } = req.body || {}
  if (!id || !department_id || !text || !stds) return res.status(400).json({ error: 'id, department_id, text, stds required' })
  db.data.questions.push({ id, department_id, text, clause: clause || null, stds: Array.isArray(stds)? stds : String(stds).split(' '), guidance: guidance || null, tags: tags || [] })
  await save(); res.json({ ok: true })
})
app.put('/api/questions/:id', authRequired, requireRole('admin'), async (req,res) => {
  const q = db.data.questions.find(x => x.id === req.params.id)
  if (!q) return res.status(404).json({ error: 'not found' })
  const { text, clause, stds, guidance, department_id } = req.body || {}
  if (text !== undefined) q.text = text
  if (clause !== undefined) q.clause = clause
  if (stds !== undefined) q.stds = Array.isArray(stds) ? stds : String(stds).split(' ')
  if (guidance !== undefined) q.guidance = guidance
  if (department_id !== undefined) q.department_id = department_id
  await save(); res.json({ ok: true })
})
app.delete('/api/questions/:id', authRequired, requireRole('admin'), async (req,res) => {
  db.data.questions = db.data.questions.filter(q => q.id !== req.params.id)
  await save(); res.json({ ok: true })
})

app.post('/api/audits', authRequired, requireRole(['admin','auditor']), async (req,res) => {
  const { org, department_id, standards, answers } = req.body || {}
  const id = (db.data.audits.at(-1)?.id || 0) + 1
  db.data.audits.push({ id, org: org || null, department_id, standards: standards || [], created_at: new Date().toISOString() })
  for (const a of answers) db.data.answers.push({ audit_id: id, ...a })
  await save(); res.json({ ok: true, audit_id: id })
})
app.get('/api/audits/:id', authRequired, requireRole(['admin','auditor','external']), (req,res) => {
  const a = db.data.audits.find(x => x.id === Number(req.params.id))
  if (!a) return res.status(404).json({ error: 'not found' })
  const ans = db.data.answers.filter(x => x.audit_id === a.id)
  res.json({ audit: a, answers: ans })
})

app.use(express.static(path.join(__dirname, 'public')))
app.get(/^(?!\/api).*/, (req,res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, () => console.log(`Glamox GPE Siseaudit (Render) http://localhost:${PORT}`))
