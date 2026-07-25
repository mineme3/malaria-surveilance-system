import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET, authenticateToken, canManageUsers, buildFacilityScope } from '../middleware/auth.js';

const router = Router();

router.post('/register', authenticateToken, (req, res) => {
  try {
    if (!canManageUsers(req.user)) {
      return res.status(403).json({ error: 'Only administrators can create user accounts' });
    }

    const { username, email, password, full_name, role, facility_id, region, zone, woreda } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Username, email, password, and full name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
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
      return res.status(403).json({ error: `You cannot create users with role: ${targetRole}` });
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

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`INSERT INTO users (username, email, password_hash, full_name, role, facility_id, region, zone, woreda)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      username, email, hash, full_name, targetRole, facility_id || null, userRegion, userZone, userWoreda
    );

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'create', 'user', ?, ?)`).run(req.user.id, result.lastInsertRowid,
      `Created user: ${username} with role: ${targetRole}`);

    res.status(201).json({ message: 'User registered successfully', userId: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, facility_id: user.facility_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, details)
      VALUES (?, 'login', 'user', ?)`).run(user.id, `User ${user.username} logged in from ${req.ip || 'unknown'}`);

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  try {
    const { password_hash, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/users', authenticateToken, canManageUsers, (req, res) => {
  try {
    let where = '';
    const params = [];

    if (req.user.role === 'region_admin') {
      where = ' WHERE region = ?';
      params.push(req.user.region);
    } else if (req.user.role === 'zone_admin') {
      where = ' WHERE zone = ? AND region = ?';
      params.push(req.user.zone, req.user.region);
    } else if (req.user.role === 'district_admin') {
      where = ' WHERE woreda = ? AND zone = ? AND region = ?';
      params.push(req.user.woreda, req.user.zone, req.user.region);
    }

    const users = db.prepare(`SELECT id, username, email, full_name, role, facility_id, region, zone, woreda, is_active, created_at
      FROM users ${where} ORDER BY created_at DESC`).all(...params);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:id', authenticateToken, canManageUsers, (req, res) => {
  try {
    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role !== 'system_admin') {
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

    const { full_name, role, is_active, facility_id } = req.body;

    const allowedRoles = {
      system_admin: ['system_admin', 'region_admin', 'zone_admin', 'district_admin', 'facility_admin', 'facility_user'],
      region_admin: ['zone_admin', 'district_admin', 'facility_admin', 'facility_user'],
      zone_admin: ['district_admin', 'facility_admin', 'facility_user'],
      district_admin: ['facility_admin', 'facility_user'],
    };

    if (role && !allowedRoles[req.user.role]?.includes(role)) {
      return res.status(403).json({ error: `Cannot assign role: ${role}` });
    }

    db.prepare('UPDATE users SET full_name = ?, role = ?, is_active = ?, facility_id = ? WHERE id = ?')
      .run(full_name || targetUser.full_name, role || targetUser.role, is_active !== undefined ? (is_active ? 1 : 0) : targetUser.is_active, facility_id || targetUser.facility_id, req.params.id);

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'update', 'user', ?, ?)`).run(req.user.id, req.params.id,
      `Updated user: ${targetUser.username}`);

    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.put('/users/:id/reset-password', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'system_admin') {
      return res.status(403).json({ error: 'Only system administrators can reset passwords' });
    }

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'update', 'user', ?, ?)`).run(req.user.id, req.params.id,
      `Reset password for user: ${targetUser.username}`);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
