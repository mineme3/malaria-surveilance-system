import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'malaria.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'facility_user',
    facility_id INTEGER,
    region TEXT DEFAULT '',
    zone TEXT DEFAULT '',
    woreda TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (facility_id) REFERENCES facilities(id)
  );

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
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS malaria_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    facility_id INTEGER NOT NULL,
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
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_status TEXT DEFAULT 'synced',
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_cases_facility ON malaria_cases(facility_id);
  CREATE INDEX IF NOT EXISTS idx_cases_date ON malaria_cases(date_seen);
  CREATE INDEX IF NOT EXISTS idx_cases_week ON malaria_cases(epi_week);
  CREATE INDEX IF NOT EXISTS idx_cases_region ON malaria_cases(reporting_region);
  CREATE INDEX IF NOT EXISTS idx_cases_zone ON malaria_cases(zone);
  CREATE INDEX IF NOT EXISTS idx_cases_woreda ON malaria_cases(woreda);
  CREATE INDEX IF NOT EXISTS idx_users_region ON users(region);
  CREATE INDEX IF NOT EXISTS idx_users_zone ON users(zone);
  CREATE INDEX IF NOT EXISTS idx_users_woreda ON users(woreda);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
`);

const hash = bcrypt.hashSync('admin123', 10);

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  db.prepare(`INSERT INTO users (username, email, password_hash, full_name, role, region, zone, woreda)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'admin', 'admin@malaria.gov', hash, 'System Administrator', 'system_admin', 'DD', 'DD', 'DD'
  );

  db.prepare(`INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'Congo Meda Health Center', 'DD', 'DD', 'DDHC', '3', 'Health Center', '965842088'
  );
  db.prepare(`INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'Abadir Health Center', 'DD', 'DD', 'DDHC', 'Djibuti', 'Health Center', '915150140'
  );
  db.prepare(`INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'Lange Health Center', 'DD', 'DD', 'DDHC', 'OroMia', 'Health Center', '969417128'
  );
  db.prepare(`INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'Meskelegn Health Post', 'DD', 'DD', 'DDHC', '2', 'Health Post', '937947475'
  );
  db.prepare(`INSERT INTO facilities (name, region, zone, woreda, kebele, facility_type, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'GtesFa Health Center', 'DD', 'DD', 'DDHC', '2', 'Health Center', '943282084'
  );

  db.prepare(`INSERT INTO users (username, email, password_hash, full_name, role, facility_id, region, zone, woreda)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'facility1', 'facility1@malaria.gov', hash, 'Facility User 1', 'facility_user', 1, 'DD', 'DD', 'DDHC'
  );
  db.prepare(`INSERT INTO users (username, email, password_hash, full_name, role, region, zone, woreda)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'district1', 'district1@malaria.gov', hash, 'District Admin 1', 'district_admin', 'DD', 'DD', 'DDHC'
  );
  db.prepare(`INSERT INTO users (username, email, password_hash, full_name, role, region, zone, woreda)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'zone1', 'zone1@malaria.gov', hash, 'Zone Admin 1', 'zone_admin', 'DD', 'DD', ''
  );
  db.prepare(`INSERT INTO users (username, email, password_hash, full_name, role, region, zone, woreda)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'region1', 'region1@malaria.gov', hash, 'Region Admin 1', 'region_admin', 'DD', '', ''
  );
}

export default db;
