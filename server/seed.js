import bcrypt from 'bcryptjs';
import { queryOne, queryAll, run, runReturning } from './db.js';

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];

const firstNamesM = [
  'Abdi', 'Ahmed', 'Amanuel', 'Berhanu', 'Dawit', 'Elias', 'Fikru',
  'Gebre', 'Habtamu', 'Henok', 'Kebede', 'Lemma', 'Mekonnen', 'Mulugeta',
  'Samuel', 'Tesfaye', 'Tewodros', 'Yonas', 'Zerihun', 'Tamirat',
  'Abdulaziz', 'Binyam', 'Chala', 'Demeke', 'Ephrem', 'Getachew',
  'Hailu', 'Jemal', 'Kassahun', 'Melaku', 'Netsanet', 'Tekle',
  'Wondimu', 'Yared', 'Zemedkun',
];

const firstNamesF = [
  'Abebech', 'Almaz', 'Asnakech', 'Belaynesh', 'Birhane', 'Desta',
  'Etenesh', 'Firehiwot', 'Genet', 'Hanna', 'Hirut', 'Kebebush',
  'Mekdes', 'Meseret', 'Mulunesh', 'Rahel', 'Roman', 'Saba',
  'Selam', 'Tigist', 'Tsion', 'Werknesh', 'Yeshi', 'Zewditu',
  'Aster', 'Birtukan', 'Eyerusalem', 'Fozia', 'Meron', 'Sara',
  'Tsehay', 'Woinitu', 'Zinash',
];

const lastNames = [
  'Abebe', 'Alemayehu', 'Asfaw', 'Belay', 'Berhe', 'Desta',
  'Fikre', 'Gebremedhin', 'Getahun', 'Haileselassie', 'Kahsay',
  'Mekonnen', 'Mengistu', 'Mesfin', 'Negash', 'Teklehaimanot',
  'Tesfaye', 'Welde', 'Wondimu', 'Yeshitla', 'Zerihun',
  'Ahmed', 'Hussein', 'Mohammed', 'Omar', 'Yusuf',
];

const kebeles = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
                 'Melka Jebdu', 'Adada', 'Belen', 'Kurfa', 'Bishan Bari'];
const parasiteSpecies = ['P. falciparum', 'P. vivax', 'P. ovale', 'Mixed infection'];
const outcomes = ['Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Referred', 'Dead'];

function generatePatientName() {
  const isMale = Math.random() > 0.5;
  const first = isMale ? pick(firstNamesM) : pick(firstNamesF);
  const last = pick(lastNames);
  return `${first} ${last}`;
}

function generatePhone() {
  const prefixes = ['91', '92', '93', '94', '95', '96', '97', '98', '99'];
  return '0' + pick(prefixes) + String(rand(1000000, 9999999));
}

let _caseIdCounter = 0;

function generateCase(epiWeek, facilityId, userId, facilityName) {
  _caseIdCounter++;
  const isMale = Math.random() > 0.5;
  const age = Math.random() < 0.15 ? rand(0, 4)
              : Math.random() < 0.35 ? rand(5, 14)
              : Math.random() < 0.85 ? rand(15, 49)
              : rand(50, 80);
  const sex = isMale ? 'M' : 'F';
  const ageCategory = age <= 4 ? 'Under 5' : age <= 14 ? '5-14' : age <= 49 ? '15-49' : '50+';
  const hasFever = Math.random() < 0.92;
  const hasHeadache = Math.random() < 0.80;
  const hasJointPain = Math.random() < 0.65;
  const hasChills = Math.random() < 0.75;
  const hasVomiting = Math.random() < 0.30;
  const hasBackPain = Math.random() < 0.25;
  const hasTravel = Math.random() < 0.15;

  const baseDate = new Date(2026, 0, 1 + (epiWeek - 1) * 7 + rand(0, 6));
  const dateSeen = baseDate.toISOString().split('T')[0];
  const dateOnset = new Date(baseDate.getTime() - rand(1, 5) * 86400000).toISOString().split('T')[0];

  const specimenTaken = Math.random() < 0.85 ? 'Yes' : 'No';
  const species = pick(parasiteSpecies);

  return {
    client_side_id: 'seed-' + Date.now() + '-' + _caseIdCounter + '-' + Math.random().toString(36).slice(2, 6),
    facility_id: facilityId,
    reporting_region: 'DD',
    zone: 'DD',
    woreda: 'DDHC',
    reporting_hf: facilityName,
    kebele: pick(kebeles),
    house_no: String(rand(1, 999)),
    mobile_phone: Math.random() < 0.4 ? generatePhone() : '',
    admission_type: age < 5 || Math.random() < 0.2 ? 'In-Patient' : 'Out-Patient',
    patient_name: generatePatientName(),
    sex,
    age,
    epi_week: epiWeek,
    age_category: ageCategory,
    date_of_onset: dateOnset,
    date_seen: dateSeen,
    fever: hasFever ? 'Yes' : 'No',
    headache: hasHeadache ? 'Yes' : 'No',
    joint_pain: hasJointPain ? 'Yes' : 'No',
    chills_rigor: hasChills ? 'Yes' : 'No',
    vomiting: hasVomiting ? 'Yes' : 'No',
    back_pain: hasBackPain ? 'Yes' : 'No',
    other_symptoms: Math.random() < 0.2 ? pick(['Nausea', 'Diarrhea', 'Abdominal pain', 'Dizziness', 'Fatigue']) : '',
    specimen_taken: specimenTaken,
    haemoparasite_spp: specimenTaken === 'Yes' ? species : '',
    travel_history: hasTravel ? 'Traveled to lowland area 2 weeks ago' : '',
    travel_to_malaria_area: hasTravel ? 'Yes' : 'No',
    outcome: pick(outcomes),
    ftat_done: Math.random() < 0.90 ? 'Yes' : 'No',
    referred_facility: '',
    source_of_infection: pick(['Community acquired', 'Unknown', 'Travel related', 'Local transmission']),
    created_by: userId,
  };
}

export async function seedDatabase() {
  const adminExists = await queryOne('SELECT id FROM users WHERE username = $1', ['admin']);

  if (!adminExists) {
    console.log('Running initial seed (admin user not found)...');
    const hash = bcrypt.hashSync('admin123', 10);

    const admin = await runReturning(
      'INSERT INTO users (username, email, password_hash, full_name, role, region, zone, woreda) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      ['admin', 'admin@malaria.gov', hash, 'System Administrator', 'system_admin', 'DD', 'DD', 'DD']
    );
    const adminId = admin?.id || 1;

    const facilities = [
      { name: 'Congo Meda Health Center', region: 'DD', zone: 'DD', woreda: 'DDHC', kebele: '03', type: 'Health Center', phone: '0915842088' },
      { name: 'Abadir Health Center', region: 'DD', zone: 'DD', woreda: 'DDHC', kebele: 'Djibuti', type: 'Health Center', phone: '0915150140' },
      { name: 'Lange Health Center', region: 'DD', zone: 'DD', woreda: 'DDHC', kebele: 'Melka Jebdu', type: 'Health Center', phone: '0969417128' },
      { name: 'Meskelegn Health Post', region: 'DD', zone: 'DD', woreda: 'DDHC', kebele: '02', type: 'Health Post', phone: '0937947475' },
      { name: 'GtesFa Health Center', region: 'DD', zone: 'DD', woreda: 'DDHC', kebele: '02', type: 'Health Center', phone: '0943282084' },
      { name: 'Sabean Health Center', region: 'DD', zone: 'DD', woreda: 'Gurgura', kebele: '05', type: 'Health Center', phone: '0912345678' },
      { name: 'Adada Health Post', region: 'DD', zone: 'DD', woreda: 'Kasa', kebele: 'Adada', type: 'Health Post', phone: '0923456789' },
    ];

    const facilityIds = [];
    for (const f of facilities) {
      const rec = await runReturning(
        'INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [f.name, f.region, f.zone, f.woreda, f.kebele, f.type, f.phone]
      );
      facilityIds.push(rec?.id);
      console.log(`  Facility created: ${f.name} (id=${rec?.id})`);
    }

    const usersData = [
      { username: 'facility1', full_name: 'Tigist Hailu', role: 'facility_user', facility_id: facilityIds[0], region: 'DD', zone: 'DD', woreda: 'DDHC' },
      { username: 'facility2', full_name: 'Dawit Tesfaye', role: 'facility_user', facility_id: facilityIds[1], region: 'DD', zone: 'DD', woreda: 'DDHC' },
      { username: 'facility3', full_name: 'Meseret Alemayehu', role: 'facility_user', facility_id: facilityIds[2], region: 'DD', zone: 'DD', woreda: 'DDHC' },
      { username: 'facility4', full_name: 'Berhanu Asfaw', role: 'facility_user', facility_id: facilityIds[3], region: 'DD', zone: 'DD', woreda: 'DDHC' },
      { username: 'facility5', full_name: 'Hanna Gebremedhin', role: 'facility_user', facility_id: facilityIds[4], region: 'DD', zone: 'DD', woreda: 'DDHC' },
      { username: 'district1', full_name: 'Amanuel Kebede', role: 'district_admin', region: 'DD', zone: 'DD', woreda: 'DDHC' },
      { username: 'zone1', full_name: 'Firehiwot Desta', role: 'zone_admin', region: 'DD', zone: 'DD', woreda: '' },
      { username: 'region1', full_name: 'Getachew Mekonnen', role: 'region_admin', region: 'DD', zone: '', woreda: '' },
    ];

    for (const u of usersData) {
      await run(
        'INSERT INTO users (username, email, password_hash, full_name, role, facility_id, region, zone, woreda) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [u.username, `${u.username}@malaria.gov`, hash, u.full_name, u.role, u.facility_id || null, u.region, u.zone, u.woreda]
      );
      console.log(`  User created: ${u.username} (${u.full_name})`);
    }

    console.log('Base seed data inserted successfully');
  } else {
    console.log('Admin user already exists, skipping base seed');
  }

  const facilities = await queryAll('SELECT id, name FROM facilities WHERE is_active = 1 ORDER BY id');
  const users = await queryAll("SELECT id, username FROM users WHERE role = 'facility_user' ORDER BY id");
  const adminUser = await queryOne("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
  const adminId = adminUser?.id || 1;

  const existingCount = await queryOne('SELECT COUNT(*) as cnt FROM malaria_cases');
  const currentCount = parseInt(existingCount?.cnt || '0', 10);

  const TARGET_CASE_COUNT = 50;

  if (currentCount >= TARGET_CASE_COUNT) {
    console.log('Already have ' + currentCount + ' malaria cases, skipping case seed');
  } else {
    console.log('Seeding ' + Math.max(0, TARGET_CASE_COUNT - currentCount) + ' realistic malaria cases...');
    const epiWeeks = [25, 26, 27, 28, 29, 30, 31, 32];
    const casesPerWeek = { 25: 3, 26: 4, 27: 5, 28: 6, 29: 8, 30: 9, 31: 7, 32: 4 };

    let inserted = 0;
    for (const week of epiWeeks) {
      const target = casesPerWeek[week];
      for (let i = 0; i < target; i++) {
        const facility = pick(facilities);
        const user = pick(users);
        const c = generateCase(week, facility.id, user?.id || adminId, facility.name);

        try {
          await run(
            `INSERT INTO malaria_cases (client_side_id, facility_id, reporting_region, zone, woreda,
              reporting_hf, kebele, house_no, mobile_phone, admission_type,
              patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
              fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
              specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
              outcome, ftat_done, referred_facility, source_of_infection, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)`,
            [c.client_side_id, c.facility_id, c.reporting_region, c.zone, c.woreda,
             c.reporting_hf, c.kebele, c.house_no, c.mobile_phone, c.admission_type,
             c.patient_name, c.sex, c.age, c.epi_week, c.age_category, c.date_of_onset, c.date_seen,
             c.fever, c.headache, c.joint_pain, c.chills_rigor, c.vomiting, c.back_pain, c.other_symptoms,
             c.specimen_taken, c.haemoparasite_spp, c.travel_history, c.travel_to_malaria_area,
             c.outcome, c.ftat_done, c.referred_facility, c.source_of_infection, c.created_by]
          );
          inserted++;
        } catch (err) {
          console.warn(`  Failed to insert case for week ${week}: ${err.message}`);
        }
      }
    }
    console.log(`Inserted ${inserted} realistic malaria cases`);
  }

  const auditCount = await queryOne('SELECT COUNT(*) as cnt FROM audit_logs');
  if (parseInt(auditCount?.cnt || '0', 10) < 5) {
    console.log('Seeding audit logs...');
    const auditActions = [
      { action: 'login', entity: 'user' },
      { action: 'create_case', entity: 'malaria_case' },
      { action: 'update_case', entity: 'malaria_case' },
      { action: 'export_report', entity: 'report' },
      { action: 'view_dashboard', entity: 'dashboard' },
    ];
    for (const a of auditActions) {
      await run(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
        [adminId, a.action, a.entity, 1, 'Seeded during database initialization']
      );
    }
    console.log('Audit logs seeded');
  } else {
    console.log(`Audit logs already present (${auditCount?.cnt})`);
  }

  const notifCount = await queryOne('SELECT COUNT(*) as cnt FROM notifications');
  if (parseInt(notifCount?.cnt || '0', 10) < 5) {
    console.log('Seeding notifications...');
    const allUsers = await queryAll('SELECT id FROM users ORDER BY id');
    const notificationTemplates = [
      { title: 'Weekly Report Available', message: 'The epi week 31 surveillance report is now available for review.', type: 'info' },
      { title: 'Data Import Complete', message: 'Bulk import of 25 case records has been completed successfully.', type: 'info' },
      { title: 'Threshold Alert: Case Increase', message: 'An increase in P. falciparum cases detected in Gurgura woreda. Please investigate.', type: 'threshold' },
      { title: 'Action Threshold: Death Spike', message: 'Multiple death cases reported this week. Immediate investigation required.', type: 'action_threshold' },
      { title: 'System Maintenance', message: 'Planned system maintenance on Sunday at 2:00 AM. The system will be unavailable for 1 hour.', type: 'info' },
    ];
    for (const notif of notificationTemplates) {
      for (const user of allUsers) {
        await run(
          'INSERT INTO notifications (user_id, title, message, type, is_read) VALUES ($1, $2, $3, $4, $5)',
          [user.id, notif.title, notif.message, notif.type, false]
        );
      }
    }
    console.log('Notifications seeded');
  } else {
    console.log(`Notifications already present (${notifCount?.cnt})`);
  }

  console.log('\nSeed complete!');
  console.log('   Login credentials (all passwords: admin123):');
  console.log('   admin      - System Administrator');
  console.log('   facility1  - Congo Meda Health Center');
  console.log('   facility2  - Abadir Health Center');
  console.log('   facility3  - Lange Health Center');
  console.log('   facility4  - Meskelegn Health Post');
  console.log('   facility5  - GtesFa Health Center');
  console.log('   district1  - District Admin (DDHC)');
  console.log('   zone1      - Zone Admin (Dire Dawa)');
  console.log('   region1    - Region Admin (Dire Dawa)');
}
