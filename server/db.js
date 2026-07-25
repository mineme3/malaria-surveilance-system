import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export async function query(text, params = []) {
  const result = await sql.query(text, params);
  return result;
}

export async function queryOne(text, params = []) {
  const result = await sql.query(text, params);
  return result[0] || null;
}

export async function queryAll(text, params = []) {
  const result = await sql.query(text, params);
  return result;
}

export async function run(text, params = []) {
  const result = await sql.query(text, params);
  return { rowCount: result.length, rows: result };
}

export async function runReturning(text, params = []) {
  const result = await sql.query(text, params);
  return result[0] || null;
}

export default sql;
