import jwt from 'jsonwebtoken';
import { queryOne } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'malaria-pwa-secret-key-change-in-production';

const ROLE_HIERARCHY = {
  facility_user: 0,
  facility_admin: 1,
  district_admin: 2,
  zone_admin: 3,
  region_admin: 4,
  system_admin: 5,
};

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await queryOne(
      'SELECT id, username, email, full_name, role, facility_id, region, zone, woreda, is_active FROM users WHERE id = $1 AND is_active = 1',
      [decoded.id]
    );
    if (!user) {
      return res.status(401).json({ error: 'User account is disabled' });
    }
    req.user = user;
    req.ip_address = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if ((ROLE_HIERARCHY[req.user.role] || 0) < ROLE_HIERARCHY[minRole]) {
      return res.status(403).json({ error: `Requires ${minRole} or higher role` });
    }
    next();
  };
}

export function buildDataScope(user) {
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
}

export function buildFacilityScope(user) {
  switch (user.role) {
    case 'system_admin':
      return { where: '', params: [] };
    case 'region_admin':
      return { where: ' WHERE region = $1', params: [user.region] };
    case 'zone_admin':
      return { where: ' WHERE zone = $1 AND region = $2', params: [user.zone, user.region] };
    case 'district_admin':
      return { where: ' WHERE woreda = $1 AND zone = $2 AND region = $3', params: [user.woreda, user.zone, user.region] };
    case 'facility_admin':
    case 'facility_user':
      return { where: ' WHERE id = $1', params: [user.facility_id] };
    default:
      return { where: ' WHERE 1=0', params: [] };
  }
}

export function canModifyCase(user, caseRecord) {
  if (user.role === 'system_admin' || user.role === 'region_admin') return true;
  if (user.role === 'zone_admin' && caseRecord.zone === user.zone) return true;
  if (user.role === 'district_admin' && caseRecord.woreda === user.woreda) return true;
  if ((user.role === 'facility_admin' || user.role === 'facility_user') && caseRecord.facility_id === user.facility_id) return true;
  return false;
}

export function canManageUsers(user) {
  return ['system_admin', 'region_admin', 'zone_admin', 'district_admin'].includes(user.role);
}

export function canManageFacilities(user) {
  return ['system_admin', 'region_admin', 'zone_admin', 'district_admin'].includes(user.role);
}

export { ROLE_HIERARCHY, JWT_SECRET };
