import { query, run } from './db.js';

const isPostgres = !!process.env.DATABASE_URL;

export async function initDatabase() {
  const SERIAL = isPostgres ? 'SERIAL' : 'INTEGER';
  const AUTOINCREMENT = isPostgres ? '' : 'AUTOINCREMENT';
  const BOOL_DEFAULT = isPostgres ? 'BOOLEAN DEFAULT true' : 'INTEGER DEFAULT 1';
  const BOOL_FALSE = isPostgres ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0';

  await run(`
    CREATE TABLE IF NOT EXISTS facilities (
      id ${SERIAL} PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      zone TEXT NOT NULL,
      woreda TEXT NOT NULL,
      kebele TEXT DEFAULT '',
      facility_type TEXT DEFAULT 'Health Center',
      phone TEXT DEFAULT '',
      is_active ${BOOL_DEFAULT},
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id ${SERIAL} PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'facility_user',
      facility_id INTEGER REFERENCES facilities(id),
      region TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      woreda TEXT DEFAULT '',
      is_active ${BOOL_DEFAULT},
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS malaria_cases (
      id ${SERIAL} PRIMARY KEY,
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

  if (!isPostgres) {
    try {
      await run(`ALTER TABLE malaria_cases ADD COLUMN client_side_id TEXT DEFAULT ''`);
    } catch (e) { }
  }

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id ${SERIAL} PRIMARY KEY,
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
      id ${SERIAL} PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read ${BOOL_FALSE},
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const idx = isPostgres
    ? `CREATE INDEX IF NOT EXISTS`
    : `CREATE INDEX IF NOT EXISTS`;

  await run(`${idx} idx_cases_client_id ON malaria_cases(client_side_id)`);
  await run(`${idx} idx_cases_facility ON malaria_cases(facility_id)`);
  await run(`${idx} idx_cases_date ON malaria_cases(date_seen)`);
  await run(`${idx} idx_cases_week ON malaria_cases(epi_week)`);
  await run(`${idx} idx_cases_region ON malaria_cases(reporting_region)`);
  await run(`${idx} idx_cases_zone ON malaria_cases(zone)`);
  await run(`${idx} idx_cases_woreda ON malaria_cases(woreda)`);
  await run(`${idx} idx_users_region ON users(region)`);
  await run(`${idx} idx_users_zone ON users(zone)`);
  await run(`${idx} idx_users_woreda ON users(woreda)`);
  await run(`${idx} idx_notifications_user ON notifications(user_id)`);

  console.log(`Database tables and indexes created successfully (${isPostgres ? 'PostgreSQL' : 'SQLite'})`);

  if (isPostgres) {
    const migrations = [
      [`users`, `is_active`],
      [`facilities`, `is_active`],
      [`notifications`, `is_read`],
    ];
    for (const [table, col] of migrations) {
      try {
        await run(`ALTER TABLE ${table} ALTER COLUMN ${col} TYPE BOOLEAN USING (CASE WHEN ${col}::text = '1' THEN true WHEN ${col}::text = '0' THEN false ELSE false END)`);
        await run(`ALTER TABLE ${table} ALTER COLUMN ${col} SET DEFAULT ${col === 'is_read' ? 'false' : 'true'}`);
      } catch (e) {
        console.log(`Migration ${table}.${col}: ${e.message}`);
      }
    }
  }
}
