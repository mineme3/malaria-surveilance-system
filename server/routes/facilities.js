import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    let facilities;
    if (req.user.role === 'facility_user' || req.user.role === 'facility_admin') {
      facilities = db.prepare('SELECT * FROM facilities WHERE id = ?').all(req.user.facility_id);
    } else {
      facilities = db.prepare('SELECT * FROM facilities ORDER BY name').all();
    }
    res.json(facilities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, region, zone, woreda, kebele, facility_type, phone } = req.body;
    if (!name || !region || !zone || !woreda) {
      return res.status(400).json({ error: 'Name, region, zone, and woreda are required' });
    }
    const result = db.prepare(`INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      name, region, zone, woreda, kebele || '', facility_type || 'Health Center', phone || ''
    );
    res.status(201).json({ message: 'Facility created', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create facility' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, region, zone, woreda, kebele, facility_type, phone, is_active } = req.body;
    db.prepare(`UPDATE facilities SET name=?, region=?, zone=?, woreda=?, kebele=?, facility_type=?, phone=?, is_active=? WHERE id=?`)
      .run(name, region, zone, woreda, kebele || '', facility_type || 'Health Center', phone || '', is_active ? 1 : 0, req.params.id);
    res.json({ message: 'Facility updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update facility' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE facilities SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Facility deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete facility' });
  }
});

export default router;
