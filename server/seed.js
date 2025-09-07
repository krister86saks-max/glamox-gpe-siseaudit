import fs from 'fs'
import path from 'path'
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const STORE_FILE = path.join(DATA_DIR, 'store.json')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(STORE_FILE)) {
  const initial = { audits: { draft: { auditor: '', auditee: '', date: '' } }, departments: [] }
  fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2))
  console.log('[seed] store.json created at', STORE_FILE)
} else {
  console.log('[seed] store.json exists at', STORE_FILE)
}
