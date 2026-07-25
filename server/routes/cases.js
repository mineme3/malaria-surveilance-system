import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, buildDataScope, canModifyCase } from '../middleware/auth.js';

const router = Router();

function getCurrentEpiWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil(diff / 604800000);
}

function createAlert(user, type, title, message) {
  try {
    const admins = db.prepare(`SELECT id FROM users WHERE role IN ('system_admin','region_admin','zone_admin','district_admin') AND is_active = 1`).all();
    const insert = db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)');
    for (const admin of admins) {
      insert.run(admin.id, title, message, type);
    }
  } catch (e) { /* non-critical */ }
}

router.get('/', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 50, search, region, zone, woreda, date_from, date_to, sex, age_category, outcome, facility_id, epi_week } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const scope = buildDataScope(req.user);

    let where = 'WHERE 1=1';
    const params = [];

    if (scope.where) {
      where += scope.where;
      params.push(...scope.params);
    }

    if (search) { where += ' AND c.patient_name LIKE ?'; params.push(`%${search}%`); }
    if (region) { where += ' AND c.reporting_region = ?'; params.push(region); }
    if (zone) { where += ' AND c.zone = ?'; params.push(zone); }
    if (woreda) { where += ' AND c.woreda = ?'; params.push(woreda); }
    if (date_from) { where += ' AND c.date_seen >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND c.date_seen <= ?'; params.push(date_to); }
    if (sex) { where += ' AND c.sex = ?'; params.push(sex); }
    if (age_category) { where += ' AND c.age_category = ?'; params.push(age_category); }
    if (outcome) { where += ' AND c.outcome = ?'; params.push(outcome); }
    if (facility_id) { where += ' AND c.facility_id = ?'; params.push(parseInt(facility_id)); }
    if (epi_week) { where += ' AND c.epi_week = ?'; params.push(parseInt(epi_week)); }

    const total = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases c ${where}`).get(...params).count;
    const cases = db.prepare(`SELECT c.*, f.name as facility_name, u.full_name as entered_by_name
      FROM malaria_cases c
      LEFT JOIN facilities f ON c.facility_id = f.id
      LEFT JOIN users u ON c.created_by = u.id
      ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, parseInt(limit), offset);

    res.json({ cases, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases', details: err.message });
  }
});

router.get('/stats', authenticateToken, (req, res) => {
  try {
    const scope = buildDataScope(req.user);
    let baseWhere = 'WHERE 1=1';
    const baseParams = [];

    if (scope.where) {
      baseWhere += scope.where;
      baseParams.push(...scope.params);
    }

    const totalCases = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere}`).get(...baseParams).count;

    const thisWeekNum = getCurrentEpiWeek();
    const thisWeek = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.epi_week = ?`).get(...baseParams, thisWeekNum).count;

    const thisMonth = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND strftime('%Y-%m', c.date_seen) = strftime('%Y-%m', 'now')`).get(...baseParams).count;

    const thisYear = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND strftime('%Y', c.date_seen) = strftime('%Y', 'now')`).get(...baseParams).count;

    const deaths = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.outcome = 'Death'`).get(...baseParams).count;

    const facilitiesReporting = db.prepare(`SELECT COUNT(DISTINCT c.facility_id) as count FROM malaria_cases c ${baseWhere} AND strftime('%Y-%m', c.date_seen) = strftime('%Y-%m', 'now')`).get(...baseParams).count;

    const casesByWeek = db.prepare(`SELECT c.epi_week as week, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND strftime('%Y', c.date_seen) = strftime('%Y', 'now') GROUP BY c.epi_week ORDER BY c.epi_week`).all(...baseParams);

    const casesByRegion = db.prepare(`SELECT c.reporting_region as region, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.reporting_region != '' GROUP BY c.reporting_region ORDER BY count DESC`).all(...baseParams);

    const casesByWoreda = db.prepare(`SELECT c.woreda, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.woreda != '' GROUP BY c.woreda ORDER BY count DESC LIMIT 10`).all(...baseParams);

    const casesByFacility = db.prepare(`SELECT f.name as facility_name, COUNT(*) as count FROM malaria_cases c LEFT JOIN facilities f ON c.facility_id = f.id ${baseWhere} GROUP BY c.facility_id ORDER BY count DESC LIMIT 10`).all(...baseParams);

    const casesByAge = db.prepare(`SELECT c.age_category as category, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.age_category != '' GROUP BY c.age_category ORDER BY count DESC`).all(...baseParams);

    const casesBySex = db.prepare(`SELECT c.sex, COUNT(*) as count FROM malaria_cases c ${baseWhere} GROUP BY c.sex`).all(...baseParams);

    const speciesDistribution = db.prepare(`SELECT c.haemoparasite_spp as species, COUNT(*) as count FROM malaria_cases c ${baseWhere} AND c.haemoparasite_spp != '' GROUP BY c.haemoparasite_spp`).all(...baseParams);

    const casesByAdmission = db.prepare(`SELECT c.admission_type as type, COUNT(*) as count FROM malaria_cases c ${baseWhere} GROUP BY c.admission_type`).all(...baseParams);

    const recentTrend = db.prepare(`SELECT c.date_seen as date, COUNT(*) as count FROM malaria_cases c ${baseWhere} GROUP BY c.date_seen ORDER BY c.date_seen DESC LIMIT 30`).all(...baseParams);

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

router.get('/export', authenticateToken, (req, res) => {
  try {
    const scope = buildDataScope(req.user);
    let where = 'WHERE 1=1';
    const params = [];

    if (scope.where) {
      where += scope.where;
      params.push(...scope.params);
    }

    const { date_from, date_to, region, zone, woreda, facility_id } = req.query;
    if (date_from) { where += ' AND c.date_seen >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND c.date_seen <= ?'; params.push(date_to); }
    if (region) { where += ' AND c.reporting_region = ?'; params.push(region); }
    if (zone) { where += ' AND c.zone = ?'; params.push(zone); }
    if (woreda) { where += ' AND c.woreda = ?'; params.push(woreda); }
    if (facility_id) { where += ' AND c.facility_id = ?'; params.push(parseInt(facility_id)); }

    const cases = db.prepare(`SELECT c.* FROM malaria_cases c ${where} ORDER BY c.date_seen DESC`).all(...params);
    res.json({ cases, total: cases.length });
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const malariaCase = db.prepare(`SELECT c.*, f.name as facility_name, u.full_name as entered_by_name
      FROM malaria_cases c
      LEFT JOIN facilities f ON c.facility_id = f.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?`).get(req.params.id);
    if (!malariaCase) return res.status(404).json({ error: 'Case not found' });

    const scope = buildDataScope(req.user);
    if (scope.where) {
      const check = db.prepare(`SELECT 1 FROM malaria_cases c WHERE c.id = ? ${scope.where}`);
      if (!check.get(req.params.id, ...scope.params)) {
        return res.status(403).json({ error: 'Access denied to this case' });
      }
    }

    res.json(malariaCase);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const data = req.body;
    if (!data.patient_name || !data.sex || data.age === undefined) {
      return res.status(400).json({ error: 'Patient name, sex, and age are required' });
    }

    const facilityId = data.facility_id || req.user.facility_id;
    if (!facilityId) {
      return res.status(400).json({ error: 'Facility assignment is required' });
    }

    const facility = db.prepare('SELECT * FROM facilities WHERE id = ?').get(facilityId);
    if (!facility) {
      return res.status(400).json({ error: 'Invalid facility' });
    }

    if (req.user.role === 'facility_user' || req.user.role === 'facility_admin') {
      if (facilityId !== req.user.facility_id) {
        return res.status(403).json({ error: 'You can only create cases for your assigned facility' });
      }
    }

    const result = db.prepare(`INSERT INTO malaria_cases (
      facility_id, reporting_region, zone, woreda, reporting_hf, kebele, house_no, mobile_phone,
      admission_type, patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
      fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
      specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
      outcome, ftat_done, referred_facility, source_of_infection, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
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
    );

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'create', 'case', ?, ?)`).run(req.user.id, result.lastInsertRowid,
      `Created case for ${data.patient_name} at ${facility.name}`);

    if (data.outcome === 'Death') {
      createAlert(req.user, 'alert', 'Death Case Reported',
        `A death case was recorded for ${data.patient_name} at ${facility.name}`);
    }

    res.status(201).json({ message: 'Case created successfully', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case', details: err.message });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM malaria_cases WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    if (!canModifyCase(req.user, existing)) {
      return res.status(403).json({ error: 'You do not have permission to edit this case' });
    }

    const data = req.body;
    db.prepare(`UPDATE malaria_cases SET (
      reporting_region, zone, woreda, reporting_hf, kebele, house_no, mobile_phone,
      admission_type, patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
      fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
      specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
      outcome, ftat_done, referred_facility, source_of_infection, updated_at
    ) = (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    WHERE id = ?`).run(
      data.reporting_region, data.zone, data.woreda, data.reporting_hf, data.kebele,
      data.house_no, data.mobile_phone, data.admission_type, data.patient_name,
      data.sex, data.age, data.epi_week, data.age_category, data.date_of_onset,
      data.date_seen, data.fever, data.headache, data.joint_pain, data.chills_rigor,
      data.vomiting, data.back_pain, data.other_symptoms, data.specimen_taken,
      data.haemoparasite_spp, data.travel_history, data.travel_to_malaria_area,
      data.outcome, data.ftat_done, data.referred_facility, data.source_of_infection,
      req.params.id
    );

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'update', 'case', ?, ?)`).run(req.user.id, req.params.id,
      `Updated case ${req.params.id} - ${data.patient_name || ''}`);

    res.json({ message: 'Case updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update case', details: err.message });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM malaria_cases WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    if (!canModifyCase(req.user, existing)) {
      return res.status(403).json({ error: 'You do not have permission to delete this case' });
    }

    if (req.user.role === 'facility_user') {
      return res.status(403).json({ error: 'Facility users cannot delete cases. Contact your admin.' });
    }

    db.prepare('DELETE FROM malaria_cases WHERE id = ?').run(req.params.id);
    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'delete', 'case', ?, ?)`).run(req.user.id, req.params.id,
      `Deleted case for ${existing.patient_name}`);
    res.json({ message: 'Case deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

router.post('/import', authenticateToken, (req, res) => {
  try {
    const { cases } = req.body;
    if (!Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({ error: 'No cases to import' });
    }

    const facilityId = req.user.facility_id;
    if (!facilityId && req.user.role === 'facility_user') {
      return res.status(403).json({ error: 'No facility assigned' });
    }

    const facility = facilityId ? db.prepare('SELECT * FROM facilities WHERE id = ?').get(facilityId) : null;

    const insert = db.prepare(`INSERT INTO malaria_cases (
      facility_id, reporting_region, zone, woreda, reporting_hf, kebele, house_no, mobile_phone,
      admission_type, patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
      fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
      specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
      outcome, ftat_done, referred_facility, source_of_infection, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const insertMany = db.transaction((items) => {
      let imported = 0;
      for (const c of items) {
        try {
          const cFacilityId = c.facility_id || facilityId;
          const cFacility = facility;
          insert.run(
            cFacilityId, c.reporting_region || cFacility?.region || '', c.zone || cFacility?.zone || '',
            c.woreda || cFacility?.woreda || '', c.reporting_hf || cFacility?.name || '',
            c.kebele || cFacility?.kebele || '', c.house_no || '',
            c.mobile_phone || '', c.admission_type || 'Out-Patient', c.patient_name || '',
            c.sex || 'M', c.age || 0, c.epi_week || getCurrentEpiWeek(), c.age_category || '',
            c.date_of_onset || '', c.date_seen || '', c.fever || 'No', c.headache || 'No',
            c.joint_pain || 'No', c.chills_rigor || 'No', c.vomiting || 'No',
            c.back_pain || 'No', c.other_symptoms || '', c.specimen_taken || 'No',
            c.haemoparasite_spp || '', c.travel_history || '', c.travel_to_malaria_area || 'No',
            c.outcome || 'Alive', c.ftat_done || 'No', c.referred_facility || '',
            c.source_of_infection || '', req.user.id
          );
          imported++;
        } catch (e) { /* skip invalid rows */ }
      }
      return imported;
    });

    const imported = insertMany(cases);

    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, details)
      VALUES (?, 'import', 'case', ?)`).run(req.user.id, `Imported ${imported} cases from Excel`);

    res.json({ message: `Successfully imported ${imported} cases`, imported });
  } catch (err) {
    res.status(500).json({ error: 'Import failed', details: err.message });
  }
});

export default router;
