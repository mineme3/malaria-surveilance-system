import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  try {
    const { username, email, password, full_name, role, facility_id, region, zone, woreda } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`INSERT INTO users (username, email, password_hash, full_name, role, facility_id, region, zone, woreda)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      username, email, hash, full_name, role || 'facility_user', facility_id || null, region || '', zone || '', woreda || ''
    );

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
      VALUES (?, 'login', 'user', ?)`).run(user.id, `User ${user.username} logged in`);

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/users', authenticateToken, (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, email, full_name, role, facility_id, region, zone, woreda, is_active, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:id', authenticateToken, (req, res) => {
  try {
    const { full_name, role, is_active, facility_id } = req.body;
    db.prepare('UPDATE users SET full_name = ?, role = ?, is_active = ?, facility_id = ? WHERE id = ?')
      .run(full_name, role, is_active ? 1 : 0, facility_id || null, req.params.id);
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
