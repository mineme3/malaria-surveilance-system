import { query, run } from './db.js';

export async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS facilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      zone TEXT NOT NULL,
      woreda TEXT NOT NULL,
      kebele TEXT DEFAULT '',
      facility_type TEXT DEFAULT 'Health Center',
      phone TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'facility_user',
      facility_id INTEGER REFERENCES facilities(id),
      region TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      woreda TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS malaria_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_side_id TEXT UNIQUE DEFAULT '',
      facility_id INTEGER NOT NULL REFERENCES facilities(id),
      reporting_region TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      woreda TEXT DEFAULT '',
      reporting_hf TEXT DEFAULT '',
      kebele TEXT DEFAULT '',
      house_no TEXT DEFAULT '',
      mobile_phone TEXT DEFAULT '',
      admission_type TEXT DEFAULT 'Out-Patient',
      patient_name TEXT NOT NULL,
      sex TEXT NOT NULL,
      age INTEGER NOT NULL,
      epi_week INTEGER NOT NULL,
      age_category TEXT DEFAULT '',
      date_of_onset TEXT DEFAULT '',
      date_seen TEXT DEFAULT '',
      fever TEXT DEFAULT 'No',
      headache TEXT DEFAULT 'No',
      joint_pain TEXT DEFAULT 'No',
      chills_rigor TEXT DEFAULT 'No',
      vomiting TEXT DEFAULT 'No',
      back_pain TEXT DEFAULT 'No',
      other_symptoms TEXT DEFAULT '',
      specimen_taken TEXT DEFAULT 'No',
      haemoparasite_spp TEXT DEFAULT '',
      travel_history TEXT DEFAULT '',
      travel_to_malaria_area TEXT DEFAULT 'No',
      outcome TEXT DEFAULT 'Alive',
      ftat_done TEXT DEFAULT 'No',
      referred_facility TEXT DEFAULT '',
      source_of_infection TEXT DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT DEFAULT 'synced'
    )
  `);

  try {
    await run(`ALTER TABLE malaria_cases ADD COLUMN client_side_id TEXT DEFAULT ''`);
    await run(`CREATE INDEX IF NOT EXISTS idx_cases_client_id ON malaria_cases(client_side_id)`);
  } catch (e) { }

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_cases_facility ON malaria_cases(facility_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_cases_date ON malaria_cases(date_seen)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_cases_week ON malaria_cases(epi_week)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_cases_region ON malaria_cases(reporting_region)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_cases_zone ON malaria_cases(zone)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_cases_woreda ON malaria_cases(woreda)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_users_region ON users(region)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_users_zone ON users(zone)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_users_woreda ON users(woreda)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);

  console.log('Database tables and indexes created successfully');
}