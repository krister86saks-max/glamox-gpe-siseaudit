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
      guidance:
