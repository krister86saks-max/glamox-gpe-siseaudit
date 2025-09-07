import express from 'express'
import path from 'path'
import fs from 'fs'

const app = express()
app.use(express.json())

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const STORE_FILE = path.join(DATA_DIR, 'store.json')

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify({ audits: {}, departments: [] }, null, 2))
}
function readStore() {
  ensureStore()
  try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) } catch { return { audits: {}, departments: [] } }
}
function writeStore(obj) {
  ensureStore()
  fs.writeFileSync(STORE_FILE, JSON.stringify(obj, null, 2))
}

// --- API ---
app.get('/api/audits/:id/header', (req, res) => {
  const store = readStore()
  const id = req.params.id
  const audit = store.audits[id] || {}
  res.json({ auditor: audit.auditor || '', auditee: audit.auditee || '', date: audit.date || '' })
})

app.put('/api/audits/:id/header', (req, res) => {
  const store = readStore()
  const id = req.params.id
  const { auditor = '', auditee = '', date = '' } = req.body || {}
  store.audits[id] = { ...(store.audits[id] || {}), auditor, auditee, date }
  writeStore(store)
  res.json({ ok: true })
})

// Static client
const PUBLIC_DIR = path.join(process.cwd(), 'server', 'public')
app.use(express.static(PUBLIC_DIR))
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log('Server listening on', PORT))
