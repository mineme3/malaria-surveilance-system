import { Router } from 'express';
import { queryOne, queryAll, run, isActive } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, unread_only } = req.query;
    let where = 'WHERE user_id = $1';
    const params = [req.user.id];
    let paramIndex = 2;

    if (type) { where += ` AND type = $${paramIndex++}`; params.push(type); }
    if (unread_only === 'true') { where += ' AND is_read = 0'; }

    const notifications = await queryAll(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`,
      params
    );
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await queryOne('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = 0', [req.user.id]);
    res.json({ count: parseInt(result.count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

router.post('/send', authenticateToken, async (req, res) => {
  try {
    if (!['system_admin', 'region_admin', 'zone_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to send notifications' });
    }

    const { title, message, type, target_role, target_region, target_zone } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    let where = `WHERE ${isActive()}`;
    const params = [];
    let paramIndex = 1;

    if (target_role) { where += ` AND role = $${paramIndex++}`; params.push(target_role); }
    if (target_region) { where += ` AND region = $${paramIndex++}`; params.push(target_region); }
    if (target_zone) { where += ` AND zone = $${paramIndex++}`; params.push(target_zone); }

    if (req.user.role === 'region_admin') {
      where += ` AND region = $${paramIndex++}`;
      params.push(req.user.region);
    } else if (req.user.role === 'zone_admin') {
      where += ` AND zone = $${paramIndex++} AND region = $${paramIndex++}`;
      params.push(req.user.zone, req.user.region);
    }

    const users = await queryAll(`SELECT id FROM users ${where}`, params);

    let sent = 0;
    for (const user of users) {
      try {
        await run('INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
          [user.id, title, message, type || 'info']);
        sent++;
      } catch (e) { /* skip */ }
    }

    res.json({ message: `Notification sent to ${sent} users`, sent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;
