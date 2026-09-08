import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, queryAll, run, runReturning, boolParam, BOOL_TRUE, BOOL_FALSE } from '../db.js';
import { JWT_SECRET, authenticateToken, canManageUsers, canManageUsersMiddleware, ROLE_HIERARCHY } from '../middleware/auth.js';

const router = Router();

router.post('/register', authenticateToken, async (req, res) => {
  try {
    if (!canManageUsers(req.user)) {
      return res.status(403).json({ error: 'Only administrators can create user accounts' });
    }

    const { username, email, password, full_name, role, facility_id, region, zone, woreda } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Username, email, password, and full name are required' });
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

    if (typeof full_name !== 'string' || full_name.length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const allowedRoles = {
      system_admin: ['system_admin', 'region_admin', 'zone_admin', 'district_admin', 'facility_admin', 'facility_user'],
      region_admin: ['zone_admin', 'district_admin', 'facility_admin', 'facility_user'],
      zone_admin: ['district_admin', 'facility_admin', 'facility_user'],
      district_admin: ['facility_admin', 'facility_user'],
    };

    const userAllowedRoles = allowedRoles[req.user.role] || [];
    const targetRole = role || 'facility_user';
    if (!userAllowedRoles.includes(targetRole)) {
      return res.status(403).json({ error: 'Insufficient permissions for this role' });
    }

    let userRegion = region || req.user.region;
    let userZone = zone || req.user.zone;
    let userWoreda = woreda || req.user.woreda;

    if (req.user.role === 'district_admin') {
      userRegion = req.user.region;
      userZone = req.user.zone;
      userWoreda = req.user.woreda;
    } else if (req.user.role === 'zone_admin') {
      userRegion = req.user.region;
      userZone = req.user.zone;
    } else if (req.user.role === 'region_admin') {
      userRegion = req.user.region;
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await runReturning(
      `INSERT INTO users (username, email, password_hash, full_name, role, facility_id, region, zone, woreda)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [username, email, hash, full_name, targetRole, facility_id || null, userRegion, userZone, userWoreda]
    );

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create', 'user', $2, $3)`,
      [req.user.id, result.id, `Created user: ${username} with role: ${targetRole}`]
    );

    res.status(201).json({ message: 'User registered successfully', userId: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await queryOne('SELECT * FROM users WHERE username = $1 AND is_active = TRUE', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, facility_id: user.facility_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, details)
       VALUES ($1, 'login', 'user', $2)`,
      [user.id, `User ${user.username} logged in from ${req.ip || 'unknown'}`]
    );

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { password_hash, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/users', authenticateToken, canManageUsersMiddleware, async (req, res) => {
  try {
    const myLevel = ROLE_HIERARCHY[req.user.role] || 0;
    let where = ` WHERE role IN (${Object.entries(ROLE_HIERARCHY).filter(([_, level]) => level < myLevel).map(([role]) => `'${role}'`).join(',')})`;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === 'region_admin') {
      where += ` AND region = $${paramIndex++}`;
      params.push(req.user.region);
    } else if (req.user.role === 'zone_admin') {
      where += ` AND zone = $${paramIndex++} AND region = $${paramIndex++}`;
      params.push(req.user.zone, req.user.region);
    } else if (req.user.role === 'district_admin') {
      where += ` AND woreda = $${paramIndex++} AND zone = $${paramIndex++} AND region = $${paramIndex++}`;
      params.push(req.user.woreda, req.user.zone, req.user.region);
    }

    const users = await queryAll(
      `SELECT id, username, email, full_name, role, facility_id, region, zone, woreda, is_active, created_at
       FROM users ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:id', authenticateToken, canManageUsersMiddleware, async (req, res) => {
  try {
    const targetUser = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role !== 'system_admin') {
      const myLevel = ROLE_HIERARCHY[req.user.role] || 0;
      const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
      if (targetLevel >= myLevel) {
        return res.status(403).json({ error: 'Cannot edit users at or above your role level' });
      }

      if (req.user.role === 'region_admin' && targetUser.region !== req.user.region) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'zone_admin' && targetUser.zone !== req.user.zone) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'district_admin' && targetUser.woreda !== req.user.woreda) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const { username, full_name, role, is_active, facility_id } = req.body;

    if (username !== undefined) {
      if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        return res.status(400).json({ error: 'Username must be 3-30 alphanumeric characters or underscores' });
      }
      if (username !== targetUser.username) {
        const existingUsername = await queryOne('SELECT id FROM users WHERE username = $1 AND id != $2', [username, req.params.id]);
        if (existingUsername) {
          return res.status(409).json({ error: 'Username already exists' });
        }
      }
    }

    const allowedRoles = {
      system_admin: ['system_admin', 'region_admin', 'zone_admin', 'district_admin', 'facility_admin', 'facility_user'],
      region_admin: ['zone_admin', 'district_admin', 'facility_admin', 'facility_user'],
      zone_admin: ['district_admin', 'facility_admin', 'facility_user'],
      district_admin: ['facility_admin', 'facility_user'],
    };

    if (role && !allowedRoles[req.user.role]?.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this role' });
    }

    await run(
      'UPDATE users SET username = $1, full_name = $2, role = $3, is_active = $4, facility_id = $5 WHERE id = $6',
      [username || targetUser.username, full_name || targetUser.full_name, role || targetUser.role, is_active !== undefined ? boolParam(is_active) : targetUser.is_active, facility_id || targetUser.facility_id, req.params.id]
    );

    const details = username && username !== targetUser.username
      ? `Updated user: ${targetUser.username} -> ${username}`
      : `Updated user: ${targetUser.username}`;

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update', 'user', $2, $3)`,
      [req.user.id, req.params.id, details]
    );

    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.put('/users/:id/toggle-active', authenticateToken, canManageUsersMiddleware, async (req, res) => {
  try {
    const targetUser = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role !== 'system_admin') {
      const myLevel = ROLE_HIERARCHY[req.user.role] || 0;
      const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
      if (targetLevel >= myLevel) {
        return res.status(403).json({ error: 'Cannot modify users at or above your role level' });
      }
      if (req.user.role === 'region_admin' && targetUser.region !== req.user.region) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'zone_admin' && targetUser.zone !== req.user.zone) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'district_admin' && targetUser.woreda !== req.user.woreda) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const isActive = targetUser.is_active;
    const activated = isActive ? false : true;
    const newStatus = activated ? BOOL_TRUE : BOOL_FALSE;
    await run('UPDATE users SET is_active = $1 WHERE id = $2', [newStatus, req.params.id]);

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update', 'user', $2, $3)`,
      [req.user.id, req.params.id, `${activated ? 'Activated' : 'Deactivated'} user: ${targetUser.username}`]
    );

    res.json({ message: `User ${activated ? 'activated' : 'deactivated'}`, is_active: activated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

router.delete('/users/:id', authenticateToken, canManageUsersMiddleware, async (req, res) => {
  try {
    const targetUser = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role !== 'system_admin') {
      const myLevel = ROLE_HIERARCHY[req.user.role] || 0;
      const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
      if (targetLevel >= myLevel) {
        return res.status(403).json({ error: 'Cannot delete users at or above your role level' });
      }
      if (req.user.role === 'region_admin' && targetUser.region !== req.user.region) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'zone_admin' && targetUser.zone !== req.user.zone) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'district_admin' && targetUser.woreda !== req.user.woreda) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await run(`UPDATE users SET is_active = ${BOOL_FALSE} WHERE id = $1`, [req.params.id]);

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'delete', 'user', $2, $3)`,
      [req.user.id, req.params.id, `Deactivated user: ${targetUser.username} (${targetUser.role})`]
    );

    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

router.put('/users/:id/reset-password', authenticateToken, canManageUsersMiddleware, async (req, res) => {
  try {
    const targetUser = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role !== 'system_admin') {
      const myLevel = ROLE_HIERARCHY[req.user.role] || 0;
      const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
      if (targetLevel >= myLevel) {
        return res.status(403).json({ error: 'Cannot reset password for users at or above your role level' });
      }

      if (req.user.role === 'region_admin' && targetUser.region !== req.user.region) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'zone_admin' && targetUser.zone !== req.user.zone) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role === 'district_admin' && targetUser.woreda !== req.user.woreda) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hash = await bcrypt.hash(password, 10);
    await run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update', 'user', $2, $3)`,
      [req.user.id, req.params.id, `Reset password for user: ${targetUser.username}`]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
