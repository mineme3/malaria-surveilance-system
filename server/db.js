import { fileURLToPath } from 'url';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let sqliteDb = null;

if (DATABASE_URL) {
  // PostgreSQL mode
  const { Pool } = await import('pg');
  pool = new Pool({ connectionString: DATABASE_URL });
  console.log('Connected to PostgreSQL database');
} else {
  // SQLite mode (local development)
  const Database = (await import('better-sqlite3')).default;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dbPath = path.join(__dirname, 'malaria.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  console.log('Connected to SQLite database');
}

function convertPlaceholders(text) {
  return text.replace(/\$\d+/g, () => '?');
}

async function run(text, params = []) {
  if (pool) {
    await pool.query(text, params);
    return { rowCount: 0, rows: [] };
  } else {
    const converted = convertPlaceholders(text);
    const stmt = sqliteDb.prepare(converted);
    stmt.run(...params);
    return { rowCount: 0, rows: [] };
  }
}

async function runReturning(text, params = []) {
  if (pool) {
    const sql = /RETURNING/i.test(text) ? text : text + ' RETURNING id';
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  } else {
    const converted = convertPlaceholders(text);
    const stmt = sqliteDb.prepare(converted);
    const result = stmt.run(...params);
    if (result.lastInsertRowid) {
      return { id: Number(result.lastInsertRowid) };
    }
    return null;
  }
}

async function query(text, params = []) {
  if (pool) {
    const result = await pool.query(text, params);
    return result.rows;
  } else {
    const converted = convertPlaceholders(text);
    const stmt = sqliteDb.prepare(converted);
    return stmt.all(...params);
  }
}

async function queryOne(text, params = []) {
  if (pool) {
    const result = await pool.query(text, params);
    return result.rows[0] || null;
  } else {
    const converted = convertPlaceholders(text);
    const stmt = sqliteDb.prepare(converted);
    return stmt.get(...params) || null;
  }
}

async function queryAll(text, params = []) {
  return query(text, params);
}

export { query, queryOne, queryAll, run, runReturning };
export default pool || sqliteDb;

const isPostgres = !!pool;

export const BOOL_TRUE = isPostgres ? 'TRUE' : '1';
export const BOOL_FALSE = isPostgres ? 'FALSE' : '0';
export function boolParam(val) { return val ? (isPostgres ? true : 1) : (isPostgres ? false : 0); }

export const sql = {
  dateTruncMonth(col) {
    return isPostgres ? `to_char(${col}::date, 'YYYY-MM')` : `strftime('%Y-%m', ${col})`;
  },
  dateTruncYear(col) {
    return isPostgres ? `to_char(${col}::date, 'YYYY')` : `strftime('%Y', ${col})`;
  },
  dateTruncWeek(col) {
    return isPostgres ? `to_char(${col}::date, 'IYYY-IW')` : `strftime('%Y-%W', ${col})`;
  },
  now() {
    return isPostgres ? `to_char(NOW(), 'YYYY-MM-DD')` : `date('now')`;
  },
  nowMonth() {
    return isPostgres ? `to_char(NOW(), 'YYYY-MM')` : `strftime('%Y-%m', 'now')`;
  },
  nowYear() {
    return isPostgres ? `to_char(NOW(), 'YYYY')` : `strftime('%Y', 'now')`;
  },
  nowWeek() {
    return isPostgres ? `to_char(NOW(), 'IYYY-IW')` : `strftime('%Y-%W', 'now')`;
  },
};
