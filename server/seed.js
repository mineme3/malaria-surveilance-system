import bcrypt from 'bcryptjs';
import sql from './db.js';

// ── Helper: generate a random integer between min and max (inclusive) ──
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ── Helper: pick a random element from an array ──
const pick = (arr) => arr[rand(0, arr.length - 1)];

// ── Realistic Ethiopian / Dire Dawa patient names ──
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

// ── Ethiopian location data for Dire Dawa ──
const kebeles = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
                 'Melka Jebdu', 'Adada', 'Belen', 'Kurfa', 'Bishan Bari'];
const zones = ['DD'];
const woredas = ['DDHC', 'Gurgura', 'Kasa'];

// ── Clinical data ──
const symptoms = ['Fever', 'Headache', 'Joint Pain', 'Chills/Rigor', 'Vomiting', 'Back Pain'];
const parasiteSpecies = ['P. falciparum', 'P. vivax', 'P. ovale', 'Mixed infection'];
const admissionTypes = ['Out-Patient', 'In-Patient'];
const outcomes = ['Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Alive', 'Referred', 'Dead'];
const yesNo = ['No', 'Yes'];

// ── Generate a realistic patient name ──
function generatePatientName() {
  const isMale = Math.random() > 0.5;
  const first = isMale ? pick(firstNamesM) : pick(firstNamesF);
  const last = pick(lastNames);
  return `${first} ${last}`;
}

// ── Generate a realistic Ethiopian phone number ──
function generatePhone() {
  const prefixes = ['91', '92', '93', '94', '95', '96', '97', '98', '99'];
  return '0' + pick(prefixes) + String(rand(1000000, 9999999));
}

// ── Counter for unique client_side_id values within a batch ──
let _caseIdCounter = 0;

// ── Generate a single realistic malaria case ──
function generateCase(epiWeek, facilityId, userId, facilityName) {
  _caseIdCounter++;
  const isMale = Math.random() > 0.5;
  const age = Math.random() < 0.15 ? rand(0, 4)           // 15% under 5
              : Math.random() < 0.35 ? rand(5, 14)         // 20% 5-14
              : Math.random() < 0.85 ? rand(15, 49)        // 50% 15-49
              : rand(50, 80);                               // 15% 50+
  const sex = isMale ? 'M' : 'F';
  const ageCategory = age <= 4 ? 'Under 5' : age <= 14 ? '5-14' : age <= 49 ? '15-49' : '50+';
  const hasFever = Math.random() < 0.92; // 92% present with fever
  const hasHeadache = Math.random() < 0.80;
  const hasJointPain = Math.random() < 0.65;
  const hasChills = Math.random() < 0.75;
  const hasVomiting = Math.random() < 0.30;
  const hasBackPain = Math.random() < 0.25;
  const hasTravel = Math.random() < 0.15;

  // Date: approximate date from epi week (week 1 = ~Jan 4, 2026 roughly)
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
    referred_facility: outcome === 'Referred' ? 'Dilchora Referral Hospital' : '',
    source_of_infection: pick(['Community acquired', 'Unknown', 'Travel related', 'Local transmission']),
    created_by: userId,
  };
}

// ── Main seed function ──
export async function seedDatabase() {
  // ── 1. Check if admin exists (skip if already seeded) ──
  const adminExists = await sql`SELECT id FROM users WHERE username = 'admin'`;

  if (adminExists.length === 0) {
    console.log('Running initial seed (admin user not found)...');
    const hash = bcrypt.hashSync('admin123', 10);

    // Seed admin user
    const [admin] = await sql`
      INSERT INTO users (username, email, password_hash, full_name, role, region, zone, woreda)
      VALUES ('admin', 'admin@malaria.gov', ${hash}, 'System Administrator', 'system_admin', 'DD', 'DD', 'DD')
      RETURNING id
    `;

    // Seed facilities
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
      const [rec] = await sql`
        INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
        VALUES (${f.name}, ${f.region}, ${f.zone}, ${f.woreda}, ${f.kebele}, ${f.type}, ${f.phone})
        RETURNING id
      `;
      facilityIds.push(rec.id);
      console.log(`  Facility created: ${f.name} (id=${rec.id})`);
    }

    // Seed additional realistic users
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
      await sql`
        INSERT INTO users (username, email, password_hash, full_name, role, facility_id, region, zone, woreda)
        VALUES (${u.username}, ${u.username}@malaria.gov, ${hash}, ${u.full_name}, ${u.role}, ${u.facility_id ?? null}, ${u.region}, ${u.zone}, ${u.woreda})
      `;
      console.log(`  User created: ${u.username} (${u.full_name})`);
    }

    console.log('Base seed data inserted successfully');
    console.log('  All passwords: admin123');
    console.log('  Admin: admin');
    console.log('  Facility Users: facility1, facility2, facility3, facility4, facility5');
    console.log('  District Admin: district1');
    console.log('  Zone Admin: zone1');
    console.log('  Region Admin: region1');
  } else {
    console.log('Admin user already exists, skipping base seed');
  }

  // ── 2. Seed realistic malaria cases (always runs) ──
  const facilities = await sql`SELECT id, name FROM facilities WHERE is_active = 1 ORDER BY id`;
  const users = await sql`SELECT id, username FROM users WHERE role = 'facility_user' ORDER BY id`;
  const adminUser = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  const adminId = adminUser[0]?.id || 1;

  const existingCount = await sql`SELECT COUNT(*) as cnt FROM malaria_cases`;
  const currentCount = parseInt(existingCount[0].cnt, 10);

  const TARGET_CASE_COUNT = 50;

  if (currentCount >= TARGET_CASE_COUNT) {
    console.log('Already have ' + currentCount + ' malaria cases, skipping case seed');
  } else {
    console.log('Seeding ' + Math.max(0, TARGET_CASE_COUNT - currentCount) + ' realistic malaria cases...');

    // EpI weeks 25-32 for 2026 (June through mid-August)
    const epiWeeks = [25, 26, 27, 28, 29, 30, 31, 32];

    // Case volume per week (simulating seasonal increase)
    const casesPerWeek = {
      25: 3, 26: 4, 27: 5, 28: 6,  // June: moderate
      29: 8, 30: 9, 31: 7, 32: 4,  // July: peak season
    };

    let inserted = 0;
    for (const week of epiWeeks) {
      const target = casesPerWeek[week];
      for (let i = 0; i < target; i++) {
        const facility = pick(facilities);
        const user = pick(users);
        const caseData = generateCase(week, facility.id, user?.id || adminId, facility.name);

        try {
          await sql`
            INSERT INTO malaria_cases (
              client_side_id, facility_id, reporting_region, zone, woreda,
              reporting_hf, kebele, house_no, mobile_phone, admission_type,
              patient_name, sex, age, epi_week, age_category, date_of_onset, date_seen,
              fever, headache, joint_pain, chills_rigor, vomiting, back_pain, other_symptoms,
              specimen_taken, haemoparasite_spp, travel_history, travel_to_malaria_area,
              outcome, ftat_done, referred_facility, source_of_infection, created_by
            ) VALUES (
              ${caseData.client_side_id}, ${caseData.facility_id},
              ${caseData.reporting_region}, ${caseData.zone}, ${caseData.woreda},
              ${caseData.reporting_hf}, ${caseData.kebele}, ${caseData.house_no},
              ${caseData.mobile_phone}, ${caseData.admission_type},
              ${caseData.patient_name}, ${caseData.sex}, ${caseData.age},
              ${caseData.epi_week}, ${caseData.age_category},
              ${caseData.date_of_onset}, ${caseData.date_seen},
              ${caseData.fever}, ${caseData.headache}, ${caseData.joint_pain},
              ${caseData.chills_rigor}, ${caseData.vomiting}, ${caseData.back_pain},
              ${caseData.other_symptoms},
              ${caseData.specimen_taken}, ${caseData.haemoparasite_spp},
              ${caseData.travel_history}, ${caseData.travel_to_malaria_area},
              ${caseData.outcome}, ${caseData.ftat_done},
              ${caseData.referred_facility},
              ${caseData.source_of_infection}, ${caseData.created_by}
            )
          `;
          inserted++;
        } catch (err) {
          console.warn(`  Failed to insert case for week ${week}: ${err.message}`);
        }
      }
    }
    console.log(`Inserted ${inserted} realistic malaria cases`);
  }

  // ── 3. Seed audit logs if empty ──
  const auditCount = await sql`SELECT COUNT(*) as cnt FROM audit_logs`;
  if (parseInt(auditCount[0].cnt, 10) < 5) {
    console.log('Seeding audit logs...');
    const auditActions = [
      { action: 'login', entity: 'user' },
      { action: 'create_case', entity: 'malaria_case' },
      { action: 'update_case', entity: 'malaria_case' },
      { action: 'export_report', entity: 'report' },
      { action: 'view_dashboard', entity: 'dashboard' },
    ];
    for (const a of auditActions) {
      await sql`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (${adminId}, ${a.action}, ${a.entity}, 1, 'Seeded during database initialization')
      `;
    }
    console.log('Audit logs seeded');
  } else {
    console.log(`Audit logs already present (${auditCount[0].cnt})`);
  }

  // ── 4. Seed notifications if empty ──
  const notifCount = await sql`SELECT COUNT(*) as cnt FROM notifications`;
  if (parseInt(notifCount[0].cnt, 10) < 5) {
    console.log('Seeding notifications...');
    const allUsers = await sql`SELECT id FROM users ORDER BY id`;
    const notificationTemplates = [
      { title: 'Weekly Report Available', message: 'The epi week 31 surveillance report is now available for review.', type: 'info' },
      { title: 'Data Import Complete', message: 'Bulk import of 25 case records has been completed successfully.', type: 'success' },
      { title: 'Unusual Case Pattern Detected', message: 'An increase in P. falciparum cases detected in Gurgura woreda. Please investigate.', type: 'warning' },
      { title: 'System Maintenance', message: 'Planned system maintenance on Sunday at 2:00 AM. The system will be unavailable for 1 hour.', type: 'info' },
    ];
    for (const notif of notificationTemplates) {
      for (const user of allUsers) {
        await sql`
          INSERT INTO notifications (user_id, title, message, type, is_read)
          VALUES (${user.id}, ${notif.title}, ${notif.message}, ${notif.type}, 0)
        `;
      }
    }
    console.log('Notifications seeded');
  } else {
    console.log(`Notifications already present (${notifCount[0].cnt})`);
  }

  console.log('\n✅ Seed complete!');
  console.log('   Login credentials (all passwords: admin123):');
  console.log('   ─────────────────────────────────────────────');
  console.log('   admin      – System Administrator');
  console.log('   facility1  – Congo Meda Health Center');
  console.log('   facility2  – Abadir Health Center');
  console.log('   facility3  – Lange Health Center');
  console.log('   facility4  – Meskelegn Health Post');
  console.log('   facility5  – GtesFa Health Center');
  console.log('   district1  – District Admin (DDHC)');
  console.log('   zone1      – Zone Admin (Dire Dawa)');
  console.log('   region1    – Region Admin (Dire Dawa)');
}
