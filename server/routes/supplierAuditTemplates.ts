import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../services/db'; // sinu olemasolev DB helper (LowDB/Mongo)

const router = Router();

// Kõik mallid
router.get('/', async (_req, res) => {
  const db = await getDb();
  const list = await db.supplierAuditTemplates.find({});
  res.json(list);
});

// Loo mall
router.post('/', async (req, res) => {
  const db = await getDb();
  const t = { id: nanoid(), name: 'New template', points: [], ...req.body };
  await db.supplierAuditTemplates.insert(t);
  res.status(201).json(t);
});

// Loe üks mall
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const t = await db.supplierAuditTemplates.findOne({ id: req.params.id });
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

// Uuenda malli
router.put('/:id', async (req, res) => {
  const db = await getDb();
  const { id } = req.params;
  const ok = await db.supplierAuditTemplates.update({ id }, { $set: req.body }, { upsert: false });
  if (!ok) return res.status(404).json({ error: 'Not found' });
  const fresh = await db.supplierAuditTemplates.findOne({ id });
  res.json(fresh);
});

// Kustuta mall
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  await db.supplierAuditTemplates.remove({ id: req.params.id });
  res.status(204).end();
});

export default router;
