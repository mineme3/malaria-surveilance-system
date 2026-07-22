import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Filter, Download, Upload, Trash2, Edit, Eye, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import * as XLSX from 'xlsx';

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
  const [filters, setFilters] = useState({
    region: '', zone: '', woreda: '', date_from: '', date_to: '', sex: '', outcome: '',
  });
  const limit = 20;

  useEffect(() => {
    loadCases();
  }, [page, search, filters]);

  const loadCases = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: page.toString(), limit: limit.toString() };
      if (search) params.search = search;
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const data = await api.getCases(params);
      setCases(data.cases);
      setTotal(data.total);
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

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="page-title">Malaria Cases ({total})</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={16} /> Import
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} /> Export
          </button>
          <button onClick={() => navigate('/cases/new')} className="btn-primary flex items-center gap-2 text-sm">
            + New Case
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field pl-9"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary flex items-center gap-2 text-sm">
            <Filter size={16} /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4 pt-4 border-t">
            <div>
              <label className="label">Region</label>
              <input type="text" value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="label">Zone</label>
              <input type="text" value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="label">Woreda</label>
              <input type="text" value={filters.woreda} onChange={(e) => setFilters({ ...filters, woreda: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="label">From Date</label>
              <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="label">To Date</label>
              <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="label">Outcome</label>
              <select value={filters.outcome} onChange={(e) => setFilters({ ...filters, outcome: e.target.value })} className="select-field text-sm">
                <option value="">All</option>
                <option value="Alive">Alive</option>
                <option value="Death">Death</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Cases Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Sex</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Age</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Epi-Week</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Facility</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date Seen</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Species</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Outcome</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
              ) : cases.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">No cases found</td></tr>
              ) : cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.patient_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.sex === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>{c.sex}</span>
                  </td>
                  <td className="px-4 py-3">{c.age}</td>
                  <td className="px-4 py-3">{c.epi_week}</td>
                  <td className="px-4 py-3 text-gray-600">{c.facility_name || c.reporting_hf}</td>
                  <td className="px-4 py-3 text-gray-600">{c.date_seen}</td>
                  <td className="px-4 py-3">
                    {c.haemoparasite_spp && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">{c.haemoparasite_spp}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.outcome === 'Alive' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.outcome}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/cases/${c.id}`} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Eye size={15} /></Link>
                      <Link to={`/cases/edit/${c.id}`} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit size={15} /></Link>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded text-sm font-medium ${page === p ? 'bg-primary-600 text-white' : 'hover:bg-gray-100'}`}>{p}</button>
                );
              })}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Import Excel File</h3>
            <p className="text-sm text-gray-600 mb-4">Upload an Excel file with malaria case data. Column headers should match the standard format.</p>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4">
              <FileSpreadsheet size={40} className="mx-auto text-gray-400 mb-3" />
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
            </div>
            <button onClick={() => setShowImport(false)} className="btn-secondary w-full">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
