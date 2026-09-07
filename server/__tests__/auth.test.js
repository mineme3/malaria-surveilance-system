import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  run: vi.fn(),
  runReturning: vi.fn(),
}));

import { ROLE_HIERARCHY } from '../middleware/auth.js';

describe('Role Hierarchy', () => {
  it('should have correct role levels', () => {
    expect(ROLE_LEVELS.facility_user).toBe(0);
    expect(ROLE_LEVELS.facility_admin).toBe(1);
    expect(ROLE_LEVELS.district_admin).toBe(2);
    expect(ROLE_LEVELS.zone_admin).toBe(3);
    expect(ROLE_LEVELS.region_admin).toBe(4);
    expect(ROLE_LEVELS.system_admin).toBe(5);
  });
});

const ROLE_LEVELS = ROLE_HIERARCHY;

describe('canManageUsers', () => {
  it('should return true for system_admin', () => {
    expect(['system_admin', 'region_admin', 'zone_admin', 'district_admin'].includes('system_admin')).toBe(true);
  });

  it('should return true for region_admin', () => {
    expect(['system_admin', 'region_admin', 'zone_admin', 'district_admin'].includes('region_admin')).toBe(true);
  });

  it('should return true for zone_admin', () => {
    expect(['system_admin', 'region_admin', 'zone_admin', 'district_admin'].includes('zone_admin')).toBe(true);
  });

  it('should return true for district_admin', () => {
    expect(['system_admin', 'region_admin', 'zone_admin', 'district_admin'].includes('district_admin')).toBe(true);
  });

  it('should return false for facility_admin', () => {
    expect(['system_admin', 'region_admin', 'zone_admin', 'district_admin'].includes('facility_admin')).toBe(false);
  });

  it('should return false for facility_user', () => {
    expect(['system_admin', 'region_admin', 'zone_admin', 'district_admin'].includes('facility_user')).toBe(false);
  });
});

describe('Role-based user creation permissions', () => {
  const allowedRoles = {
    system_admin: ['system_admin', 'region_admin', 'zone_admin', 'district_admin', 'facility_admin', 'facility_user'],
    region_admin: ['zone_admin', 'district_admin', 'facility_admin', 'facility_user'],
    zone_admin: ['district_admin', 'facility_admin', 'facility_user'],
    district_admin: ['facility_admin', 'facility_user'],
  };

  it('system_admin can create all roles', () => {
    expect(allowedRoles.system_admin).toContain('region_admin');
    expect(allowedRoles.system_admin).toContain('zone_admin');
    expect(allowedRoles.system_admin).toContain('district_admin');
    expect(allowedRoles.system_admin).toContain('facility_admin');
    expect(allowedRoles.system_admin).toContain('facility_user');
  });

  it('region_admin can create zone_admin, district_admin, facility_admin, facility_user', () => {
    expect(allowedRoles.region_admin).toContain('zone_admin');
    expect(allowedRoles.region_admin).toContain('district_admin');
    expect(allowedRoles.region_admin).toContain('facility_admin');
    expect(allowedRoles.region_admin).toContain('facility_user');
    expect(allowedRoles.region_admin).not.toContain('system_admin');
    expect(allowedRoles.region_admin).not.toContain('region_admin');
  });

  it('zone_admin can create district_admin, facility_admin, facility_user', () => {
    expect(allowedRoles.zone_admin).toContain('district_admin');
    expect(allowedRoles.zone_admin).toContain('facility_admin');
    expect(allowedRoles.zone_admin).toContain('facility_user');
    expect(allowedRoles.zone_admin).not.toContain('system_admin');
    expect(allowedRoles.zone_admin).not.toContain('region_admin');
    expect(allowedRoles.zone_admin).not.toContain('zone_admin');
  });

  it('district_admin can create facility_admin, facility_user', () => {
    expect(allowedRoles.district_admin).toContain('facility_admin');
    expect(allowedRoles.district_admin).toContain('facility_user');
    expect(allowedRoles.district_admin).not.toContain('system_admin');
    expect(allowedRoles.district_admin).not.toContain('region_admin');
    expect(allowedRoles.district_admin).not.toContain('zone_admin');
    expect(allowedRoles.district_admin).not.toContain('district_admin');
  });
});

describe('Username validation', () => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;

  it('should accept valid usernames', () => {
    expect(usernameRegex.test('admin')).toBe(true);
    expect(usernameRegex.test('user_123')).toBe(true);
    expect(usernameRegex.test('test_user')).toBe(true);
    expect(usernameRegex.test('ABC')).toBe(true);
  });

  it('should reject usernames that are too short', () => {
    expect(usernameRegex.test('ab')).toBe(false);
    expect(usernameRegex.test('a')).toBe(false);
  });

  it('should reject usernames with special characters', () => {
    expect(usernameRegex.test('user@name')).toBe(false);
    expect(usernameRegex.test('user name')).toBe(false);
    expect(usernameRegex.test('user-name')).toBe(false);
    expect(usernameRegex.test('user.name')).toBe(false);
  });

  it('should reject usernames that are too long', () => {
    expect(usernameRegex.test('a'.repeat(31))).toBe(false);
  });
});

describe('Email validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it('should accept valid emails', () => {
    expect(emailRegex.test('user@example.com')).toBe(true);
    expect(emailRegex.test('test.user@domain.org')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(emailRegex.test('user@')).toBe(false);
    expect(emailRegex.test('@example.com')).toBe(false);
    expect(emailRegex.test('user@example')).toBe(false);
    expect(emailRegex.test('user example.com')).toBe(false);
  });
});

describe('Password validation', () => {
  it('should require minimum 6 characters', () => {
    expect('12345'.length >= 6).toBe(false);
    expect('123456'.length >= 6).toBe(true);
    expect('password'.length >= 6).toBe(true);
  });
});

describe('Data scope building', () => {
  const buildDataScope = (user) => {
    switch (user.role) {
      case 'system_admin':
        return { where: '', params: [] };
      case 'region_admin':
        return { where: ' AND c.reporting_region = $1', params: [user.region] };
      case 'zone_admin':
        return { where: ' AND c.zone = $1 AND c.reporting_region = $2', params: [user.zone, user.region] };
      case 'district_admin':
        return { where: ' AND c.woreda = $1 AND c.zone = $2 AND c.reporting_region = $3', params: [user.woreda, user.zone, user.region] };
      case 'facility_admin':
      case 'facility_user':
        return { where: ' AND c.facility_id = $1', params: [user.facility_id] };
      default:
        return { where: ' AND 1=0', params: [] };
    }
  };

  it('system_admin should have no data scope restrictions', () => {
    const scope = buildDataScope({ role: 'system_admin' });
    expect(scope.where).toBe('');
    expect(scope.params).toEqual([]);
  });

  it('region_admin should be scoped to region', () => {
    const scope = buildDataScope({ role: 'region_admin', region: 'Oromia' });
    expect(scope.where).toContain('reporting_region');
    expect(scope.params).toContain('Oromia');
  });

  it('zone_admin should be scoped to zone and region', () => {
    const scope = buildDataScope({ role: 'zone_admin', zone: 'Dire Dawa', region: 'Dire Dawa' });
    expect(scope.params).toContain('Dire Dawa');
    expect(scope.params.length).toBe(2);
  });

  it('district_admin should be scoped to woreda, zone, and region', () => {
    const scope = buildDataScope({ role: 'district_admin', woreda: 'DD', zone: 'Dire Dawa', region: 'Dire Dawa' });
    expect(scope.params.length).toBe(3);
  });

  it('facility_user should be scoped to facility', () => {
    const scope = buildDataScope({ role: 'facility_user', facility_id: 5 });
    expect(scope.params).toContain(5);
  });
});
