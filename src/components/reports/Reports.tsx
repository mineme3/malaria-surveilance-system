import { useState } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../services/api';
import * as XLSX from 'xlsx';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Generate and export malaria surveillance reports</p>
      </div>

      {/* Report Generator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText size={16} className="text-primary-600" />
            Report Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Report Type</Label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500">
                {reportTypes.map((rt) => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={generateReport} disabled={loading} className="gap-2">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileText size={14} />}
                Generate
              </Button>
              {reportData && (
                <Button variant="outline" onClick={exportReport} className="gap-2">
                  <Download size={14} /> Export
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-0 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-blue-600 font-medium">Total Cases</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{reportData.data.total_cases?.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-0 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-red-600 font-medium">Deaths</p>
                <p className="text-3xl font-bold text-red-700 mt-1">{reportData.data.deaths?.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-0 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-green-600 font-medium">Facilities Reporting</p>
                <p className="text-3xl font-bold text-green-700 mt-1">{reportData.data.facilities_reporting?.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Report Info */}
          <Card className="bg-gray-50/50">
            <CardContent className="p-4 flex items-center gap-4 text-sm text-gray-600">
              <Calendar size={16} className="text-gray-400" />
              <span className="font-medium capitalize">{reportData.type} Report</span>
              <span className="text-gray-300">|</span>
              <span>Generated: {new Date(reportData.generated_at).toLocaleString()}</span>
              <span className="text-gray-300">|</span>
              <span>By: {reportData.generated_by}</span>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reportData.data.cases_by_region?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Cases by Region</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.data.cases_by_region}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {reportData.data.cases_by_age?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Cases by Age</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.data.cases_by_age}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {reportData.data.species_distribution?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Species Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={reportData.data.species_distribution} dataKey="count" nameKey="species" cx="50%" cy="50%" outerRadius={100} label>
                        {reportData.data.species_distribution.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {reportData.data.cases_by_sex?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Cases by Sex</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={reportData.data.cases_by_sex.map((s: any) => ({ name: s.sex === 'M' ? 'Male' : 'Female', value: s.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                        {reportData.data.cases_by_sex.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
