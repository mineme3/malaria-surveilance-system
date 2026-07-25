import { useState, useEffect } from 'react';
import { Activity, Users, TrendingUp, Skull, Building2, Calendar, BarChart3, MapPin, Stethoscope } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import type { DashboardStats } from '../../types';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const data = await api.getCaseStats();
      setStats(data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return <div className="text-center py-20 text-gray-500">Failed to load dashboard</div>;

  const scopeLabel = {
    system_admin: 'All Regions',
    region_admin: user?.region,
    zone_admin: `${user?.zone}, ${user?.region}`,
    district_admin: `${user?.woreda}, ${user?.zone}`,
    facility_admin: 'Your Facility',
    facility_user: 'Your Facility',
  }[user?.role || 'facility_user'] || '';

  const statCards = [
    { label: 'Total Cases', value: stats.total_cases, icon: Activity, color: 'bg-blue-500', bg: 'bg-blue-50' },
    { label: 'This Week', value: stats.cases_this_week, icon: Calendar, color: 'bg-green-500', bg: 'bg-green-50' },
    { label: 'This Month', value: stats.cases_this_month, icon: TrendingUp, color: 'bg-purple-500', bg: 'bg-purple-50' },
    { label: 'This Year', value: stats.cases_this_year, icon: BarChart3, color: 'bg-amber-500', bg: 'bg-amber-50' },
    { label: 'Deaths', value: stats.deaths, icon: Skull, color: 'bg-red-500', bg: 'bg-red-50' },
    { label: 'Facilities Reporting', value: stats.facilities_reporting, icon: Building2, color: 'bg-cyan-500', bg: 'bg-cyan-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {scopeLabel && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {scopeLabel}</span>}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`card ${card.bg} border-0`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <card.icon className="text-white" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
                <p className="text-xs text-gray-600">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cases by Week */}
        <div className="card">
          <h3 className="section-title">Cases by Epi-Week</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.cases_by_week}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cases by Region */}
        <div className="card">
          <h3 className="section-title">Cases by Region</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.cases_by_region}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="region" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cases by Woreda (top 10) */}
        {stats.cases_by_woreda?.length > 0 && (
          <div className="card">
            <h3 className="section-title flex items-center gap-2">
              <MapPin size={16} className="text-primary-600" />
              Top Woredas by Cases
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.cases_by_woreda} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="woreda" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Cases by Facility (top 10) */}
        {stats.cases_by_facility?.length > 0 && (
          <div className="card">
            <h3 className="section-title flex items-center gap-2">
              <Building2 size={16} className="text-primary-600" />
              Top Facilities by Cases
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.cases_by_facility} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="facility_name" type="category" width={150} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Age Distribution */}
        <div className="card">
          <h3 className="section-title flex items-center gap-2">
            <Users size={16} className="text-primary-600" />
            Cases by Age Category
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.cases_by_age}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sex Distribution */}
        <div className="card">
          <h3 className="section-title">Cases by Sex</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.cases_by_sex.map((s: any) => ({ name: s.sex === 'M' ? 'Male' : 'Female', value: s.count }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {stats.cases_by_sex.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Species Distribution */}
        {stats.species_distribution?.length > 0 && (
          <div className="card">
            <h3 className="section-title flex items-center gap-2">
              <Stethoscope size={16} className="text-primary-600" />
              Species Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.species_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="species" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Admission Type */}
        {stats.cases_by_admission?.length > 0 && (
          <div className="card">
            <h3 className="section-title">Admission Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.cases_by_admission.map((a: any) => ({ name: a.type, value: a.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {stats.cases_by_admission.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Trend */}
        {stats.recent_trend?.length > 0 && (
          <div className="card lg:col-span-2">
            <h3 className="section-title">Recent Daily Trend (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={[...stats.recent_trend].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
