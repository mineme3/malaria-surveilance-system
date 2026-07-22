import { useState, useEffect } from 'react';
import { Activity, Users, TrendingUp, AlertTriangle, Building2, Skull, Calendar, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { api } from '../../services/api';
import type { DashboardStats } from '../../types';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

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
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-gray-500">Malaria Surveillance Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`card ${card.bg} border-0`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center`}>
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
            <BarChart data={stats.cases_by_region} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="region" type="category" width={100} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Age Distribution */}
        <div className="card">
          <h3 className="section-title">Cases by Age Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.cases_by_age}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sex Distribution */}
        <div className="card">
          <h3 className="section-title">Cases by Sex</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.cases_by_sex.map((s) => ({ name: s.sex === 'M' ? 'Male' : 'Female', value: s.count }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {stats.cases_by_sex.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Species Distribution */}
      {stats.species_distribution.length > 0 && (
        <div className="card">
          <h3 className="section-title">Species Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.species_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="species" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
