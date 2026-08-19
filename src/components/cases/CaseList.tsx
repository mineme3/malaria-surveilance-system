import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Filter, Download, Upload, Trash2, Edit, Eye, ChevronLeft, ChevronRight, FileSpreadsheet, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import * as XLSX from 'xlsx';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/table';

export default function CaseList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    region: '', zone: '', woreda: '', kebele: '', date_from: '', date_to: '',
    sex: '', outcome: '', age_category: '', admission_type: '', haemoparasite_spp: '', facility_id: '', epi_week: '',
  });
  const limit = 20;

  useEffect(() => {
    loadCases();
  }, [page, search]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1);
    loadCases();
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    api.getFacilities().then((data) => setFacilities(Array.isArray(data) ? data : data.facilities || [])).catch(() => {});
  }, []);

  const loadCases = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: page.toString(), limit: limit.toString() };
      if (search) params.search = search;
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const data = await api.getCases(params);
      setCases(data.cases || []);
      setTotal(data.total || 0);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = cases.map((c) => ({
      'Reporting Region': c.reporting_region,
      'Zone': c.zone,
      'Woreda': c.woreda,
      'Reporting HF': c.reporting_hf,
      'Kebele': c.kebele,
      'House No': c.house_no,
      'Mobile Phone': c.mobile_phone,
      'Admission Type': c.admission_type,
      'Patient Name': c.patient_name,
      'Sex': c.sex,
      'Age': c.age,
      'Epi-Week': c.epi_week,
      'Age Category': c.age_category,
      'Date of Onset': c.date_of_onset,
      'Date Seen': c.date_seen,
      'Fever': c.fever,
      'Headache': c.headache,
      'Joint Pain': c.joint_pain,
      'Chills & Rigor': c.chills_rigor,
      'Vomiting': c.vomiting,
      'Back Pain': c.back_pain,
      'Other S&S': c.other_symptoms,
      'Specimen Taken': c.specimen_taken,
      'Haemoparasite Spp': c.haemoparasite_spp,
      'Travel History': c.travel_history,
      'Travel to Malaria Area': c.travel_to_malaria_area,
      'Outcome': c.outcome,
      'FTAT Done': c.ftat_done,
      'Referred Facility': c.referred_facility,
      'Source of Infection': c.source_of_infection,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Malaria Cases');
    XLSX.writeFile(wb, `malaria_cases_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(ws);

    const mapped = jsonData.map((row: any) => ({
      patient_name: row['Patient Name'] || row['NaMe'] || row['patient_name'] || '',
      sex: row['Sex'] || row['Sex (M/F)'] || 'M',
      age: parseInt(row['Age'] || '0'),
      epi_week: parseInt(row['Epi-week'] || row['epi_week'] || '0'),
      age_category: row['Age category'] || '',
      date_of_onset: row['Date of onset'] || '',
      date_seen: row['Date seen'] || '',
      fever: row['Fever'] || 'No',
      headache: row['Headache'] || 'No',
      joint_pain: row['Joint Pain'] || 'No',
      chills_rigor: row['Chills & rigor'] || 'No',
      vomiting: row['Vomiting'] || 'No',
      back_pain: row['Back pain'] || 'No',
      other_symptoms: row['Other S&S'] || '',
      specimen_taken: row['Specimen taken'] || 'No',
      haemoparasite_spp: row['Haemoparasite spp'] || '',
      travel_history: row['Travel history'] || '',
      travel_to_malaria_area: row['Hx of travel'] || 'No',
      outcome: row['Outcome'] || 'Alive',
      ftat_done: row['FTAT done'] || 'No',
      referred_facility: row['Ref/Facility'] || '',
      source_of_infection: row['Source of Infection'] || '',
      admission_type: row['Admission'] || 'Out-Patient',
      reporting_region: row['Reporting Region'] || '',
      zone: row['Zone'] || '',
      woreda: row['Woreda'] || '',
      reporting_hf: row['Reporting HF'] || '',
      kebele: row['Kebele'] || '',
      house_no: row['House No'] || '',
      mobile_phone: row['Mobile Phone'] || '',
    }));

    try {
      await api.importCases(mapped);
      loadCases();
      setShowImport(false);
    } catch (err) {
      alert('Import failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this case?')) return;
    try {
      await api.deleteCase(id);
      loadCases();
    } catch (e) {}
  };

  const clearFilters = () => {
    setFilters({
      region: '', zone: '', woreda: '', kebele: '', date_from: '', date_to: '',
      sex: '', outcome: '', age_category: '', admission_type: '', haemoparasite_spp: '', facility_id: '', epi_week: '',
    });
    setSearch('');
    setPage(1);
  };

  const activeFilterCount = Object.values(filters).filter((v) => v !== '').length + (search ? 1 : 0);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Malaria Cases</h1>
          <p className="text-sm text-gray-500 mt-1">{total} case{total !== 1 ? 's' : ''} recorded</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-2">
            <Upload size={14} /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download size={14} /> Export
          </Button>
          <Button size="sm" onClick={() => navigate('/cases/new')} className="gap-2">
            + New Case
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by patient name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
              <Filter size={14} /> Filters {activeFilterCount > 0 && <Badge className="ml-1 px-1.5 py-0 text-[10px]">{activeFilterCount}</Badge>}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                <X size={14} /> Clear
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-4 pt-4 border-t border-gray-200">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Region</label>
                <Input type="text" value={filters.region} onChange={(e) => { setFilters({ ...filters, region: e.target.value }); setPage(1); }} className="text-sm" placeholder="Filter region" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Zone</label>
                <Input type="text" value={filters.zone} onChange={(e) => { setFilters({ ...filters, zone: e.target.value }); setPage(1); }} className="text-sm" placeholder="Filter zone" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Woreda</label>
                <Input type="text" value={filters.woreda} onChange={(e) => { setFilters({ ...filters, woreda: e.target.value }); setPage(1); }} className="text-sm" placeholder="Filter woreda" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Kebele</label>
                <Input type="text" value={filters.kebele} onChange={(e) => { setFilters({ ...filters, kebele: e.target.value }); setPage(1); }} className="text-sm" placeholder="Filter kebele" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">From Date</label>
                <Input type="date" value={filters.date_from} onChange={(e) => { setFilters({ ...filters, date_from: e.target.value }); setPage(1); }} className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">To Date</label>
                <Input type="date" value={filters.date_to} onChange={(e) => { setFilters({ ...filters, date_to: e.target.value }); setPage(1); }} className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Epi-Week</label>
                <Input type="number" value={filters.epi_week} onChange={(e) => { setFilters({ ...filters, epi_week: e.target.value }); setPage(1); }} className="text-sm" placeholder="Week #" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Sex</label>
                <select value={filters.sex} onChange={(e) => { setFilters({ ...filters, sex: e.target.value }); setPage(1); }} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500">
                  <option value="">All</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Age Category</label>
                <select value={filters.age_category} onChange={(e) => { setFilters({ ...filters, age_category: e.target.value }); setPage(1); }} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500">
                  <option value="">All</option>
                  <option value="Under 5">Under 5</option>
                  <option value="5-14">5-14</option>
                  <option value="15-49">15-49</option>
                  <option value="50+">50+</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Outcome</label>
                <select value={filters.outcome} onChange={(e) => { setFilters({ ...filters, outcome: e.target.value }); setPage(1); }} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500">
                  <option value="">All</option>
                  <option value="Alive">Alive</option>
                  <option value="Death">Death</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Admission</label>
                <select value={filters.admission_type} onChange={(e) => { setFilters({ ...filters, admission_type: e.target.value }); setPage(1); }} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500">
                  <option value="">All</option>
                  <option value="Out-Patient">Out-Patient</option>
                  <option value="In-Patient">In-Patient</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Species</label>
                <select value={filters.haemoparasite_spp} onChange={(e) => { setFilters({ ...filters, haemoparasite_spp: e.target.value }); setPage(1); }} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500">
                  <option value="">All</option>
                  <option value="P. falciparum">P. falciparum</option>
                  <option value="P. vivax">P. vivax</option>
                  <option value="P. ovale">P. ovale</option>
                  <option value="Mixed infection">Mixed infection</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Facility</label>
                <select value={filters.facility_id} onChange={(e) => { setFilters({ ...filters, facility_id: e.target.value }); setPage(1); }} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500">
                  <option value="">All</option>
                  {facilities.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Sex</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Epi-Week</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Kebele</TableHead>
              <TableHead>Date Seen</TableHead>
              <TableHead>Species</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-gray-500">Loading...</TableCell>
              </TableRow>
            ) : cases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-gray-500">No cases found</TableCell>
              </TableRow>
            ) : cases.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.patient_name}</TableCell>
                <TableCell>
                  <Badge variant={c.sex === 'M' ? 'default' : 'secondary'} className="rounded-full">
                    {c.sex}
                  </Badge>
                </TableCell>
                <TableCell>{c.age}</TableCell>
                <TableCell className="text-gray-600">{c.epi_week}</TableCell>
                <TableCell className="text-gray-600 max-w-[120px] truncate">{c.facility_name || c.reporting_hf}</TableCell>
                <TableCell className="text-gray-600 text-xs">{c.kebele}</TableCell>
                <TableCell className="text-gray-600">{c.date_seen}</TableCell>
                <TableCell>
                  {c.haemoparasite_spp && (
                    <Badge variant="warning" className="rounded-full">{c.haemoparasite_spp}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={c.outcome === 'Alive' ? 'success' : 'destructive'} className="rounded-full">
                    {c.outcome}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/cases/${c.id}`} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"><Eye size={15} /></Link>
                    <Link to={`/cases/edit/${c.id}`} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"><Edit size={15} /></Link>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors"><Trash2 size={15} /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{((page - 1) * limit) + 1}</span> to <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-medium">{total}</span> cases
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                <ChevronLeft size={16} />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1;
                return (
                  <Button
                    key={p}
                    variant={page === p ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setPage(p)}
                    className="w-8 h-8"
                  >
                    {p}
                  </Button>
                );
              })}
              <Button variant="outline" size="icon" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Import Excel File</h3>
              <button onClick={() => setShowImport(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Upload an Excel file with malaria case data. Column headers should match the standard format.</p>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4 hover:border-primary-300 transition-colors bg-gray-50/50">
              <FileSpreadsheet size={40} className="mx-auto text-gray-400 mb-3" />
              <p className="text-xs text-gray-500 mb-3">Supported formats: .xlsx, .xls, .csv</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImport}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 file:cursor-pointer cursor-pointer transition-colors"
              />
            </div>
            <Button variant="outline" onClick={() => setShowImport(false)} className="w-full">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
