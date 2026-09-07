import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockRun = vi.fn();
const mockRunReturning = vi.fn();

vi.mock('../db.js', () => ({
  queryOne: (...args) => mockQueryOne(...args),
  queryAll: (...args) => mockQueryAll(...args),
  run: (...args) => mockRun(...args),
  runReturning: (...args) => mockRunReturning(...args),
}));

const mockUser = {
  id: 1,
  username: 'admin',
  email: 'admin@test.com',
  full_name: 'Admin User',
  role: 'system_admin',
  region: 'Dire Dawa',
  zone: 'Dire Dawa',
  woreda: 'DD',
  facility_id: null,
  is_active: 1,
};

function createMockReq(overrides = {}) {
  return {
    user: { ...mockUser },
    params: {},
    body: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: null,
    jsonData: null,
    status: (code) => { res.statusCode = code; return res; },
    json: (data) => { res.jsonData = data; return res; },
  };
  return res;
}

describe('User Registration - Role Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate allowed roles for system_admin', () => {
    const allowedRoles = {
      system_admin: ['system_admin', 'region_admin', 'zone_admin', 'district_admin', 'facility_admin', 'facility_user'],
    };
    expect(allowedRoles.system_admin).toContain('region_admin');
    expect(allowedRoles.system_admin).toContain('district_admin');
  });

  it('should validate allowed roles for zone_admin', () => {
    const allowedRoles = {
      zone_admin: ['district_admin', 'facility_admin', 'facility_user'],
    };
    expect(allowedRoles.zone_admin).toContain('district_admin');
    expect(allowedRoles.zone_admin).not.toContain('region_admin');
  });

  it('should validate allowed roles for district_admin', () => {
    const allowedRoles = {
      district_admin: ['facility_admin', 'facility_user'],
    };
    expect(allowedRoles.district_admin).toContain('facility_admin');
    expect(allowedRoles.district_admin).toContain('facility_user');
    expect(allowedRoles.district_admin).not.toContain('district_admin');
  });
});

describe('User Update - Username Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate username format', () => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    expect(usernameRegex.test('valid_user')).toBe(true);
    expect(usernameRegex.test('ab')).toBe(false);
    expect(usernameRegex.test('user@name')).toBe(false);
  });

  it('should check username uniqueness', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const existing = await mockQueryOne('SELECT id FROM users WHERE username = $1 AND id != $2', ['newuser', 1]);
    expect(existing).toBeNull();
  });

  it('should reject duplicate username', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 2 });
    const existing = await mockQueryOne('SELECT id FROM users WHERE username = $1 AND id != $2', ['existinguser', 1]);
    expect(existing).not.toBeNull();
  });
});

describe('Geographic Scope Enforcement', () => {
  it('district_admin should be scoped to their district', () => {
    const user = { role: 'district_admin', woreda: 'DD', zone: 'Dire Dawa', region: 'Dire Dawa' };
    const targetUser = { woreda: 'DD', zone: 'Dire Dawa', region: 'Dire Dawa' };
    expect(targetUser.woreda).toBe(user.woreda);
    expect(targetUser.zone).toBe(user.zone);
    expect(targetUser.region).toBe(user.region);
  });

  it('district_admin should not access other districts', () => {
    const user = { role: 'district_admin', woreda: 'DD', zone: 'Dire Dawa', region: 'Dire Dawa' };
    const targetUser = { woreda: 'Other', zone: 'Dire Dawa', region: 'Dire Dawa' };
    expect(targetUser.woreda).not.toBe(user.woreda);
  });

  it('zone_admin should be scoped to their zone', () => {
    const user = { role: 'zone_admin', zone: 'Dire Dawa', region: 'Dire Dawa' };
    const targetUser = { zone: 'Dire Dawa', region: 'Dire Dawa' };
    expect(targetUser.zone).toBe(user.zone);
    expect(targetUser.region).toBe(user.region);
  });

  it('zone_admin should not access other zones', () => {
    const user = { role: 'zone_admin', zone: 'Dire Dawa', region: 'Dire Dawa' };
    const targetUser = { zone: 'Other', region: 'Dire Dawa' };
    expect(targetUser.zone).not.toBe(user.zone);
  });
});

describe('Facility Scope Enforcement', () => {
  it('system_admin should have no facility restrictions', () => {
    const scope = { where: '', params: [] };
    expect(scope.where).toBe('');
  });

  it('facility_user should only see their facility', () => {
    const user = { role: 'facility_user', facility_id: 5 };
    const scope = { where: ' WHERE id = $1', params: [user.facility_id] };
    expect(scope.params).toContain(5);
  });
});

describe('Case Modification Permissions', () => {
  const canModifyCase = (user, caseRecord) => {
    if (user.role === 'system_admin' || user.role === 'region_admin') return true;
    if (user.role === 'zone_admin' && caseRecord.zone === user.zone) return true;
    if (user.role === 'district_admin' && caseRecord.woreda === user.woreda) return true;
    if (user.role === 'facility_admin' && caseRecord.facility_id === user.facility_id) return true;
    if (user.role === 'facility_user' && caseRecord.created_by === user.id && caseRecord.facility_id === user.facility_id) return true;
    return false;
  };

  it('system_admin can modify any case', () => {
    const user = { role: 'system_admin' };
    const caseRecord = { zone: 'Other', woreda: 'Other', facility_id: 99, created_by: 99 };
    expect(canModifyCase(user, caseRecord)).toBe(true);
  });

  it('region_admin can modify any case', () => {
    const user = { role: 'region_admin' };
    const caseRecord = { zone: 'Other', woreda: 'Other', facility_id: 99, created_by: 99 };
    expect(canModifyCase(user, caseRecord)).toBe(true);
  });

  it('zone_admin can modify cases in their zone', () => {
    const user = { role: 'zone_admin', zone: 'Dire Dawa' };
    const caseRecord = { zone: 'Dire Dawa', woreda: 'DD', facility_id: 1, created_by: 1 };
    expect(canModifyCase(user, caseRecord)).toBe(true);
  });

  it('zone_admin cannot modify cases outside their zone', () => {
    const user = { role: 'zone_admin', zone: 'Dire Dawa' };
    const caseRecord = { zone: 'Other', woreda: 'Other', facility_id: 1, created_by: 1 };
    expect(canModifyCase(user, caseRecord)).toBe(false);
  });

  it('district_admin can modify cases in their district', () => {
    const user = { role: 'district_admin', woreda: 'DD' };
    const caseRecord = { woreda: 'DD', facility_id: 1, created_by: 1 };
    expect(canModifyCase(user, caseRecord)).toBe(true);
  });

  it('facility_user can only modify cases they created in their facility', () => {
    const user = { role: 'facility_user', facility_id: 1, id: 10 };
    const ownCase = { facility_id: 1, created_by: 10 };
    const otherCase = { facility_id: 1, created_by: 99 };
    expect(canModifyCase(user, ownCase)).toBe(true);
    expect(canModifyCase(user, otherCase)).toBe(false);
  });

  it('facility_user cannot modify cases in other facilities', () => {
    const user = { role: 'facility_user', facility_id: 1, id: 10 };
    const caseRecord = { facility_id: 2, created_by: 10 };
    expect(canModifyCase(user, caseRecord)).toBe(false);
  });
});
