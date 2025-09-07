
import 'dotenv/config'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'

import bcrypt from 'bcryptjs'

const dataDir = process.env.DATA_DIR || process.cwd()
const dbFile = path.join(dataDir, 'data.json')
const adapter = new JSONFile(dbFile)
const db = new Low(adapter, { users: [], departments: [], questions: [], audits: [], answers: [] })
await db.read()
db.data ||= { users: [], departments: [], questions: [], audits: [], answers: [] }

function insertUser(email, password, role) {
  if (db.data.users.find(u => u.email === email)) return
  const id = (db.data.users.at(-1)?.id || 0) + 1
  db.data.users.push({ id, email, password_hash: bcrypt.hashSync(password, 10), role })
}
insertUser(process.env.ADMIN_EMAIL || 'krister.saks@glamox.com', process.env.ADMIN_PASSWORD || 'tipatapa86', 'admin')
insertUser('auditor@example.com', 'auditor123', 'auditor')
insertUser('external@example.com', 'external123', 'external')

if (!db.data.departments.find(d => d.id === 'ostmine')) db.data.departments.push({ id:'ostmine', name:'Ostmine' })
if (!db.data.questions.find(q => q.id === 'Q-001')) db.data.questions.push({ id:'Q-001', department_id:'ostmine', text:'Kas huvipooled ja nende nõuded on määratletud ning üle vaadatud?', clause:'ISO 9001:2015 – 4.2', stds:['9001'], guidance:'Kontrolli huvipoolte registrit ja ülevaatuste protokolle.' })

await db.write()
console.log('Seed done at', dbFile)
