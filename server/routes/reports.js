import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, buildDataScope, requireMinRole } from '../middleware/auth.js';

const router = Router();

router.get('/generate', authenticateToken, (req, res) => {
  try {
    const { type = 'weekly', date_from, date_to, region, zone, woreda, facility_id } = req.query;
    const scope = buildDataScope(req.user);

    let where = 'WHERE 1=1';
    const params = [];

    if (scope.where) {
      where += scope.where;
      params.push(...scope.params);
    }

    if (date_from) { where += ' AND c.date_seen >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND c.date_seen <= ?'; params.push(date_to); }
    if (region) { where += ' AND c.reporting_region = ?'; params.push(region); }
    if (zone) { where += ' AND c.zone = ?'; params.push(zone); }
    if (woreda) { where += ' AND c.woreda = ?'; params.push(woreda); }
    if (facility_id) { where += ' AND c.facility_id = ?'; params.push(parseInt(facility_id)); }

    const totalCases = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases c ${where}`).get(...params).count;
    const deaths = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases c ${where} AND c.outcome = 'Death'`).get(...params).count;
    const byRegion = db.prepare(`SELECT c.reporting_region as region, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY c.reporting_region`).all(...params);
    const byWoreda = db.prepare(`SELECT c.woreda, COUNT(*) as count FROM malaria_cases c ${where} AND c.woreda != '' GROUP BY c.woreda ORDER BY count DESC`).all(...params);
    const byFacility = db.prepare(`SELECT f.name as facility_name, COUNT(*) as count FROM malaria_cases c LEFT JOIN facilities f ON c.facility_id = f.id ${where} GROUP BY c.facility_id ORDER BY count DESC`).all(...params);
    const byWeek = db.prepare(`SELECT c.epi_week as week, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY c.epi_week ORDER BY c.epi_week`).all(...params);
    const byAge = db.prepare(`SELECT c.age_category as category, COUNT(*) as count FROM malaria_cases c ${where} AND c.age_category != '' GROUP BY c.age_category`).all(...params);
    const bySex = db.prepare(`SELECT c.sex, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY c.sex`).all(...params);
    const bySpecies = db.prepare(`SELECT c.haemoparasite_spp as species, COUNT(*) as count FROM malaria_cases c ${where} AND c.haemoparasite_spp != '' GROUP BY c.haemoparasite_spp`).all(...params);
    const byAdmission = db.prepare(`SELECT c.admission_type as type, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY c.admission_type`).all(...params);
    const facilitiesReporting = db.prepare(`SELECT COUNT(DISTINCT c.facility_id) as count FROM malaria_cases c ${where}`).get(...params).count;

    const report = {
      type,
      period_start: date_from || '',
      period_end: date_to || '',
      scope: {
        region: req.user.role === 'system_admin' ? 'All Regions' : req.user.region,
        zone: ['system_admin', 'region_admin'].includes(req.user.role) ? 'All Zones' : req.user.zone,
        woreda: ['system_admin', 'region_admin', 'zone_admin'].includes(req.user.role) ? 'All Woredas' : req.user.woreda,
      },
      data: {
        total_cases: totalCases,
        deaths,
        facilities_reporting: facilitiesReporting,
        cases_by_region: byRegion,
        cases_by_woreda: byWoreda,
        cases_by_facility: byFacility,
        cases_by_week: byWeek,
        cases_by_age: byAge,
        cases_by_sex: bySex,
        species_distribution: bySpecies,
        cases_by_admission: byAdmission,
      },
      generated_at: new Date().toISOString(),
      generated_by: req.user.full_name,
    };

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, details)
      VALUES (?, 'report', 'report', ?)`).run(req.user.id,
      `Generated ${type} report: ${totalCases} cases`);

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report', details: err.message });
  }
});

router.get('/audit', authenticateToken, requireMinRole('district_admin'), (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = '';
    const params = [];

    if (req.user.role === 'region_admin') {
      where = ' WHERE a.user_id IN (SELECT id FROM users WHERE region = ?)';
      params.push(req.user.region);
    } else if (req.user.role === 'zone_admin') {
      where = ' WHERE a.user_id IN (SELECT id FROM users WHERE zone = ? AND region = ?)';
      params.push(req.user.zone, req.user.region);
    } else if (req.user.role === 'district_admin') {
      where = ' WHERE a.user_id IN (SELECT id FROM users WHERE woreda = ? AND zone = ? AND region = ?)';
      params.push(req.user.woreda, req.user.zone, req.user.region);
    }

    const logs = db.prepare(`SELECT a.*, u.username, u.full_name, u.role as user_role
      FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
      ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, parseInt(limit), offset);
    const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs a ${where}`).get(...params).count;
    res.json({ logs, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
