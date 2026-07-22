import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 50, search, region, zone, woreda, date_from, date_to, sex, age_category, outcome } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];

    if (req.user.role === 'facility_user' || req.user.role === 'facility_admin') {
      where += ' AND c.facility_id = ?';
      params.push(req.user.facility_id);
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

    const total = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases c ${where}`).get(...params).count;
    const cases = db.prepare(`SELECT c.*, f.name as facility_name FROM malaria_cases c LEFT JOIN facilities f ON c.facility_id = f.id ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, parseInt(limit), offset);

    res.json({ cases, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases', details: err.message });
  }
});

router.get('/stats', authenticateToken, (req, res) => {
  try {
    let facilityFilter = '';
    const params = [];
    if (req.user.role === 'facility_user' || req.user.role === 'facility_admin') {
      facilityFilter = 'WHERE facility_id = ?';
      params.push(req.user.facility_id);
    }

    const totalCases = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases ${facilityFilter}`).get(...params).count;
    
    const thisWeek = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases ${facilityFilter ? facilityFilter + ' AND' : 'WHERE'} epi_week = (SELECT MAX(epi_week) FROM malaria_cases)`).get(...params).count;
    
    const thisMonth = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases ${facilityFilter ? facilityFilter + ' AND' : 'WHERE'} strftime('%Y-%m', date_seen) = strftime('%Y-%m', 'now')`).get(...params).count;
    
    const thisYear = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases ${facilityFilter ? facilityFilter + ' AND' : 'WHERE'} strftime('%Y', date_seen) = strftime('%Y', 'now')`).get(...params).count;
    
    const deaths = db.prepare(`SELECT COUNT(*) as count FROM malaria_cases ${facilityFilter ? facilityFilter + ' AND' : 'WHERE'} outcome = 'Death'`).get(...params).count;

    const facilitiesReporting = db.prepare(`SELECT COUNT(DISTINCT facility_id) as count FROM malaria_cases ${facilityFilter ? facilityFilter + ' AND' : 'WHERE'} strftime('%Y-%m', date_seen) = strftime('%Y-%m', 'now')`).get(...params).count;

    const casesByWeek = db.prepare(`SELECT epi_week as week, COUNT(*) as count FROM malaria_cases ${facilityFilter ? facilityFilter + ' AND' : 'WHERE'} strftime('%Y', date_seen) = strftime('%Y', 'now') GROUP BY epi_week ORDER BY epi_week`).all(...params);

    const casesByRegion = db.prepare(`SELECT reporting_region as region, COUNT(*) as count FROM malaria_cases ${facilityFilter ? facilityFilter + ' AND' : 'WHERE'} reporting_region != '' GROUP BY reporting_region ORDER BY count DESC`).all(...params);

    const casesByAge = db.prepare(`SELECT age_category as category, COUNT(*) as count FROM malaria_cases ${facilityFilter ? facilityFilter + ' AND' : 'WHERE'} age_category != '' GROUP BY age_category ORDER BY count DESC`).all(...params);

    const casesBySex = db.prepare(`SELECT sex, COUNT(*) as count FROM malaria_cases ${facilityFilter} GROUP BY sex`).all(...params);

    const speciesDistribution = db.prepare(`SELECT haemoparasite_spp as species, COUNT(*) as count FROM malaria_cases ${facilityFilter ? facilityFilter + ' AND' : 'WHERE'} haemoparasite_spp != '' GROUP BY haemoparasite_spp`).all(...params);

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
      cases_by_age: casesByAge,
      cases_by_sex: casesBySex,
      species_distribution: speciesDistribution,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const malariaCase = db.prepare('SELECT c.*, f.name as facility_name FROM malaria_cases c LEFT JOIN facilities f ON c.facility_id = f.id WHERE c.id = ?').get(req.params.id);
    if (!malariaCase) return res.status(404).json({ error: 'Case not found' });
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

    const facility = db.prepare('SELECT * FROM facilities WHERE id = ?').get(data.facility_id || req.user.facility_id);
    
    const result = db.prepare(`INSERT INTO malaria_cases (
      facility_id, reporting_region, zone, woreda, reporting_hf, kebele, house_no, mobile_phone,
      admission_type, patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
      fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
      specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
      outcome, ftat_done, referred_facility, source_of_infection, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      data.facility_id || req.user.facility_id,
      data.reporting_region || facility?.region || '',
      data.zone || facility?.zone || '',
      data.woreda || facility?.woreda || '',
      data.reporting_hf || facility?.name || '',
      data.kebele || facility?.kebele || '',
      data.house_no || '',
      data.mobile_phone || '',
      data.admission_type || 'Out-Patient',
      data.patient_name,
      data.sex,
      data.age,
      data.epi_week || new Date().getWeek(),
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

    res.status(201).json({ message: 'Case created successfully', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case', details: err.message });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
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
      VALUES (?, 'update', 'case', ?, ?)`).run(req.user.id, req.params.id, `Updated case ${req.params.id}`);

    res.json({ message: 'Case updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update case', details: err.message });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM malaria_cases WHERE id = ?').run(req.params.id);
    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'delete', 'case', ?, ?)`).run(req.user.id, req.params.id, `Deleted case ${req.params.id}`);
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
          insert.run(
            c.facility_id || req.user.facility_id, c.reporting_region || '', c.zone || '',
            c.woreda || '', c.reporting_hf || '', c.kebele || '', c.house_no || '',
            c.mobile_phone || '', c.admission_type || 'Out-Patient', c.patient_name || '',
            c.sex || 'M', c.age || 0, c.epi_week || 0, c.age_category || '',
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
    res.json({ message: `Successfully imported ${imported} cases`, imported });
  } catch (err) {
    res.status(500).json({ error: 'Import failed', details: err.message });
  }
});

export default router;
