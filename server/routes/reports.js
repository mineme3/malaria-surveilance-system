import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/generate', authenticateToken, (req, res) => {
  try {
    const { type = 'weekly', date_from, date_to } = req.query;
    
    let where = 'WHERE 1=1';
    const params = [];
    
    if (date_from) { where += ' AND date_seen >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND date_seen <= ?'; params.push(date_to); }

    const totalCases = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases ${where}`).get(...params).count;
    const deaths = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases ${where} AND outcome = 'Death'`).get(...params).count;
    const byRegion = db.prepare(`SELECT reporting_region as region, COUNT(*) as count FROM malaria_cases ${where} GROUP BY reporting_region`).all(...params);
    const byWeek = db.prepare(`SELECT epi_week as week, COUNT(*) as count FROM malaria_cases ${where} GROUP BY epi_week ORDER BY epi_week`).all(...params);
    const byAge = db.prepare(`SELECT age_category as category, COUNT(*) as count FROM malaria_cases ${where} GROUP BY age_category`).all(...params);
    const bySex = db.prepare(`SELECT sex, COUNT(*) as count FROM malaria_cases ${where} GROUP BY sex`).all(...params);
    const bySpecies = db.prepare(`SELECT haemoparasite_spp as species, COUNT(*) as count FROM malaria_cases ${where} AND haemoparasite_spp != '' GROUP BY haemoparasite_spp`).all(...params);
    const facilitiesReporting = db.prepare(`SELECT COUNT(DISTINCT facility_id) as count FROM malaria_cases ${where}`).get(...params).count;

    const report = {
      type,
      period_start: date_from || '',
      period_end: date_to || '',
      data: {
        total_cases: totalCases,
        deaths,
        facilities_reporting: facilitiesReporting,
        cases_by_region: byRegion,
        cases_by_week: byWeek,
        cases_by_age: byAge,
        cases_by_sex: bySex,
        species_distribution: bySpecies,
      },
      generated_at: new Date().toISOString(),
    };

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report', details: err.message });
  }
});

router.get('/audit', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const logs = db.prepare(`SELECT a.*, u.username, u.full_name FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT ? OFFSET ?`)
      .all(parseInt(limit), offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;
    res.json({ logs, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
