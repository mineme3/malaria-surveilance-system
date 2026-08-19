import { Router } from 'express';
import { queryOne, queryAll, run } from '../db.js';
import { authenticateToken, buildDataScope, requireMinRole } from '../middleware/auth.js';

const router = Router();

function computeDateRange(type) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based

  switch (type) {
    case 'daily': {
      const dateStr = now.toISOString().split('T')[0];
      return { date_from: dateStr, date_to: dateStr };
    }
    case 'weekly': {
      // Monday of current week
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // go back to Monday
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        date_from: monday.toISOString().split('T')[0],
        date_to: sunday.toISOString().split('T')[0],
      };
    }
    case 'monthly': {
      const first = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const last = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
      return { date_from: first, date_to: last };
    }
    case 'quarterly': {
      const quarter = Math.floor(m / 3); // 0,1,2,3
      const qStart = `${y}-${String(quarter * 3 + 1).padStart(2, '0')}-01`;
      const qEndMonth = quarter * 3 + 3; // 3,6,9,12
      const qEnd = `${y}-${String(qEndMonth).padStart(2, '0')}-${new Date(y, qEndMonth, 0).getDate()}`;
      return { date_from: qStart, date_to: qEnd };
    }
    case 'annual': {
      return { date_from: `${y}-01-01`, date_to: `${y}-12-31` };
    }
    default:
      return { date_from: '', date_to: '' };
  }
}

router.get('/generate', authenticateToken, async (req, res) => {
  try {
    let { type = 'weekly', date_from, date_to, region, zone, woreda, facility_id } = req.query;
    const scope = buildDataScope(req.user);

    // Auto-compute date range from type if no explicit dates given
    if (!date_from && !date_to) {
      const range = computeDateRange(type);
      date_from = range.date_from;
      date_to = range.date_to;
    }

    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (scope.where) {
      for (const p of scope.params) {
        where = where.replace(`$${scope.params.indexOf(p) + 1}`, `$${paramIndex++}`);
      }
      where += scope.where;
      params.push(...scope.params);
      paramIndex = params.length + 1;
    }

    if (date_from) { where += ` AND c.date_seen >= $${paramIndex++}`; params.push(date_from); }
    if (date_to) { where += ` AND c.date_seen <= $${paramIndex++}`; params.push(date_to); }
    if (region) { where += ` AND c.reporting_region = $${paramIndex++}`; params.push(region); }
    if (zone) { where += ` AND c.zone = $${paramIndex++}`; params.push(zone); }
    if (woreda) { where += ` AND c.woreda = $${paramIndex++}`; params.push(woreda); }
    if (facility_id) { where += ` AND c.facility_id = $${paramIndex++}`; params.push(parseInt(facility_id)); }

    const totalCases = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${where}`, params)).count);
    const deaths = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${where} AND c.outcome = 'Death'`, params)).count);
    const byRegion = await queryAll(`SELECT c.reporting_region as region, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY c.reporting_region`, params);
    const byWoreda = await queryAll(`SELECT c.woreda, COUNT(*) as count FROM malaria_cases c ${where} AND c.woreda != '' GROUP BY c.woreda ORDER BY count DESC`, params);
    const byKebele = await queryAll(`SELECT c.kebele, COUNT(*) as count FROM malaria_cases c ${where} AND c.kebele != '' GROUP BY c.kebele ORDER BY count DESC`, params);
    const byMender = await queryAll(`SELECT c.house_no as mender, COUNT(*) as count FROM malaria_cases c ${where} AND c.house_no != '' GROUP BY c.house_no ORDER BY count DESC`, params);
    const byFacility = await queryAll(`SELECT f.name as facility_name, COUNT(*) as count FROM malaria_cases c LEFT JOIN facilities f ON c.facility_id = f.id ${where} GROUP BY c.facility_id, f.name ORDER BY count DESC`, params);
    const byWeek = await queryAll(`SELECT c.epi_week as week, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY c.epi_week ORDER BY c.epi_week`, params);
    const byAge = await queryAll(`SELECT c.age_category as category, COUNT(*) as count FROM malaria_cases c ${where} AND c.age_category != '' GROUP BY c.age_category`, params);
    const bySex = await queryAll(`SELECT c.sex, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY c.sex`, params);
    const bySpecies = await queryAll(`SELECT c.haemoparasite_spp as species, COUNT(*) as count FROM malaria_cases c ${where} AND c.haemoparasite_spp != '' GROUP BY c.haemoparasite_spp`, params);
    const byAdmission = await queryAll(`SELECT c.admission_type as type, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY c.admission_type`, params);
    const facilitiesReporting = parseInt((await queryOne(`SELECT COUNT(DISTINCT c.facility_id) as count FROM malaria_cases c ${where}`, params)).count);

    // Trend data for weekly/monthly/yearly
    let trendData = [];
    if (type === 'weekly') {
      trendData = await queryAll(`SELECT TO_CHAR(c.date_seen::date, 'YYYY-WW') as period, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY period ORDER BY period`, params);
    } else if (type === 'monthly') {
      trendData = await queryAll(`SELECT TO_CHAR(c.date_seen::date, 'YYYY-MM') as period, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY period ORDER BY period`, params);
    } else if (type === 'annual') {
      trendData = await queryAll(`SELECT EXTRACT(YEAR FROM c.date_seen::date)::text as period, COUNT(*) as count FROM malaria_cases c ${where} GROUP BY period ORDER BY period`, params);
    }

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
        cases_by_kebele: byKebele,
        cases_by_mender: byMender,
        cases_by_facility: byFacility,
        cases_by_week: byWeek,
        cases_by_age: byAge,
        cases_by_sex: bySex,
        species_distribution: bySpecies,
        cases_by_admission: byAdmission,
        trend_data: trendData,
      },
      generated_at: new Date().toISOString(),
      generated_by: req.user.full_name,
    };

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, details)
       VALUES ($1, 'report', 'report', $2)`,
      [req.user.id, `Generated ${type} report: ${totalCases} cases`]
    );

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report', details: err.message });
  }
});

router.get('/audit', authenticateToken, requireMinRole('district_admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = '';
    const params = [];
    let paramIndex = 1;

    if (req.user.role === 'region_admin') {
      where = ` WHERE a.user_id IN (SELECT id FROM users WHERE region = $${paramIndex++})`;
      params.push(req.user.region);
    } else if (req.user.role === 'zone_admin') {
      where = ` WHERE a.user_id IN (SELECT id FROM users WHERE zone = $${paramIndex++} AND region = $${paramIndex++})`;
      params.push(req.user.zone, req.user.region);
    } else if (req.user.role === 'district_admin') {
      where = ` WHERE a.user_id IN (SELECT id FROM users WHERE woreda = $${paramIndex++} AND zone = $${paramIndex++} AND region = $${paramIndex++})`;
      params.push(req.user.woreda, req.user.zone, req.user.region);
    }

    const limitParam = paramIndex++;
    const offsetParam = paramIndex++;
    const logs = await queryAll(
      `SELECT a.*, u.username, u.full_name, u.role as user_role
       FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
       ${where} ORDER BY a.created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, parseInt(limit), offset]
    );

    const total = parseInt((await queryOne(`SELECT COUNT(*) as count FROM audit_logs a ${where}`, params)).count);
    res.json({ logs, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
