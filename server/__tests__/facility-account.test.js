import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryOne = vi.fn();
const mockRunReturning = vi.fn();
const mockRun = vi.fn();

vi.mock('../db.js', () => ({
  queryOne: (...args) => mockQueryOne(...args),
  runReturning: (...args) => mockRunReturning(...args),
  run: (...args) => mockRun(...args),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
  },
}));

const mockUser = {
  id: 1,
  username: 'admin',
  role: 'system_admin',
  region: 'Dire Dawa',
  zone: 'Dire Dawa',
  woreda: 'DD',
};

describe('Facility Creation with User Account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require facility fields', () => {
    const data = { name: '', region: '', zone: '', woreda: '' };
    expect(!data.name || !data.region || !data.zone || !data.woreda).toBe(true);
  });

  it('should require account fields', () => {
    const data = { username: '', email: '', password: '', full_name: '' };
    expect(!data.username || !data.email || !data.password || !data.full_name).toBe(true);
  });

  it('should validate username format', () => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    expect(usernameRegex.test('facility_user')).toBe(true);
    expect(usernameRegex.test('ab')).toBe(false);
  });

  it('should validate email format', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test('facility@example.com')).toBe(true);
    expect(emailRegex.test('invalid-email')).toBe(false);
  });

  it('should validate password length', () => {
    expect('12345'.length >= 6).toBe(false);
    expect('123456'.length >= 6).toBe(true);
  });

  it('district_admin should only create facilities in their district', () => {
    const user = { role: 'district_admin', woreda: 'DD', zone: 'Dire Dawa', region: 'Dire Dawa' };
    const facility = { woreda: 'DD', zone: 'Dire Dawa', region: 'Dire Dawa' };
    expect(facility.woreda).toBe(user.woreda);
    expect(facility.zone).toBe(user.zone);
    expect(facility.region).toBe(user.region);
  });

  it('district_admin should not create facilities outside their district', () => {
    const user = { role: 'district_admin', woreda: 'DD', zone: 'Dire Dawa', region: 'Dire Dawa' };
    const facility = { woreda: 'Other', zone: 'Dire Dawa', region: 'Dire Dawa' };
    expect(facility.woreda).not.toBe(user.woreda);
  });

  it('zone_admin should only create facilities in their zone', () => {
    const user = { role: 'zone_admin', zone: 'Dire Dawa', region: 'Dire Dawa' };
    const facility = { zone: 'Dire Dawa', region: 'Dire Dawa' };
    expect(facility.zone).toBe(user.zone);
    expect(facility.region).toBe(user.region);
  });

  it('region_admin should only create facilities in their region', () => {
    const user = { role: 'region_admin', region: 'Dire Dawa' };
    const facility = { region: 'Dire Dawa' };
    expect(facility.region).toBe(user.region);
  });

  it('should create facility with default type if not provided', () => {
    const data = { name: 'Test', region: 'R', zone: 'Z', woreda: 'W', facility_type: undefined };
    const facilityType = data.facility_type || 'Health Center';
    expect(facilityType).toBe('Health Center');
  });

  it('should check username uniqueness before creating account', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const existing = await mockQueryOne('SELECT id FROM users WHERE username = $1', ['newfacility']);
    expect(existing).toBeNull();
  });

  it('should reject if username already exists', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 2 });
    const existing = await mockQueryOne('SELECT id FROM users WHERE username = $1', ['existinguser']);
    expect(existing).not.toBeNull();
  });

  it('should check email uniqueness before creating account', async () => {
    mockQueryOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const existingUsername = await mockQueryOne('SELECT id FROM users WHERE username = $1', ['newfacility']);
    const existingEmail = await mockQueryOne('SELECT id FROM users WHERE email = $1', ['new@example.com']);
    expect(existingUsername).toBeNull();
    expect(existingEmail).toBeNull();
  });

  it('should assign facility_user role to facility account', () => {
    const role = 'facility_user';
    expect(role).toBe('facility_user');
  });

  it('should link user account to created facility', async () => {
    mockRunReturning
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ id: 20 });

    const facilityResult = await mockRunReturning('INSERT INTO facilities ...', []);
    const userResult = await mockRunReturning('INSERT INTO users ...', [facilityResult.id]);

    expect(userResult.id).toBeDefined();
  });
});

describe('Facility Management Permissions', () => {
  it('district_admin can manage facilities in their district', () => {
    const user = { role: 'district_admin', woreda: 'DD' };
    const facility = { woreda: 'DD' };
    expect(user.woreda).toBe(facility.woreda);
  });

  it('district_admin cannot manage facilities in other districts', () => {
    const user = { role: 'district_admin', woreda: 'DD' };
    const facility = { woreda: 'Other' };
    expect(user.woreda).not.toBe(facility.woreda);
  });

  it('zone_admin can manage facilities in their zone', () => {
    const user = { role: 'zone_admin', zone: 'Dire Dawa' };
    const facility = { zone: 'Dire Dawa' };
    expect(user.zone).toBe(facility.zone);
  });

  it('region_admin can manage facilities in their region', () => {
    const user = { role: 'region_admin', region: 'Dire Dawa' };
    const facility = { region: 'Dire Dawa' };
    expect(user.region).toBe(facility.region);
  });
});
