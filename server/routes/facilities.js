import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, run, runReturning, boolParam, isActive } from '../db.js';
import { authenticateToken, buildFacilityScope, canManageFacilitiesMiddleware } from '../middleware/auth.js';

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
    const scope = buildFacilityScope(req.user);
    const scopeWhere = scope.where ? scope.where.replace(/^ WHERE/, ' AND') : '';
    const facilities = await queryAll(
      `SELECT id, name, region, zone, woreda FROM facilities WHERE ${isActive()}${scopeWhere} ORDER BY name`,
      scope.params
    );
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

router.post('/', authenticateToken, canManageFacilitiesMiddleware, async (req, res) => {
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

router.post('/with-account', authenticateToken, canManageFacilitiesMiddleware, async (req, res) => {
  try {
    const { name, region, zone, woreda, kebele, facility_type, phone, username, email, password, full_name } = req.body;

    if (!name || !region || !zone || !woreda) {
      return res.status(400).json({ error: 'Facility name, region, zone, and woreda are required' });
    }

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Username, email, password, and full name are required for the facility account' });
    }

    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-30 alphanumeric characters or underscores' });
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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

    const existingUsername = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const existingEmail = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const facilityResult = await runReturning(
      `INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, region, zone, woreda, kebele || '', facility_type || 'Health Center', phone || '']
    );

    const hash = await bcrypt.hash(password, 10);
    const userResult = await runReturning(
      `INSERT INTO users (username, email, password_hash, full_name, role, facility_id, region, zone, woreda)
       VALUES ($1, $2, $3, $4, 'facility_user', $5, $6, $7, $8) RETURNING id`,
      [username, email, hash, full_name, facilityResult.id, region, zone, woreda]
    );

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create', 'facility', $2, $3)`,
      [req.user.id, facilityResult.id, `Created facility: ${name} with user account: ${username}`]
    );

    res.status(201).json({
      message: 'Facility and user account created',
      facilityId: facilityResult.id,
      userId: userResult.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create facility with account' });
  }
});

router.put('/:id', authenticateToken, canManageFacilitiesMiddleware, async (req, res) => {
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
      [name, region, zone, woreda, kebele || '', facility_type || 'Health Center', phone || '', boolParam(is_active), req.params.id]
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

router.delete('/:id', authenticateToken, canManageFacilitiesMiddleware, async (req, res) => {
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

    await run('UPDATE facilities SET is_active = $1 WHERE id = $2', [boolParam(false), req.params.id]);

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
