import { Router } from 'express';
import { queryOne, queryAll, run, runReturning } from '../db.js';
import { authenticateToken, buildDataScope, canModifyCase } from '../middleware/auth.js';

const router = Router();

function getCurrentEpiWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil(diff / 604800000);
}

async function createAlert(user, type, title, message) {
  try {
    const admins = await queryAll(
      `SELECT id FROM users WHERE role IN ('system_admin','region_admin','zone_admin','district_admin') AND is_active = 1`
    );
    for (const admin of admins) {
      await run('INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [admin.id, title, message, type]);
    }
  } catch (e) { /* non-critical */ }
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, region, zone, woreda, date_from, date_to, sex, age_category, outcome, facility_id, epi_week } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const scope = buildDataScope(req.user);

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

    if (search) { where += ` AND c.patient_name ILIKE $${paramIndex++}`; params.push(`%${search}%`); }
    if (region) { where += ` AND c.reporting_region = $${paramIndex++}`; params.push(region); }
    if (zone) { where += ` AND c.zone = $${paramIndex++}`; params.push(zone); }
    if (woreda) { where += ` AND c.woreda = $${paramIndex++}`; params.push(woreda); }
    if (date_from) { where += ` AND c.date_seen >= $${paramIndex++}`; params.push(date_from); }
    if (date_to) { where += ` AND c.date_seen <= $${paramIndex++}`; params.push(date_to); }
    if (sex) { where += ` AND c.sex = $${paramIndex++}`; params.push(sex); }
    if (age_category) { where += ` AND c.age_category = $${paramIndex++}`; params.push(age_category); }
    if (outcome) { where += ` AND c.outcome = $${paramIndex++}`; params.push(outcome); }
    if (facility_id) { where += ` AND c.facility_id = $${paramIndex++}`; params.push(parseInt(facility_id)); }
    if (epi_week) { where += ` AND c.epi_week = $${paramIndex++}`; params.push(parseInt(epi_week)); }

    const totalResult = await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${where}`, params);
    const total = parseInt(totalResult.count);

    const limitParam = paramIndex++;
    const offsetParam = paramIndex++;
    const cases = await queryAll(
      `SELECT c.*, f.name as facility_name, u.full_name as entered_by_name
       FROM malaria_cases c
       LEFT JOIN facilities f ON c.facility_id = f.id
       LEFT JOIN users u ON c.created_by = u.id
       ${where} ORDER BY c.created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ cases, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases', details: err.message });
  }
});

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const scope = buildDataScope(req.user);
    let baseWhere = 'WHERE 1=1';
    const baseParams = [];
    let paramIndex = 1;

    if (scope.where) {
      for (const p of scope.params) {
        baseWhere = baseWhere.replace(`$${scope.params.indexOf(p) + 1}`, `$${paramIndex++}`);
      }
      baseWhere += scope.where;
      baseParams.push(...scope.params);
      paramIndex = baseParams.length + 1;
    }

    const totalCases = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere}`, baseParams)).count);

    const thisWeekNum = getCurrentEpiWeek();
    const weekParam = paramIndex++;
    const thisWeek = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.epi_week = $${weekParam}`, [...baseParams, thisWeekNum])).count);

    const thisMonth = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND TO_CHAR(c.date_seen::date, 'YYYY-MM') = TO_CHAR(NOW()::date, 'YYYY-MM')`, baseParams)).count);

    const thisYear = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND EXTRACT(YEAR FROM c.date_seen::date) = EXTRACT(YEAR FROM NOW()::date)`, baseParams)).count);

    const deaths = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.outcome = 'Death'`, baseParams)).count);

    const facilitiesReporting = parseInt((await queryOne(`SELECT COUNT(DISTINCT c.facility_id) as count FROM malaria_cases c ${baseWhere} AND TO_CHAR(c.date_seen::date, 'YYYY-MM') = TO_CHAR(NOW()::date, 'YYYY-MM')`, baseParams)).count);

    const casesByWeek = await queryAll(`SELECT c.epi_week as week, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND EXTRACT(YEAR FROM c.date_seen::date) = EXTRACT(YEAR FROM NOW()::date) GROUP BY c.epi_week ORDER BY c.epi_week`, baseParams);

    const casesByRegion = await queryAll(`SELECT c.reporting_region as region, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.reporting_region != '' GROUP BY c.reporting_region ORDER BY count DESC`, baseParams);

    const casesByWoreda = await queryAll(`SELECT c.woreda, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.woreda != '' GROUP BY c.woreda ORDER BY count DESC LIMIT 10`, baseParams);

    const casesByFacility = await queryAll(`SELECT f.name as facility_name, COUNT(*) as count FROM malaria_cases c LEFT JOIN facilities f ON c.facility_id = f.id ${baseWhere} GROUP BY c.facility_id, f.name ORDER BY count DESC LIMIT 10`, baseParams);

    const casesByAge = await queryAll(`SELECT c.age_category as category, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.age_category != '' GROUP BY c.age_category ORDER BY count DESC`, baseParams);

    const casesBySex = await queryAll(`SELECT c.sex, COUNT(*) as count FROM malaria_cases c ${baseWhere} GROUP BY c.sex`, baseParams);

    const speciesDistribution = await queryAll(`SELECT c.haemoparasite_spp as species, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.haemoparasite_spp != '' GROUP BY c.haemoparasite_spp`, baseParams);

    const casesByAdmission = await queryAll(`SELECT c.admission_type as type, COUNT(*) as count FROM malaria_cases c ${baseWhere} GROUP BY c.admission_type`, baseParams);

    const recentTrend = await queryAll(`SELECT c.date_seen as date, COUNT(*) as count FROM malaria_cases c ${baseWhere} GROUP BY c.date_seen ORDER BY c.date_seen DESC LIMIT 30`, baseParams);

    res.json({
      total_cases: totalCases,
      cases_this_week: thisWeek,
      cases_this_month: thisMonth,
      cases_this_year: thisYear,
      deaths,
      facilities_reporting: facilitiesReporting,
      positive_rate: totalCases > 0 ? ((totalCases / Math.max(totalCases, 1)) * 100).toFixed(1) : 0,
      cases_by_week: casesByWeek,
      cases_by_region: casesByRegion,
      cases_by_woreda: casesByWoreda,
      cases_by_facility: casesByFacility,
      cases_by_age: casesByAge,
      cases_by_sex: casesBySex,
      species_distribution: speciesDistribution,
      cases_by_admission: casesByAdmission,
      recent_trend: recentTrend,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

router.get('/export', authenticateToken, async (req, res) => {
  try {
    const scope = buildDataScope(req.user);
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

    const { date_from, date_to, region, zone, woreda, facility_id } = req.query;
    if (date_from) { where += ` AND c.date_seen >= $${paramIndex++}`; params.push(date_from); }
    if (date_to) { where += ` AND c.date_seen <= $${paramIndex++}`; params.push(date_to); }
    if (region) { where += ` AND c.reporting_region = $${paramIndex++}`; params.push(region); }
    if (zone) { where += ` AND c.zone = $${paramIndex++}`; params.push(zone); }
    if (woreda) { where += ` AND c.woreda = $${paramIndex++}`; params.push(woreda); }
    if (facility_id) { where += ` AND c.facility_id = $${paramIndex++}`; params.push(parseInt(facility_id)); }

    const cases = await queryAll(`SELECT c.* FROM malaria_cases c ${where} ORDER BY c.date_seen DESC`, params);
    res.json({ cases, total: cases.length });
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const malariaCase = await queryOne(
      `SELECT c.*, f.name as facility_name, u.full_name as entered_by_name
       FROM malaria_cases c
       LEFT JOIN facilities f ON c.facility_id = f.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!malariaCase) return res.status(404).json({ error: 'Case not found' });

    const scope = buildDataScope(req.user);
    if (scope.where) {
      const checkParams = [req.params.id, ...scope.params];
      const check = await queryOne(`SELECT 1 FROM malaria_cases c WHERE c.id = $1 ${scope.where}`, checkParams);
      if (!check) {
        return res.status(403).json({ error: 'Access denied to this case' });
      }
    }

    res.json(malariaCase);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    if (!data.patient_name || !data.sex || data.age === undefined) {
      return res.status(400).json({ error: 'Patient name, sex, and age are required' });
    }

    const facilityId = data.facility_id || req.user.facility_id;
    if (!facilityId) {
      return res.status(400).json({ error: 'Facility assignment is required' });
    }

    const facility = await queryOne('SELECT * FROM facilities WHERE id = $1', [facilityId]);
    if (!facility) {
      return res.status(400).json({ error: 'Invalid facility' });
    }

    if (req.user.role === 'facility_user' || req.user.role === 'facility_admin') {
      if (facilityId !== req.user.facility_id) {
        return res.status(403).json({ error: 'You can only create cases for your assigned facility' });
      }
    }

    const result = await runReturning(
      `INSERT INTO malaria_cases (
        facility_id, reporting_region, zone, woreda, reporting_hf, kebele, house_no, mobile_phone,
        admission_type, patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
        fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
        specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
        outcome, ftat_done, referred_facility, source_of_infection, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32) RETURNING id`,
      [
        facilityId,
        data.reporting_region || facility.region || '',
        data.zone || facility.zone || '',
        data.woreda || facility.woreda || '',
        data.reporting_hf || facility.name || '',
        data.kebele || facility.kebele || '',
        data.house_no || '',
        data.mobile_phone || '',
        data.admission_type || 'Out-Patient',
        data.patient_name,
        data.sex,
        data.age,
        data.epi_week || getCurrentEpiWeek(),
        data.age_category || '',
        data.date_of_onset || '',
        data.date_seen || new Date().toISOString().split('T')[0],
        data.fever || 'No',
        data.headache || 'No',
        data.joint_pain || 'No',
        data.chills_rigor || 'No',
        data.vomiting || 'No',
        data.back_pain || 'No',
        data.other_symptoms || '',
        data.specimen_taken || 'No',
        data.haemoparasite_spp || '',
        data.travel_history || '',
        data.travel_to_malaria_area || 'No',
        data.outcome || 'Alive',
        data.ftat_done || 'No',
        data.referred_facility || '',
        data.source_of_infection || '',
        req.user.id
      ]
    );

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'create', 'case', $2, $3)`,
      [req.user.id, result.id, `Created case for ${data.patient_name} at ${facility.name}`]
    );

    if (data.outcome === 'Death') {
      createAlert(req.user, 'alert', 'Death Case Reported',
        `A death case was recorded for ${data.patient_name} at ${facility.name}`);
    }

    res.status(201).json({ message: 'Case created successfully', id: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case', details: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM malaria_cases WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    if (!canModifyCase(req.user, existing)) {
      return res.status(403).json({ error: 'You do not have permission to edit this case' });
    }

    const data = req.body;
    await run(
      `UPDATE malaria_cases SET
        reporting_region=$1, zone=$2, woreda=$3, reporting_hf=$4, kebele=$5, house_no=$6, mobile_phone=$7,
        admission_type=$8, patient_name=$9, sex=$10, age=$11, epi_week=$12, age_category=$13, date_of_onset=$14, date_seen=$15,
        fever=$16, headache=$17, joint_pain=$18, chills_rigor=$19, vomiting=$20, back_pain=$21, other_symptoms=$22,
        specimen_taken=$23, haemoparasite_spp=$24, travel_history=$25, travel_to_malaria_area=$26,
        outcome=$27, ftat_done=$28, referred_facility=$29, source_of_infection=$30, updated_at=NOW()
       WHERE id=$31`,
      [
        data.reporting_region, data.zone, data.woreda, data.reporting_hf, data.kebele,
        data.house_no, data.mobile_phone, data.admission_type, data.patient_name,
        data.sex, data.age, data.epi_week, data.age_category, data.date_of_onset,
        data.date_seen, data.fever, data.headache, data.joint_pain, data.chills_rigor,
        data.vomiting, data.back_pain, data.other_symptoms, data.specimen_taken,
        data.haemoparasite_spp, data.travel_history, data.travel_to_malaria_area,
        data.outcome, data.ftat_done, data.referred_facility, data.source_of_infection,
        req.params.id
      ]
    );

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'update', 'case', $2, $3)`,
      [req.user.id, req.params.id, `Updated case ${req.params.id} - ${data.patient_name || ''}`]
    );

    res.json({ message: 'Case updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update case', details: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM malaria_cases WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    if (!canModifyCase(req.user, existing)) {
      return res.status(403).json({ error: 'You do not have permission to delete this case' });
    }

    if (req.user.role === 'facility_user') {
      return res.status(403).json({ error: 'Facility users cannot delete cases. Contact your admin.' });
    }

    await run('DELETE FROM malaria_cases WHERE id = $1', [req.params.id]);
    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'delete', 'case', $2, $3)`,
      [req.user.id, req.params.id, `Deleted case for ${existing.patient_name}`]
    );
    res.json({ message: 'Case deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

router.post('/import', authenticateToken, async (req, res) => {
  try {
    const { cases } = req.body;
    if (!Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({ error: 'No cases to import' });
    }

    const facilityId = req.user.facility_id;
    if (!facilityId && req.user.role === 'facility_user') {
      return res.status(403).json({ error: 'No facility assigned' });
    }

    const facility = facilityId ? await queryOne('SELECT * FROM facilities WHERE id = $1', [facilityId]) : null;

    let imported = 0;
    for (const c of cases) {
      try {
        const cFacilityId = c.facility_id || facilityId;
        await run(
          `INSERT INTO malaria_cases (
            facility_id, reporting_region, zone, woreda, reporting_hf, kebele, house_no, mobile_phone,
            admission_type, patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
            fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
            specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
            outcome, ftat_done, referred_facility, source_of_infection, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)`,
          [
            cFacilityId, c.reporting_region || facility?.region || '', c.zone || facility?.zone || '',
            c.woreda || facility?.woreda || '', c.reporting_hf || facility?.name || '',
            c.kebele || facility?.kebele || '', c.house_no || '',
            c.mobile_phone || '', c.admission_type || 'Out-Patient', c.patient_name || '',
            c.sex || 'M', c.age || 0, c.epi_week || getCurrentEpiWeek(), c.age_category || '',
            c.date_of_onset || '', c.date_seen || '', c.fever || 'No', c.headache || 'No',
            c.joint_pain || 'No', c.chills_rigor || 'No', c.vomiting || 'No',
            c.back_pain || 'No', c.other_symptoms || '', c.specimen_taken || 'No',
            c.haemoparasite_spp || '', c.travel_history || '', c.travel_to_malaria_area || 'No',
            c.outcome || 'Alive', c.ftat_done || 'No', c.referred_facility || '',
            c.source_of_infection || '', req.user.id
          ]
        );
        imported++;
      } catch (e) { /* skip invalid rows */ }
    }

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, details)
       VALUES ($1, 'import', 'case', $2)`,
      [req.user.id, `Imported ${imported} cases from Excel`]
    );

    res.json({ message: `Successfully imported ${imported} cases`, imported });
  } catch (err) {
    res.status(500).json({ error: 'Import failed', details: err.message });
  }
});

export default router;
