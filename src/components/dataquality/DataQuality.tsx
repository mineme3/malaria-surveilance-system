import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { api } from '../../services/api';

interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  count: number;
}

export default function DataQuality() {
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCases, setTotalCases] = useState(0);

  useEffect(() => { checkDataQuality(); }, []);

  const checkDataQuality = async () => {
    try {
      const { cases, total } = await api.getCases({ limit: '10000' });
      setTotalCases(total);
      const qIssues: QualityIssue[] = [];

      const missingName = cases.filter((c: any) => !c.patient_name).length;
      if (missingName > 0) qIssues.push({ type: 'error', message: 'Cases missing patient name', count: missingName });

      const missingAge = cases.filter((c: any) => !c.age && c.age !== 0).length;
      if (missingAge > 0) qIssues.push({ type: 'error', message: 'Cases missing age', count: missingAge });

      const missingDate = cases.filter((c: any) => !c.date_seen).length;
      if (missingDate > 0) qIssues.push({ type: 'error', message: 'Cases missing date seen', count: missingDate });

      const missingSex = cases.filter((c: any) => !c.sex).length;
      if (missingSex > 0) qIssues.push({ type: 'error', message: 'Cases missing sex', count: missingSex });

      const noSymptoms = cases.filter((c: any) => c.fever === 'No' && c.headache === 'No' && c.joint_pain === 'No' && c.chills_rigor === 'No' && c.vomiting === 'No' && c.back_pain === 'No' && !c.other_symptoms).length;
      if (noSymptoms > 0) qIssues.push({ type: 'warning', message: 'Cases with no symptoms recorded', count: noSymptoms });

      const noSpecies = cases.filter((c: any) => !c.haemoparasite_spp).length;
      if (noSpecies > 0) qIssues.push({ type: 'warning', message: 'Cases missing haemoparasite species', count: noSpecies });

      const noSpecimen = cases.filter((c: any) => c.specimen_taken === 'No').length;
      if (noSpecimen > 0) qIssues.push({ type: 'warning', message: 'Cases where specimen was not taken', count: noSpecimen });

      const duplicateNames = cases.reduce((acc: Record<string, number>, c: any) => { acc[c.patient_name] = (acc[c.patient_name] || 0) + 1; return acc; }, {});
      const duplicates = Object.entries(duplicateNames).filter(([_, count]) => (count as number) > 1);
      if (duplicates.length > 0) qIssues.push({ type: 'info', message: `${duplicates.length} potentially duplicate patient names`, count: duplicates.length });

      const completeness = total > 0 ? (((total - missingName - missingAge - missingDate) / (total * 3)) * 100).toFixed(1) : '100';
      qIssues.unshift({ type: 'info', message: `Overall data completeness: ${completeness}%`, count: 0 });

      setIssues(qIssues);
    } catch (e) {} finally { setLoading(false); }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle size={18} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={18} className="text-amber-500" />;
      default: return <Info size={18} className="text-blue-500" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-amber-50 border-amber-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div>
      <h1 className="page-title mb-6">Data Quality Monitor</h1>

      <div className="card mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
            <CheckCircle className="text-primary-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Cases Reviewed</p>
            <p className="text-2xl font-bold">{totalCases.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue, i) => (
            <div key={i} className={`flex items-center gap-4 p-4 rounded-lg border ${getBg(issue.type)}`}>
              {getIcon(issue.type)}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{issue.message}</p>
              </div>
              {issue.count > 0 && (
                <span className="px-3 py-1 bg-white rounded-full text-sm font-semibold shadow-sm">{issue.count}</span>
              )}
            </div>
          ))}
          {issues.length === 0 && (
            <div className="text-center py-12 text-gray-500">No data quality issues found</div>
          )}
        </div>
      )}
    </div>
  );
}
