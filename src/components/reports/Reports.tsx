import { useState, useRef } from 'react';
import { FileText, Download, Calendar, Share2, ChevronDown, MapPin, Home } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { api } from '../../services/api';
import * as XLSX from 'xlsx';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const reportTypes = [
  { value: 'daily', label: 'Daily Report' },
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'monthly', label: 'Monthly Report' },
  { value: 'quarterly', label: 'Quarterly Report' },
  { value: 'annual', label: 'Annual Report' },
];

function shareChart(shareType: 'telegram' | 'whatsapp' | 'email' | 'copy', chartTitle: string, data: any[]) {
  const text = `${chartTitle}\n\n${data.map((d: any) => `${d.region || d.category || d.species || d.week || d.kebele || d.mender || d.name || d.type}: ${d.count}`).join('\n')}`;
  const encoded = encodeURIComponent(text);
  const url = window.location.origin;

  switch (shareType) {
    case 'telegram':
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encoded}`, '_blank');
      break;
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encoded}%0A${encodeURIComponent(url)}`, '_blank');
      break;
    case 'email':
      window.open(`mailto:?subject=${encodeURIComponent(chartTitle)}&body=${encoded}%0A%0AView%20more%20at%20${encodeURIComponent(url)}`, '_blank');
      break;
    case 'copy':
      navigator.clipboard.writeText(`${text}\n\nView more at ${url}`);
      break;
  }
}

function ShareMenu({ title, data }: { title: string; data: any[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
        <Share2 size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
          <button onClick={() => { shareChart('telegram', title, data); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Telegram</button>
          <button onClick={() => { shareChart('whatsapp', title, data); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">WhatsApp</button>
          <button onClick={() => { shareChart('email', title, data); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Email</button>
          <button onClick={() => { shareChart('copy', title, data); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Copy to Clipboard</button>
        </div>
      )}
    </div>
  );
}

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

    // By Kebele
    if (reportData.data.cases_by_kebele?.length > 0) {
      const wsK = XLSX.utils.json_to_sheet(reportData.data.cases_by_kebele);
      XLSX.utils.book_append_sheet(wb, wsK, 'By Kebele');
    }

    // By Mender
    if (reportData.data.cases_by_mender?.length > 0) {
      const wsM = XLSX.utils.json_to_sheet(reportData.data.cases_by_mender);
      XLSX.utils.book_append_sheet(wb, wsM, 'By Mender');
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

    // Trend Data
    if (reportData.data.trend_data?.length > 0) {
      const ws5 = XLSX.utils.json_to_sheet(reportData.data.trend_data);
      XLSX.utils.book_append_sheet(wb, ws5, 'Trend Data');
    }

    XLSX.writeFile(wb, `${reportData.type}_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Generate and export malaria surveillance reports with trend analysis</p>
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

          {/* Trend Chart */}
          {reportData.data.trend_data?.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar size={16} className="text-primary-600" />
                  {reportType === 'weekly' ? 'Weekly' : reportType === 'monthly' ? 'Monthly' : 'Yearly'} Trend
                </CardTitle>
                <ShareMenu title={`${reportType} Trend - Malaria Cases`} data={reportData.data.trend_data} />
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.data.trend_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Cases" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reportData.data.cases_by_region?.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Cases by Region</CardTitle>
                  <ShareMenu title="Cases by Region" data={reportData.data.cases_by_region} />
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

            {reportData.data.cases_by_kebele?.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <MapPin size={16} className="text-primary-600" />
                    Cases by Kebele
                  </CardTitle>
                  <ShareMenu title="Cases by Kebele" data={reportData.data.cases_by_kebele} />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.data.cases_by_kebele}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="kebele" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {reportData.data.cases_by_mender?.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Home size={16} className="text-primary-600" />
                    Cases by Mender (House)
                  </CardTitle>
                  <ShareMenu title="Cases by Mender" data={reportData.data.cases_by_mender} />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.data.cases_by_mender.slice(0, 20)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mender" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {reportData.data.cases_by_age?.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Cases by Age</CardTitle>
                  <ShareMenu title="Cases by Age Category" data={reportData.data.cases_by_age} />
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
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Species Distribution</CardTitle>
                  <ShareMenu title="Species Distribution" data={reportData.data.species_distribution} />
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
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Cases by Sex</CardTitle>
                  <ShareMenu title="Cases by Sex" data={reportData.data.cases_by_sex.map((s: any) => ({ name: s.sex === 'M' ? 'Male' : 'Female', count: s.count }))} />
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

            {reportData.data.cases_by_woreda?.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Cases by Woreda</CardTitle>
                  <ShareMenu title="Cases by Woreda" data={reportData.data.cases_by_woreda} />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.data.cases_by_woreda}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="woreda" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {reportData.data.cases_by_facility?.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold">Cases by Facility</CardTitle>
                  <ShareMenu title="Cases by Facility" data={reportData.data.cases_by_facility} />
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.data.cases_by_facility} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="facility_name" type="category" width={150} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="count" fill="#ec4899" radius={[0, 4, 4, 0]} />
                    </BarChart>
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
