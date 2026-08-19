import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FilePlus, ClipboardList, Building2,
  BarChart3, Shield, Activity, Menu, X,
  LogOut, User, Send, ChevronRight, Database
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../ui/badge';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', minRole: 'facility_user' },
  { to: '/cases/new', icon: FilePlus, label: 'New Case Entry', minRole: 'facility_user' },
  { to: '/cases', icon: ClipboardList, label: 'Case List', minRole: 'facility_user' },
  { to: '/facilities', icon: Building2, label: 'Facilities', minRole: 'district_admin' },
  { to: '/reports', icon: BarChart3, label: 'Reports', minRole: 'facility_user' },
  { to: '/data-quality', icon: Activity, label: 'Data Quality', minRole: 'facility_user' },
  { to: '/audit', icon: Shield, label: 'Audit Log', minRole: 'system_admin' },
  { to: '/users', icon: User, label: 'User Management', minRole: 'system_admin' },
  { to: '/alerts', icon: Send, label: 'Send Alert', minRole: 'zone_admin' },
  { to: '/generate-data', icon: Database, label: 'Generate Data', minRole: 'system_admin' },
];

const ROLE_LEVELS: Record<string, number> = {
  facility_user: 0,
  facility_admin: 1,
  district_admin: 2,
  zone_admin: 3,
  region_admin: 4,
  system_admin: 5,
};

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  const filteredNav = navItems.filter((item) => {
    const userLevel = ROLE_LEVELS[user?.role || 'facility_user'] || 0;
    const requiredLevel = ROLE_LEVELS[item.minRole] || 0;
    return userLevel >= requiredLevel;
  });

  const roleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' => {
    switch (role) {
      case 'system_admin': return 'destructive';
      case 'region_admin': return 'warning';
      case 'zone_admin': return 'default';
      case 'district_admin': return 'default';
      case 'facility_admin': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-white rounded-xl shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} className="text-gray-700" />
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-all duration-300 ease-in-out lg:translate-x-0 shadow-lg lg:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-sm">
              <Activity className="text-white" size={22} />
            </div>
            <div>
              <h1 className="font-bold text-sm text-gray-900 leading-tight">Malaria SS</h1>
              <p className="text-[10px] text-gray-400 font-medium tracking-wide">Surveillance System</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-0.5 overflow-y-auto h-[calc(100%-152px)] scrollbar-thin">
          <p className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Main Menu</p>
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={`transition-colors ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight size={14} className={`transition-all ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-100 bg-gradient-to-t from-white via-white to-transparent">
          <div className="flex items-center gap-3 mb-2 px-1">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-100 to-primary-50 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
              <User size={16} className="text-primary-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user?.full_name}</p>
              <Badge variant={roleBadgeVariant(user?.role || 'facility_user')} className="mt-0.5 text-[10px] px-1.5 py-0 rounded-sm capitalize">
                {user?.role?.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-150 mt-1"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
