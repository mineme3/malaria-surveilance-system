import { useState } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../services/api';
import * as XLSX from 'xlsx';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const reportTypes = [
  { value: 'daily', label: 'Daily Report' },
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'monthly', label: 'Monthly Report' },
  { value: 'quarterly', label: 'Quarterly Report' },
  { value: 'annual', label: 'Annual Report' },
];

export default function Reports() {
  const [reportType, setReportType] = useState('weekly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { type: reportType };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await api.getReport(params);
      setReportData(data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!reportData) return;
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summary = [
      { 'Report Type': reportData.type, 'Period Start': reportData.period_start, 'Period End': reportData.period_end },
      { 'Total Cases': reportData.data.total_cases, 'Deaths': reportData.data.deaths, 'Facilities': reportData.data.facilities_reporting },
    ];
    const ws1 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // By Region
    if (reportData.data.cases_by_region?.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(reportData.data.cases_by_region);
      XLSX.utils.book_append_sheet(wb, ws2, 'By Region');
    }

    // By Age
    if (reportData.data.cases_by_age?.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(reportData.data.cases_by_age);
      XLSX.utils.book_append_sheet(wb, ws3, 'By Age');
    }

    // By Species
    if (reportData.data.species_distribution?.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(reportData.data.species_distribution);
      XLSX.utils.book_append_sheet(wb, ws4, 'By Species');
    }

    XLSX.writeFile(wb, `${reportData.type}_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <h1 className="page-title">Reports</h1>

      {/* Report Generator */}
      <div className="card">
        <h3 className="section-title">Generate Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="select-field">
              {reportTypes.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={generateReport} disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileText size={16} />}
              Generate
            </button>
            {reportData && (
              <button onClick={exportReport} className="btn-secondary flex items-center gap-2">
                <Download size={16} /> Export
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Results */}
      {reportData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-blue-50 border-0">
              <p className="text-sm text-blue-600 font-medium">Total Cases</p>
              <p className="text-3xl font-bold text-blue-700">{reportData.data.total_cases?.toLocaleString()}</p>
            </div>
            <div className="card bg-red-50 border-0">
              <p className="text-sm text-red-600 font-medium">Deaths</p>
              <p className="text-3xl font-bold text-red-700">{reportData.data.deaths?.toLocaleString()}</p>
            </div>
            <div className="card bg-green-50 border-0">
              <p className="text-sm text-green-600 font-medium">Facilities Reporting</p>
              <p className="text-3xl font-bold text-green-700">{reportData.data.facilities_reporting?.toLocaleString()}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reportData.data.cases_by_region?.length > 0 && (
              <div className="card">
                <h3 className="section-title">Cases by Region</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.data.cases_by_region}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {reportData.data.cases_by_age?.length > 0 && (
              <div className="card">
                <h3 className="section-title">Cases by Age</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.data.cases_by_age}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {reportData.data.species_distribution?.length > 0 && (
              <div className="card">
                <h3 className="section-title">Species Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={reportData.data.species_distribution} dataKey="count" nameKey="species" cx="50%" cy="50%" outerRadius={100} label>
                      {reportData.data.species_distribution.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {reportData.data.cases_by_sex?.length > 0 && (
              <div className="card">
                <h3 className="section-title">Cases by Sex</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={reportData.data.cases_by_sex.map((s: any) => ({ name: s.sex === 'M' ? 'Male' : 'Female', value: s.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {reportData.data.cases_by_sex.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
