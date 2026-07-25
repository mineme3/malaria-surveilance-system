import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FilePlus, ClipboardList, Building2,
  BarChart3, Shield, Activity, Menu, X,
  LogOut, User, AlertTriangle, Send
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <Activity className="text-white" size={20} />
            </div>
            <div>
              <h1 className="font-bold text-sm text-gray-900">Malaria SS</h1>
              <p className="text-[10px] text-gray-500">Surveillance System</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100%-140px)]">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-gray-50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <User size={16} className="text-primary-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
