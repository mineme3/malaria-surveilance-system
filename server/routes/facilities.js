import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, buildFacilityScope, canManageFacilities } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const scope = buildFacilityScope(req.user);
    const facilities = db.prepare(`SELECT f.*, 
      (SELECT COUNT(*) FROM malaria_cases WHERE facility_id = f.id) as case_count,
      (SELECT MAX(date_seen) FROM malaria_cases WHERE facility_id = f.id) as last_submission
      FROM facilities f ${scope.where} ORDER BY f.name`).all(...scope.params);
    res.json(facilities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

router.get('/all', authenticateToken, (req, res) => {
  try {
    const facilities = db.prepare('SELECT id, name, region, zone, woreda FROM facilities WHERE is_active = 1 ORDER BY name').all();
    res.json(facilities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const facility = db.prepare(`SELECT f.*,
      (SELECT COUNT(*) FROM malaria_cases WHERE facility_id = f.id) as case_count
      FROM facilities f WHERE f.id = ?`).get(req.params.id);
    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    const scope = buildFacilityScope(req.user);
    if (scope.where) {
      const check = db.prepare(`SELECT 1 FROM facilities f WHERE f.id = ? ${scope.where}`);
      if (!check.get(req.params.id, ...scope.params)) {
        return res.status(403).json({ error: 'Access denied to this facility' });
      }
    }

    res.json(facility);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facility' });
  }
});

router.post('/', authenticateToken, canManageFacilities, (req, res) => {
  try {
    const { name, region, zone, woreda, kebele, facility_type, phone } = req.body;
    if (!name || !region || !zone || !woreda) {
      return res.status(400).json({ error: 'Name, region, zone, and woreda are required' });
    }

    if (req.user.role === 'district_admin') {
      if (woreda !== req.user.woreda || zone !== req.user.zone || region !== req.user.region) {
        return res.status(403).json({ error: 'Can only create facilities in your district' });
      }
    }
    if (req.user.role === 'zone_admin') {
      if (zone !== req.user.zone || region !== req.user.region) {
        return res.status(403).json({ error: 'Can only create facilities in your zone' });
      }
    }
    if (req.user.role === 'region_admin') {
      if (region !== req.user.region) {
        return res.status(403).json({ error: 'Can only create facilities in your region' });
      }
    }

    const result = db.prepare(`INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      name, region, zone, woreda, kebele || '', facility_type || 'Health Center', phone || ''
    );

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'create', 'facility', ?, ?)`).run(req.user.id, result.lastInsertRowid,
      `Created facility: ${name} in ${region}/${zone}/${woreda}`);

    res.status(201).json({ message: 'Facility created', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create facility' });
  }
});

router.put('/:id', authenticateToken, canManageFacilities, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Facility not found' });

    if (req.user.role === 'district_admin') {
      if (existing.woreda !== req.user.woreda || existing.zone !== req.user.zone) {
        return res.status(403).json({ error: 'Can only edit facilities in your district' });
      }
    }
    if (req.user.role === 'zone_admin') {
      if (existing.zone !== req.user.zone || existing.region !== req.user.region) {
        return res.status(403).json({ error: 'Can only edit facilities in your zone' });
      }
    }
    if (req.user.role === 'region_admin') {
      if (existing.region !== req.user.region) {
        return res.status(403).json({ error: 'Can only edit facilities in your region' });
      }
    }

    const { name, region, zone, woreda, kebele, facility_type, phone, is_active } = req.body;
    db.prepare(`UPDATE facilities SET name=?, region=?, zone=?, woreda=?, kebele=?, facility_type=?, phone=?, is_active=? WHERE id=?`)
      .run(name, region, zone, woreda, kebele || '', facility_type || 'Health Center', phone || '', is_active ? 1 : 0, req.params.id);

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'update', 'facility', ?, ?)`).run(req.user.id, req.params.id, `Updated facility: ${name}`);

    res.json({ message: 'Facility updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update facility' });
  }
});

router.delete('/:id', authenticateToken, canManageFacilities, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Facility not found' });

    if (req.user.role !== 'system_admin') {
      if (req.user.role === 'region_admin' && existing.region !== req.user.region) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'zone_admin' && existing.zone !== req.user.zone) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'district_admin' && existing.woreda !== req.user.woreda) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    db.prepare('UPDATE facilities SET is_active = 0 WHERE id = ?').run(req.params.id);

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'delete', 'facility', ?, ?)`).run(req.user.id, req.params.id,
      `Deactivated facility: ${existing.name}`);

    res.json({ message: 'Facility deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete facility' });
  }
});

export default router;
