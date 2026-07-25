import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const { type, unread_only } = req.query;
    let where = 'WHERE user_id = ?';
    const params = [req.user.id];

    if (type) { where += ' AND type = ?'; params.push(type); }
    if (unread_only === 'true') { where += ' AND is_read = 0'; }

    const notifications = db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`).all(...params);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', authenticateToken, (req, res) => {
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
    res.json({ count: result.count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.put('/read-all', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

router.post('/send', authenticateToken, (req, res) => {
  try {
    if (!['system_admin', 'region_admin', 'zone_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to send notifications' });
    }

    const { title, message, type, target_role, target_region, target_zone } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    let where = 'WHERE is_active = 1';
    const params = [];

    if (target_role) { where += ' AND role = ?'; params.push(target_role); }
    if (target_region) { where += ' AND region = ?'; params.push(target_region); }
    if (target_zone) { where += ' AND zone = ?'; params.push(target_zone); }

    if (req.user.role === 'region_admin') {
      where += ' AND region = ?';
      params.push(req.user.region);
    } else if (req.user.role === 'zone_admin') {
      where += ' AND zone = ? AND region = ?';
      params.push(req.user.zone, req.user.region);
    }

    const users = db.prepare(`SELECT id FROM users ${where}`).all(...params);
    const insert = db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)');

    let sent = 0;
    for (const user of users) {
      try {
        insert.run(user.id, title, message, type || 'info');
        sent++;
      } catch (e) { /* skip */ }
    }

    res.json({ message: `Notification sent to ${sent} users`, sent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;
