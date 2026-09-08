import { fileURLToPath } from 'url';
import path from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'malaria.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function convertPlaceholders(text) {
  return text.replace(/\$\d+/g, () => '?');
}

function run(text, params = []) {
  const converted = convertPlaceholders(text);
  const stmt = db.prepare(converted);
  const result = stmt.run(...params);
  return { rowCount: result.changes, rows: [] };
}

function runReturning(text, params = []) {
  const converted = convertPlaceholders(text);
  const stmt = db.prepare(converted);
  const result = stmt.run(...params);
  if (result.lastInsertRowid) {
    return { id: Number(result.lastInsertRowid) };
  }
  return null;
}

function query(text, params = []) {
  const converted = convertPlaceholders(text);
  const stmt = db.prepare(converted);
  return stmt.all(...params);
}

function queryOne(text, params = []) {
  const converted = convertPlaceholders(text);
  const stmt = db.prepare(converted);
  return stmt.get(...params) || null;
}

function queryAll(text, params = []) {
  return query(text, params);
}

export { query, queryOne, queryAll, run, runReturning };
export default db;