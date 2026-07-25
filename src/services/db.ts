import Dexie from 'dexie';

class MalariaDB extends Dexie {
  cases!: Dexie.Table<any, number>;

  constructor() {
    super('MalariaPWA');
    this.version(1).stores({
      cases: '++id, facility_id, sync_status, patient_name, date_seen, created_at',
    });
  }
}

const db = new MalariaDB();

export async function saveCaseOffline(caseData: any) {
  const id = await db.cases.add({
    ...caseData,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return id;
}

export async function getPendingCases() {
  return db.cases.where('sync_status').equals('pending').toArray();
}

export async function getPendingCount() {
  return db.cases.where('sync_status').equals('pending').count();
}

export async function markCaseSynced(id: number) {
  await db.cases.update(id, { sync_status: 'synced' });
}

export async function markCaseConflict(id: number) {
  await db.cases.update(id, { sync_status: 'conflict' });
}

export async function getAllOfflineCases() {
  return db.cases.toArray();
}

export async function deleteOfflineCase(id: number) {
  await db.cases.delete(id);
}

export async function syncPendingCases(apiFn: (data: any) => Promise<any>) {
  const pending = await getPendingCases();
  let synced = 0;
  let failed = 0;

  for (const c of pending) {
    try {
      const { id: _id, sync_status, ...payload } = c;
      await apiFn(payload);
      await markCaseSynced(c.id!);
      synced++;
    } catch (e) {
      failed++;
    }
  }

  return { synced, failed, remaining: pending.length - synced };
}

export default db;
