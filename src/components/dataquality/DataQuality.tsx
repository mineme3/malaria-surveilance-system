import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, TrendingUp, BarChart3 } from 'lucide-react';
import { api } from '../../services/api';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  count: number;
  field?: string;
}

export default function DataQuality() {
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCases, setTotalCases] = useState(0);
  const [completenessScore, setCompletenessScore] = useState(0);
  const [stats, setStats] = useState({ total: 0, errors: 0, warnings: 0, infos: 0 });

  useEffect(() => { checkDataQuality(); }, []);

  const checkDataQuality = async () => {
    try {
      const { cases, total } = await api.getCases({ limit: '10000' });
      setTotalCases(total);
      const qIssues: QualityIssue[] = [];

      const requiredFields = [
        { field: 'patient_name', label: 'Patient Name' },
        { field: 'age', label: 'Age' },
        { field: 'sex', label: 'Sex' },
        { field: 'date_seen', label: 'Date Seen' },
        { field: 'facility_id', label: 'Facility' },
      ];

      let missingRequired = 0;
      for (const { field, label } of requiredFields) {
        const missing = cases.filter((c: any) => !c[field] && c[field] !== 0).length;
        if (missing > 0) {
          qIssues.push({ type: 'error', message: `Cases missing ${label}`, count: missing, field });
          missingRequired += missing;
        }
      }

      const missingEpiWeek = cases.filter((c: any) => !c.epi_week).length;
      if (missingEpiWeek > 0) {
        qIssues.push({ type: 'error', message: 'Cases missing Epi-Week', count: missingEpiWeek, field: 'epi_week' });
        missingRequired += missingEpiWeek;
      }

      const missingOnset = cases.filter((c: any) => !c.date_of_onset).length;
      if (missingOnset > 0) {
        qIssues.push({ type: 'warning', message: 'Cases missing Date of Onset', count: missingOnset, field: 'date_of_onset' });
      }

      const noSymptoms = cases.filter((c: any) =>
        c.fever === 'No' && c.headache === 'No' && c.joint_pain === 'No' &&
        c.chills_rigor === 'No' && c.vomiting === 'No' && c.back_pain === 'No' && !c.other_symptoms
      ).length;
      if (noSymptoms > 0) {
        qIssues.push({ type: 'warning', message: 'Cases with no symptoms recorded', count: noSymptoms, field: 'symptoms' });
      }

      const noSpecies = cases.filter((c: any) => !c.haemoparasite_spp).length;
      if (noSpecies > 0) {
        qIssues.push({ type: 'warning', message: 'Cases missing haemoparasite species', count: noSpecies, field: 'haemoparasite_spp' });
      }

      const noSpecimen = cases.filter((c: any) => c.specimen_taken === 'No').length;
      if (noSpecimen > 0) {
        qIssues.push({ type: 'warning', message: 'Cases where specimen was not taken', count: noSpecimen, field: 'specimen_taken' });
      }

      const noOutcome = cases.filter((c: any) => !c.outcome).length;
      if (noOutcome > 0) {
        qIssues.push({ type: 'warning', message: 'Cases missing outcome', count: noOutcome, field: 'outcome' });
      }

      const duplicateNames = cases.reduce((acc: Record<string, number>, c: any) => {
        acc[c.patient_name] = (acc[c.patient_name] || 0) + 1;
        return acc;
      }, {});
      const duplicates = Object.entries(duplicateNames).filter(([_, count]) => (count as number) > 1);
      if (duplicates.length > 0) {
        qIssues.push({ type: 'info', message: `${duplicates.length} potentially duplicate patient names`, count: duplicates.length });
      }

      const futureDates = cases.filter((c: any) => {
        if (!c.date_seen) return false;
        return new Date(c.date_seen) > new Date();
      }).length;
      if (futureDates > 0) {
        qIssues.push({ type: 'warning', message: 'Cases with future dates', count: futureDates, field: 'date_seen' });
      }

      const totalFields = total * 8;
      const filledFields = totalFields - missingRequired;
      const completeness = total > 0 ? ((filledFields / totalFields) * 100).toFixed(1) : '100';
      setCompletenessScore(parseFloat(completeness));

      qIssues.unshift({
        type: 'info',
        message: `Overall data completeness: ${completeness}% (${filledFields}/${totalFields} required fields filled)`,
        count: 0,
      });

      setIssues(qIssues);
      setStats({
        total: qIssues.length - 1,
        errors: qIssues.filter((i) => i.type === 'error').length,
        warnings: qIssues.filter((i) => i.type === 'warning').length,
        infos: qIssues.filter((i) => i.type === 'info').length - 1,
      });
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
      case 'error': return 'border-l-4 border-l-red-500 bg-red-50 border-red-200';
      case 'warning': return 'border-l-4 border-l-amber-500 bg-amber-50 border-amber-200';
      default: return 'border-l-4 border-l-blue-500 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Data Quality Monitor</h1>
        <p className="text-sm text-gray-500 mt-1">Validate and monitor malaria case data completeness and consistency</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center shadow-sm">
              <CheckCircle className="text-primary-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cases</p>
              <p className="text-2xl font-bold text-gray-900">{totalCases.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shadow-sm">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Completeness</p>
              <p className="text-2xl font-bold text-gray-900">{completenessScore}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shadow-sm">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Errors</p>
              <p className="text-2xl font-bold text-gray-900">{stats.errors}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shadow-sm">
              <BarChart3 className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Warnings</p>
              <p className="text-2xl font-bold text-gray-900">{stats.warnings}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue, i) => (
            <div key={i} className={`flex items-center gap-4 p-4 rounded-lg border ${getBg(issue.type)}`}>
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                {getIcon(issue.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{issue.message}</p>
                {issue.field && (
                  <p className="text-xs text-gray-500 mt-0.5">Field: <code className="bg-gray-200/50 px-1 rounded">{issue.field}</code></p>
                )}
              </div>
              {issue.count > 0 && (
                <Badge variant="secondary" className="rounded-full text-sm px-3 py-1">
                  {issue.count}
                </Badge>
              )}
            </div>
          ))}
          {issues.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle size={32} className="mx-auto text-green-500 mb-3" />
                <p className="text-gray-500 font-medium">No data quality issues found</p>
                <p className="text-xs text-gray-400 mt-1">All cases have complete and valid data</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
