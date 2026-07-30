import Dexie from 'dexie';

function generateClientId(): string {
  // Use crypto.randomUUID if available, fallback to timestamp + random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

class MalariaDB extends Dexie {
  cases!: Dexie.Table<any, number>;
  facilities!: Dexie.Table<any, number>;

  constructor() {
    super('MalariaPWA');
    this.version(1).stores({
      cases: '++id, facility_id, sync_status, patient_name, date_seen, created_at',
    });
    this.version(2).stores({
      cases: '++id, facility_id, sync_status, patient_name, date_seen, created_at',
      facilities: '++id, name, region, zone, woreda',
    });
  }
}

const db = new MalariaDB();

export async function saveCaseOffline(caseData: any) {
  const now = new Date().toISOString();
  const id = await db.cases.add({
    ...caseData,
    client_side_id: generateClientId(),
    sync_status: 'pending',
    created_at: caseData.created_at || now,
    updated_at: now,
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

export async function markCaseCreated(id: number, serverId: number) {
  await db.cases.update(id, { sync_status: 'synced', server_id: serverId });
}

export async function getAllOfflineCases() {
  return db.cases.toArray();
}

export async function deleteOfflineCase(id: number) {
  await db.cases.delete(id);
}

/**
 * Sync pending cases using the batch sync endpoint with conflict resolution.
 * Each case has a client_side_id UUID that the server uses to detect duplicates.
 * Last-write-wins: if the client version is newer, it overwrites the server.
 * If the server version is newer, the server version is kept.
 */
export async function syncPendingCases(apiFn: (data: any[]) => Promise<any>) {
  const pending = await getPendingCases();
  if (pending.length === 0) {
    return { synced: 0, failed: 0, remaining: 0, conflicts: 0 };
  }

  // Prepare payload: strip internal fields, keep client_side_id for dedup
  const payload = pending.map((c) => {
    const { id: _id, sync_status: _ss, server_id: _sid, ...data } = c;
    return data;
  });

  try {
    const result = await apiFn(payload);

    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    if (result.results && Array.isArray(result.results)) {
      for (let i = 0; i < result.results.length; i++) {
        const r = result.results[i];
        const localCase = pending[i];
        if (!localCase || !localCase.id) continue;

        if (r.status === 'created' || r.status === 'updated') {
          await markCaseCreated(localCase.id, r.server_id);
          synced++;
        } else if (r.status === 'conflict_server_wins') {
          await markCaseConflict(localCase.id);
          conflicts++;
        } else {
          failed++;
        }
      }
    }

    const remaining = await getPendingCount();
    return { synced, failed, remaining, conflicts };
  } catch (e) {
    return { synced: 0, failed: pending.length, remaining: pending.length, conflicts: 0 };
  }
}

/**
 * Cache facilities in IndexedDB so the case form works offline.
 * Replaces all existing cached facilities with the fresh list.
 */
export async function cacheFacilities(facilities: any[]) {
  await db.facilities.clear();
  await db.facilities.bulkAdd(facilities);
}

/**
 * Retrieve cached facilities from IndexedDB (offline fallback).
 */
export async function getCachedFacilities(): Promise<any[]> {
  return db.facilities.toArray();
}

export default db;
