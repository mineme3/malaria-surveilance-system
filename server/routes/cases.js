import { Router } from 'express';
import { queryOne, queryAll, run, runReturning, sql, isActive } from '../db.js';
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
      `SELECT id FROM users WHERE role IN ('system_admin','region_admin','zone_admin','district_admin') AND ${isActive()}`
    );
    for (const admin of admins) {
      await run('INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [admin.id, title, message, type]);
    }
  } catch (e) { /* non-critical */ }
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, region, zone, woreda, kebele, date_from, date_to, sex, age_category, outcome, facility_id, epi_week, admission_type, haemoparasite_spp } = req.query;
    const safePage = Math.max(1, parseInt(page) || 1);
    const safeLimit = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (safePage - 1) * safeLimit;
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

    if (search) { where += ` AND ${sql.like('c.patient_name', `$${paramIndex++}`)}`; params.push(`%${search}%`); }
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
    if (kebele) { where += ` AND c.kebele = $${paramIndex++}`; params.push(kebele); }
    if (admission_type) { where += ` AND c.admission_type = $${paramIndex++}`; params.push(admission_type); }
    if (haemoparasite_spp) { where += ` AND c.haemoparasite_spp = $${paramIndex++}`; params.push(haemoparasite_spp); }

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
      [...params, safeLimit, offset]
    );

    res.json({ cases, total, page: safePage, limit: safeLimit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases',  });
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

    const thisMonth = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND ${sql.dateTruncMonth('c.date_seen')} = ${sql.nowMonth()}`, baseParams)).count);

    const thisYear = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND ${sql.dateTruncYear('c.date_seen')} = ${sql.nowYear()}`, baseParams)).count);

    const deaths = parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.outcome = 'Death'`, baseParams)).count);

    const facilitiesReporting = parseInt((await queryOne(`SELECT COUNT(DISTINCT c.facility_id) as count FROM malaria_cases c ${baseWhere} AND ${sql.dateTruncMonth('c.date_seen')} = ${sql.nowMonth()}`, baseParams)).count);

    const casesByWeek = await queryAll(`SELECT c.epi_week as week, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND ${sql.dateTruncYear('c.date_seen')} = ${sql.nowYear()} GROUP BY c.epi_week ORDER BY c.epi_week`, baseParams);

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
      positive_rate: totalCases > 0 ? ((parseInt((await queryOne(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.haemoparasite_spp != ''`, baseParams)).count) / totalCases) * 100).toFixed(1) : 0,
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
    console.error('Stats endpoint error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch stats' });
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

    // Input validation
    if (typeof data.patient_name !== 'string' || data.patient_name.length < 1 || data.patient_name.length > 200) {
      return res.status(400).json({ error: 'Invalid patient name' });
    }
    if (!['M', 'F'].includes(data.sex)) {
      return res.status(400).json({ error: 'Sex must be M or F' });
    }
    const age = parseInt(data.age);
    if (isNaN(age) || age < 0 || age > 150) {
      return res.status(400).json({ error: 'Invalid age' });
    }
    if (data.outcome && !['Alive', 'Death'].includes(data.outcome)) {
      return res.status(400).json({ error: 'Invalid outcome value' });
    }
    if (data.admission_type && !['Out-Patient', 'In-Patient'].includes(data.admission_type)) {
      return res.status(400).json({ error: 'Invalid admission type' });
    }
    if (data.epi_week) {
      const ew = parseInt(data.epi_week);
      if (isNaN(ew) || ew < 1 || ew > 53) {
        return res.status(400).json({ error: 'Invalid epi week' });
      }
    }
    const yesNoFields = ['fever', 'headache', 'joint_pain', 'chills_rigor', 'vomiting', 'back_pain', 'specimen_taken', 'ftat_done'];
    for (const field of yesNoFields) {
      if (data[field] && !['Yes', 'No'].includes(data[field])) {
        return res.status(400).json({ error: `Invalid value for ${field}` });
      }
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
    res.status(500).json({ error: 'Failed to create case',  });
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
    res.status(500).json({ error: 'Failed to update case',  });
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

router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { cases } = req.body;
    if (!Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({ error: 'No cases to sync' });
    }

    const results = [];
    for (const c of cases) {
      try {
        const clientId = c.client_side_id;

        // Check if a case with this client_side_id already exists
        if (clientId) {
          const existing = await queryOne('SELECT id, updated_at, facility_id, zone, woreda FROM malaria_cases WHERE client_side_id = $1', [clientId]);

          if (existing) {
            // Check if user has permission to modify this case
            const existingCase = await queryOne('SELECT * FROM malaria_cases WHERE id = $1', [existing.id]);
            if (existingCase && !canModifyCase(req.user, existingCase)) {
              results.push({ client_side_id: clientId, status: 'error', error: 'Access denied' });
              continue;
            }

            // Compare timestamps: server version wins if it's newer, otherwise client version wins
            const clientUpdated = new Date(c.updated_at || 0).getTime();
            const serverUpdated = new Date(existing.updated_at || 0).getTime();

            if (clientUpdated > serverUpdated) {
              // Client version is newer — update the server record
              const data = c;
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
                  existing.id
                ]
              );

              await run(
                `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES ($1, 'update', 'case', $2, $3)`,
                [req.user.id, existing.id, `Conflict resolved — client overwrote server for ${data.patient_name}`]
              );

              results.push({ client_side_id: clientId, status: 'updated', server_id: existing.id });
            } else {
              // Server version is newer or equal — keep server version
              results.push({ client_side_id: clientId, status: 'conflict_server_wins', server_id: existing.id });
            }
            continue;
          }
        }

        // No existing case — create a new one
        const facilityId = c.facility_id || req.user.facility_id;
        if (!facilityId) {
          results.push({ client_side_id: clientId, status: 'error', error: 'No facility assigned' });
          continue;
        }

        const facility = await queryOne('SELECT * FROM facilities WHERE id = $1', [facilityId]);
        if (!facility) {
          results.push({ client_side_id: clientId, status: 'error', error: 'Invalid facility' });
          continue;
        }

        // Enforce data scope for all roles
        if (req.user.role === 'facility_user' || req.user.role === 'facility_admin') {
          if (facilityId !== req.user.facility_id) {
            results.push({ client_side_id: clientId, status: 'error', error: 'Facility mismatch' });
            continue;
          }
        } else if (req.user.role === 'district_admin') {
          if (facility.woreda !== req.user.woreda) {
            results.push({ client_side_id: clientId, status: 'error', error: 'Facility outside your district' });
            continue;
          }
        } else if (req.user.role === 'zone_admin') {
          if (facility.zone !== req.user.zone) {
            results.push({ client_side_id: clientId, status: 'error', error: 'Facility outside your zone' });
            continue;
          }
        } else if (req.user.role === 'region_admin') {
          if (facility.region !== req.user.region) {
            results.push({ client_side_id: clientId, status: 'error', error: 'Facility outside your region' });
            continue;
          }
        }

        const result = await runReturning(
          `INSERT INTO malaria_cases (
            client_side_id, facility_id, reporting_region, zone, woreda, reporting_hf, kebele, house_no, mobile_phone,
            admission_type, patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
            fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
            specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
            outcome, ftat_done, referred_facility, source_of_infection, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33) RETURNING id`,
          [
            clientId || '',
            facilityId,
            c.reporting_region || facility.region || '',
            c.zone || facility.zone || '',
            c.woreda || facility.woreda || '',
            c.reporting_hf || facility.name || '',
            c.kebele || facility.kebele || '',
            c.house_no || '',
            c.mobile_phone || '',
            c.admission_type || 'Out-Patient',
            c.patient_name,
            c.sex,
            c.age,
            c.epi_week || getCurrentEpiWeek(),
            c.age_category || '',
            c.date_of_onset || '',
            c.date_seen || new Date().toISOString().split('T')[0],
            c.fever || 'No',
            c.headache || 'No',
            c.joint_pain || 'No',
            c.chills_rigor || 'No',
            c.vomiting || 'No',
            c.back_pain || 'No',
            c.other_symptoms || '',
            c.specimen_taken || 'No',
            c.haemoparasite_spp || '',
            c.travel_history || '',
            c.travel_to_malaria_area || 'No',
            c.outcome || 'Alive',
            c.ftat_done || 'No',
            c.referred_facility || '',
            c.source_of_infection || '',
            req.user.id
          ]
        );

        await run(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES ($1, 'create', 'case', $2, $3)`,
          [req.user.id, result.id, `Synced case for ${c.patient_name}`]
        );

        results.push({ client_side_id: clientId, status: 'created', server_id: result.id });
      } catch (e) {
        results.push({ client_side_id: c.client_side_id, status: 'error', error: 'Sync failed for this case' });
      }
    }

    res.json({
      message: `Synced ${results.filter(r => r.status === 'created').length} created, ${results.filter(r => r.status === 'updated').length} updated, ${results.filter(r => r.status === 'conflict_server_wins').length} conflicts (server kept)`,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed',  });
  }
});

router.post('/import', authenticateToken, async (req, res) => {
  try {
    const { cases } = req.body;
    if (!Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({ error: 'No cases to import' });
    }

    const userFacilityId = req.user.facility_id;
    if (!userFacilityId && req.user.role === 'facility_user') {
      return res.status(403).json({ error: 'No facility assigned' });
    }

    const userFacility = userFacilityId ? await queryOne('SELECT * FROM facilities WHERE id = $1', [userFacilityId]) : null;

    // Pre-validate all rows for facility scope
    const errors = [];
    let imported = 0;

    for (const c of cases) {
      try {
        // Determine the facility for this row
        let cFacilityId = c.facility_id ? parseInt(c.facility_id) : null;
        if (!cFacilityId) cFacilityId = userFacilityId;

        if (!cFacilityId) {
          errors.push(`Row for "${c.patient_name || 'unknown'}": no facility specified`);
          continue;
        }

        // Verify facility exists
        const rowFacility = await queryOne('SELECT id, name, region, zone, woreda FROM facilities WHERE id = $1', [cFacilityId]);
        if (!rowFacility) {
          errors.push(`Row for "${c.patient_name || 'unknown'}": facility ID ${cFacilityId} not found`);
          continue;
        }

        // Enforce facility scope
        if (req.user.role === 'facility_user' || req.user.role === 'facility_admin') {
          if (cFacilityId !== req.user.facility_id) {
            errors.push(`Row for "${c.patient_name || 'unknown'}": cannot import to facility ID ${cFacilityId} — you are assigned to facility ID ${req.user.facility_id}`);
            continue;
          }
        }

        // For district_admin+, verify the facility is in their scope
        if (req.user.role === 'district_admin' && rowFacility.woreda !== req.user.woreda) {
          errors.push(`Row for "${c.patient_name || 'unknown'}": facility is outside your district`);
          continue;
        }
        if (req.user.role === 'zone_admin' && rowFacility.zone !== req.user.zone) {
          errors.push(`Row for "${c.patient_name || 'unknown'}": facility is outside your zone`);
          continue;
        }
        if (req.user.role === 'region_admin' && rowFacility.region !== req.user.region) {
          errors.push(`Row for "${c.patient_name || 'unknown'}": facility is outside your region`);
          continue;
        }

        await run(
          `INSERT INTO malaria_cases (
            facility_id, reporting_region, zone, woreda, reporting_hf, kebele, house_no, mobile_phone,
            admission_type, patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
            fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
            specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
            outcome, ftat_done, referred_facility, source_of_infection, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)`,
          [
            cFacilityId, c.reporting_region || rowFacility.region || '', c.zone || rowFacility.zone || '',
            c.woreda || rowFacility.woreda || '', c.reporting_hf || rowFacility.name || '',
            c.kebele || rowFacility.kebele || '', c.house_no || '',
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
      } catch (e) {
        errors.push(`Row for "${c.patient_name || 'unknown'}": ${e.message}`);
      }
    }

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, details)
       VALUES ($1, 'import', 'case', $2)`,
      [req.user.id, `Imported ${imported} cases from Excel (${errors.length} errors)`]
    );

    res.json({
      message: `Successfully imported ${imported} cases${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
      imported,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: 'Import failed',  });
  }
});

router.post('/generate', authenticateToken, async (req, res) => {
  try {
    if (!['system_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only system administrators can generate test data' });
    }

    const { count = 20 } = req.body;
    const numCases = Math.min(parseInt(count) || 20, 200);

    const facilities = await queryAll(`SELECT id, name, region, zone, woreda, kebele FROM facilities WHERE ${isActive()}`);
    const users = await queryAll("SELECT id FROM users WHERE role = 'facility_user'");

    if (facilities.length === 0) {
      return res.status(400).json({ error: 'No facilities found. Seed the database first.' });
    }

    const firstNamesM = ['Abdi', 'Ahmed', 'Amanuel', 'Berhanu', 'Dawit', 'Elias', 'Fikru', 'Gebre', 'Habtamu', 'Henok', 'Kebede', 'Lemma', 'Mekonnen', 'Samuel', 'Tesfaye'];
    const firstNamesF = ['Abebech', 'Almaz', 'Asnakech', 'Belaynesh', 'Desta', 'Etenesh', 'Firehiwot', 'Genet', 'Hanna', 'Hirut', 'Kebebush', 'Mekdes', 'Meseret', 'Rahel', 'Saba'];
    const lastNames = ['Abebe', 'Alemayehu', 'Asfaw', 'Belay', 'Berhe', 'Desta', 'Fikre', 'Gebremedhin', 'Getahun', 'Kahsay', 'Mekonnen', 'Mengistu', 'Mesfin', 'Negash', 'Tesfaye'];
    const parasiteSpecies = ['P. falciparum', 'P. vivax', 'P. ovale', 'Mixed infection'];
    const outcomes = ['Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Death'];
    const kebeles = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', 'Melka Jebdu', 'Adada', 'Belen'];
    const symptoms = { fever: 0.92, headache: 0.80, jointPain: 0.65, chills: 0.75, vomiting: 0.30, backPain: 0.25 };

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    let inserted = 0;
    for (let i = 0; i < numCases; i++) {
      const facility = pick(facilities);
      const user = users.length > 0 ? pick(users) : { id: 1 };
      const isMale = Math.random() > 0.5;
      const age = Math.random() < 0.15 ? rand(0, 4) : Math.random() < 0.35 ? rand(5, 14) : Math.random() < 0.85 ? rand(15, 49) : rand(50, 80);
      const epiWeek = rand(25, 35);
      const baseDate = new Date(2026, 0, 1 + (epiWeek - 1) * 7 + rand(0, 6));
      const dateSeen = baseDate.toISOString().split('T')[0];
      const dateOnset = new Date(baseDate.getTime() - rand(1, 5) * 86400000).toISOString().split('T')[0];

      await run(
        `INSERT INTO malaria_cases (
          client_side_id, facility_id, reporting_region, zone, woreda,
          reporting_hf, kebele, house_no, mobile_phone, admission_type,
          patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
          fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
          specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
          outcome, ftat_done, referred_facility, source_of_infection, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)`,
        [
          `gen-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          facility.id,
          facility.region, facility.zone, facility.woreda,
          facility.name, pick(kebeles), String(rand(1, 999)),
          Math.random() < 0.4 ? `09${rand(11, 99)}${rand(1000000, 9999999)}` : '',
          age < 5 || Math.random() < 0.2 ? 'In-Patient' : 'Out-Patient',
          `${isMale ? pick(firstNamesM) : pick(firstNamesF)} ${pick(lastNames)}`,
          isMale ? 'M' : 'F',
          age,
          epiWeek,
          age <= 4 ? 'Under 5' : age <= 14 ? '5-14' : age <= 49 ? '15-49' : '50+',
          dateOnset,
          dateSeen,
          Math.random() < symptoms.fever ? 'Yes' : 'No',
          Math.random() < symptoms.headache ? 'Yes' : 'No',
          Math.random() < symptoms.jointPain ? 'Yes' : 'No',
          Math.random() < symptoms.chills ? 'Yes' : 'No',
          Math.random() < symptoms.vomiting ? 'Yes' : 'No',
          Math.random() < symptoms.backPain ? 'Yes' : 'No',
          Math.random() < 0.2 ? pick(['Nausea', 'Diarrhea', 'Abdominal pain', 'Dizziness']) : '',
          Math.random() < 0.85 ? 'Yes' : 'No',
          Math.random() < 0.85 ? pick(parasiteSpecies) : '',
          Math.random() < 0.15 ? 'Traveled to lowland area' : '',
          Math.random() < 0.15 ? 'Yes' : 'No',
          pick(outcomes),
          Math.random() < 0.90 ? 'Yes' : 'No',
          '',
          pick(['Community acquired', 'Unknown', 'Travel related', 'Local transmission']),
          user.id,
        ]
      );
      inserted++;
    }

    await run(
      `INSERT INTO audit_logs (user_id, action, entity_type, details)
       VALUES ($1, 'generate', 'malaria_case', $2)`,
      [req.user.id, `Generated ${inserted} test malaria cases`]
    );

    res.json({ message: `Generated ${inserted} test cases`, count: inserted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate data',  });
  }
});

export default router;
