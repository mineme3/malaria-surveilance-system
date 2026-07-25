import { Router } from 'express';
import { queryOne, queryAll, run, runReturning } from '../db.js';
import { authenticateToken, buildFacilityScope, canManageFacilities } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const scope = buildFacilityScope(req.user);
    const facilities = await queryAll(
      `SELECT f.*,
        (SELECT COUNT(*) FROM malaria_cases WHERE facility_id = f.id) as case_count,
        (SELECT MAX(date_seen) FROM malaria_cases WHERE facility_id = f.id) as last_submission
       FROM facilities f ${scope.where} ORDER BY f.name`,
      scope.params
    );
    res.json(facilities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

router.get('/all', authenticateToken, async (req, res) => {
  try {
    const facilities = await queryAll('SELECT id, name, region, zone, woreda FROM facilities WHERE is_active = 1 ORDER BY name');
    res.json(facilities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const facility = await queryOne(
      `SELECT f.*,
        (SELECT COUNT(*) FROM malaria_cases WHERE facility_id = f.id) as case_count
       FROM facilities f WHERE f.id = $1`,
      [req.params.id]
    );
    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    const scope = buildFacilityScope(req.user);
    if (scope.where) {
      const checkParams = [req.params.id, ...scope.params];
      const check = await queryOne(`SELECT 1 FROM facilities f WHERE f.id = $1 ${scope.where}`, checkParams);
      if (!check) {
        return res.status(403).json({ error: 'Access denied to this facility' });
      }
    }

    res.json(facility);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facility' });
  }
});

router.post('/', authenticateToken, canManageFacilities, async (req, res) => {
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

    const result = await runReturning(
      `INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, region, zone, woreda, kebele || '', facility_type || 'Health Center', phone || '']
    );

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create', 'facility', $2, $3)`,
      [req.user.id, result.id, `Created facility: ${name} in ${region}/${zone}/${woreda}`]
    );

    res.status(201).json({ message: 'Facility created', id: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create facility' });
  }
});

router.put('/:id', authenticateToken, canManageFacilities, async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM facilities WHERE id = $1', [req.params.id]);
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
    await run(
      'UPDATE facilities SET name=$1, region=$2, zone=$3, woreda=$4, kebele=$5, facility_type=$6, phone=$7, is_active=$8 WHERE id=$9',
      [name, region, zone, woreda, kebele || '', facility_type || 'Health Center', phone || '', is_active ? 1 : 0, req.params.id]
    );

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update', 'facility', $2, $3)`,
      [req.user.id, req.params.id, `Updated facility: ${name}`]
    );

    res.json({ message: 'Facility updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update facility' });
  }
});

router.delete('/:id', authenticateToken, canManageFacilities, async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM facilities WHERE id = $1', [req.params.id]);
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

    await run('UPDATE facilities SET is_active = 0 WHERE id = $1', [req.params.id]);

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'delete', 'facility', $2, $3)`,
      [req.user.id, req.params.id, `Deactivated facility: ${existing.name}`]
    );

    res.json({ message: 'Facility deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete facility' });
  }
});

export default router;
