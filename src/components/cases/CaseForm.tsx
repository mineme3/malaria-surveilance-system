import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, CheckCircle, WifiOff, Cloud, AlertCircle, MapPin, User, Calendar, Stethoscope, TestTube, Plane, Heart } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { saveCaseOffline, getPendingCount, syncPendingCases, cacheFacilities, getCachedFacilities } from '../../services/db';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

function getAgeCategory(age: number): string {
  if (age < 1) return '<1';
  if (age <= 4) return '1-4';
  if (age <= 14) return '5-14';
  if (age <= 24) return '15-24';
  if (age <= 44) return '25-44';
  if (age <= 64) return '55-64';
  return '65+';
}

function getCurrentEpiWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 604800000;
  return Math.ceil(diff / oneWeek);
}

const initialFormData = {
  reporting_region: '',
  zone: '',
  woreda: '',
  reporting_hf: '',
  kebele: '',
  house_no: '',
  mobile_phone: '',
  admission_type: 'Out-Patient',
  patient_name: '',
  sex: 'M',
  age: '',
  epi_week: getCurrentEpiWeek().toString(),
  age_category: '',
  date_of_onset: '',
  date_seen: new Date().toISOString().split('T')[0],
  fever: 'No',
  headache: 'No',
  joint_pain: 'No',
  chills_rigor: 'No',
  vomiting: 'No',
  back_pain: 'No',
  other_symptoms: '',
  specimen_taken: 'No',
  haemoparasite_spp: '',
  travel_history: '',
  travel_to_malaria_area: 'No',
  outcome: 'Alive',
  ftat_done: 'No',
  referred_facility: '',
  source_of_infection: '',
  facility_id: '',
};

export default function CaseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [savedOffline, setSavedOffline] = useState(false);

  useEffect(() => {
    loadFacilities();
    if (id) loadCase();
    updatePendingCount();
  }, [id]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      autoSyncPending();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (formData.age) {
      setFormData((prev) => ({
        ...prev,
        age_category: getAgeCategory(parseInt(prev.age) || 0),
      }));
    }
  }, [formData.age]);

  const updatePendingCount = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  };

  const autoSyncPending = useCallback(async () => {
    try {
      const result = await syncPendingCases((data) => api.syncCases(data));
      if (result.synced > 0 || result.conflicts > 0) {
        setPendingCount(result.remaining);
        window.dispatchEvent(new CustomEvent('sync-complete', { detail: result }));
      }
    } catch (e) {}
  }, []);

  const loadFacilities = async () => {
    try {
      const data = await api.getFacilities();
      setFacilities(data);
      // Cache facilities for offline use
      cacheFacilities(data).catch(() => {});
      if (!id && user?.facility_id) {
        setFormData((prev) => ({ ...prev, facility_id: user.facility_id!.toString() }));
        const fac = data.find((f: any) => f.id === user.facility_id);
        if (fac) {
          setFormData((prev) => ({
            ...prev,
            facility_id: fac.id.toString(),
            reporting_region: fac.region,
            zone: fac.zone,
            woreda: fac.woreda,
            reporting_hf: fac.name,
            kebele: fac.kebele,
          }));
        }
      }
    } catch (e) {
      // API failed — try loading from IndexedDB cache
      try {
        const cached = await getCachedFacilities();
        if (cached.length > 0) {
          setFacilities(cached);
        }
      } catch (cacheErr) {}
    }
  };

  const loadCase = async () => {
    setLoading(true);
    try {
      const c = await api.getCase(parseInt(id!));
      setFormData({
        reporting_region: c.reporting_region || '',
        zone: c.zone || '',
        woreda: c.woreda || '',
        reporting_hf: c.reporting_hf || '',
        kebele: c.kebele || '',
        house_no: c.house_no || '',
        mobile_phone: c.mobile_phone || '',
        admission_type: c.admission_type || 'Out-Patient',
        patient_name: c.patient_name || '',
        sex: c.sex || 'M',
        age: c.age?.toString() || '',
        epi_week: c.epi_week?.toString() || getCurrentEpiWeek().toString(),
        age_category: c.age_category || '',
        date_of_onset: c.date_of_onset || '',
        date_seen: c.date_seen || '',
        fever: c.fever || 'No',
        headache: c.headache || 'No',
        joint_pain: c.joint_pain || 'No',
        chills_rigor: c.chills_rigor || 'No',
        vomiting: c.vomiting || 'No',
        back_pain: c.back_pain || 'No',
        other_symptoms: c.other_symptoms || '',
        specimen_taken: c.specimen_taken || 'No',
        haemoparasite_spp: c.haemoparasite_spp || '',
        travel_history: c.travel_history || '',
        travel_to_malaria_area: c.travel_to_malaria_area || 'No',
        outcome: c.outcome || 'Alive',
        ftat_done: c.ftat_done || 'No',
        referred_facility: c.referred_facility || '',
        source_of_infection: c.source_of_infection || '',
        facility_id: c.facility_id?.toString() || '',
      });
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleFacilityChange = (facilityId: string) => {
    const fac = facilities.find((f) => f.id === parseInt(facilityId));
    if (fac) {
      setFormData((prev) => ({
        ...prev,
        facility_id: facilityId,
        reporting_region: fac.region,
        zone: fac.zone,
        woreda: fac.woreda,
        reporting_hf: fac.name,
        kebele: fac.kebele,
      }));
    } else {
      handleChange('facility_id', facilityId);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.patient_name.trim()) newErrors.patient_name = 'Patient name is required';
    if (!formData.age || parseInt(formData.age) < 0) newErrors.age = 'Valid age is required';
    if (!formData.sex) newErrors.sex = 'Sex is required';
    if (!formData.facility_id) newErrors.facility_id = 'Facility is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setSavedOffline(false);
    try {
      const payload = {
        ...formData,
        age: parseInt(formData.age) || 0,
        epi_week: parseInt(formData.epi_week) || getCurrentEpiWeek(),
        facility_id: parseInt(formData.facility_id) || user?.facility_id,
      };

      if (id) {
        await api.updateCase(parseInt(id), payload);
      } else {
        if (navigator.onLine) {
          await api.createCase(payload);
        } else {
          await saveCaseOffline({ ...payload, created_by: user?.id || 0 });
          setSavedOffline(true);
          setPendingCount((prev) => prev + 1);
        }
      }
      setSuccess(true);
      setTimeout(() => navigate('/cases'), 1500);
    } catch (err: any) {
      // Check if this is a network error (server unreachable) vs a validation error
      // navigator.onLine is unreliable — it's true when the browser has internet
      // even if the backend server is down. We detect network errors by checking
      // the error type/message.
      const isNetworkError = err instanceof TypeError ||
        (err.message && (
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message.includes('Network request failed')
        ));

      if (isNetworkError) {
        // Server unreachable — save offline
        try {
          const payload = {
            ...formData,
            age: parseInt(formData.age) || 0,
            epi_week: parseInt(formData.epi_week) || getCurrentEpiWeek(),
            facility_id: parseInt(formData.facility_id) || user?.facility_id,
          };
          await saveCaseOffline({ ...payload, created_by: user?.id || 0 });
          setSavedOffline(true);
          setPendingCount((prev) => prev + 1);
          setSuccess(true);
          setTimeout(() => navigate('/cases'), 1500);
        } catch (offlineErr: any) {
          setErrors({ submit: 'Failed to save case offline' });
        }
      } else {
        // Server returned an error (validation, auth, etc.) — show the message
        setErrors({ submit: err.message || 'Failed to save' });
      }
    } finally {
      setSaving(false);
    }
  };

  const YesNoField = ({ label, field }: { label: string; field: string }) => (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-4 mt-1.5">
        {['Yes', 'No'].map((opt) => (
          <label key={opt} className="relative flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name={field}
              value={opt}
              checked={formData[field as keyof typeof formData] === opt}
              onChange={(e) => handleChange(field, e.target.value)}
              className="peer sr-only"
            />
            <span className="block px-4 py-1.5 text-sm rounded-lg border border-gray-300 peer-checked:bg-primary-600 peer-checked:text-white peer-checked:border-primary-600 peer-checked:shadow-sm hover:border-gray-400 transition-all">
              {opt}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cases')} className="flex-shrink-0">
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{id ? 'Edit Case' : 'New Malaria Case Entry'}</h1>
        <div className="ml-auto flex items-center gap-2">
          {!isOnline && (
            <Badge variant="warning" className="gap-1.5">
              <WifiOff size={12} />
              Offline Mode
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="default" className="gap-1.5">
              <Cloud size={12} />
              {pendingCount} pending sync
            </Badge>
          )}
        </div>
      </div>

      {success && (
        <div className={`mb-6 p-4 border rounded-xl flex items-center gap-3 shadow-sm ${savedOffline ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          {savedOffline ? (
            <>
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <WifiOff className="text-amber-600" size={20} />
              </div>
              <span className="text-amber-800 font-medium text-sm">Case saved offline. It will sync automatically when you&apos;re back online.</span>
            </>
          ) : (
            <>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="text-green-600" size={20} />
              </div>
              <div>
                <span className="text-green-800 font-medium text-sm">Case saved successfully!</span>
                <p className="text-green-700 text-xs mt-0.5">Redirecting to case list...</p>
              </div>
            </>
          )}
        </div>
      )}

      {errors.submit && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={18} />
          <span className="text-red-700 text-sm">{errors.submit}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Location Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin size={16} className="text-primary-600" />
              Location Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Facility <span className="text-red-500">*</span></Label>
                <select value={formData.facility_id} onChange={(e) => handleFacilityChange(e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="">Select Facility</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {errors.facility_id && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.facility_id}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Reporting Region</Label>
                <Input type="text" value={formData.reporting_region} onChange={(e) => handleChange('reporting_region', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Zone</Label>
                <Input type="text" value={formData.zone} onChange={(e) => handleChange('zone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Woreda</Label>
                <Input type="text" value={formData.woreda} onChange={(e) => handleChange('woreda', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Reporting HF</Label>
                <Input type="text" value={formData.reporting_hf} onChange={(e) => handleChange('reporting_hf', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Kebele</Label>
                <Input type="text" value={formData.kebele} onChange={(e) => handleChange('kebele', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>House No</Label>
                <Input type="text" value={formData.house_no} onChange={(e) => handleChange('house_no', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile Phone</Label>
                <Input type="tel" value={formData.mobile_phone} onChange={(e) => handleChange('mobile_phone', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User size={16} className="text-primary-600" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label>Patient Name <span className="text-red-500">*</span></Label>
                <Input type="text" value={formData.patient_name} onChange={(e) => handleChange('patient_name', e.target.value)} placeholder="Full name" />
                {errors.patient_name && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.patient_name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Admission Type</Label>
                <select value={formData.admission_type} onChange={(e) => handleChange('admission_type', e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="Out-Patient">Out-Patient</option>
                  <option value="In-Patient">In-Patient</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Sex <span className="text-red-500">*</span></Label>
                <select value={formData.sex} onChange={(e) => handleChange('sex', e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                </select>
                {errors.sex && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.sex}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Age <span className="text-red-500">*</span></Label>
                <Input type="number" min={0} max={150} value={formData.age} onChange={(e) => handleChange('age', e.target.value)} placeholder="Years" />
                {errors.age && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.age}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Age Category</Label>
                <Input type="text" value={formData.age_category} readOnly className="bg-gray-50 text-gray-500" />
              </div>
              <div className="space-y-1.5">
                <Label>Epi-Week</Label>
                <Input type="number" min={1} max={53} value={formData.epi_week} onChange={(e) => handleChange('epi_week', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar size={16} className="text-primary-600" />
              Clinical Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date of Onset</Label>
                <Input type="date" value={formData.date_of_onset} onChange={(e) => handleChange('date_of_onset', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date Seen at Facility</Label>
                <Input type="date" value={formData.date_seen} onChange={(e) => handleChange('date_seen', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Symptoms */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Stethoscope size={16} className="text-primary-600" />
              Signs &amp; Symptoms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <YesNoField label="Fever" field="fever" />
              <YesNoField label="Headache" field="headache" />
              <YesNoField label="Joint Pain" field="joint_pain" />
              <YesNoField label="Chills & Rigor" field="chills_rigor" />
              <YesNoField label="Vomiting" field="vomiting" />
              <YesNoField label="Back Pain" field="back_pain" />
              <div className="md:col-span-3 space-y-1.5">
                <Label>Other Symptoms &amp; Signs</Label>
                <Input type="text" value={formData.other_symptoms} onChange={(e) => handleChange('other_symptoms', e.target.value)} placeholder="Describe any other symptoms" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lab & Diagnosis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TestTube size={16} className="text-primary-600" />
              Laboratory &amp; Diagnosis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <YesNoField label="Specimen Taken (RDT/BF/WBC)" field="specimen_taken" />
              <div className="space-y-1.5">
                <Label>Haemoparasite Species</Label>
                <select value={formData.haemoparasite_spp} onChange={(e) => handleChange('haemoparasite_spp', e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="">Select Species</option>
                  <option value="PF">P.F (Plasmodium Falciparum)</option>
                  <option value="PV">P.V (Plasmodium Vivax)</option>
                  <option value="Vivax">Vivax</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Travel to Malaria Area</Label>
                <select value={formData.travel_to_malaria_area} onChange={(e) => handleChange('travel_to_malaria_area', e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="No">No</option>
                  <option value="Indigenous">Indigenous</option>
                  <option value="Imported">Imported</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Travel & History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Plane size={16} className="text-primary-600" />
              Travel History &amp; Comments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Travel History / Comments</Label>
                <textarea value={formData.travel_history} onChange={(e) => handleChange('travel_history', e.target.value)} className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50" rows={3} placeholder="Specify travel history" />
              </div>
              <div className="space-y-1.5">
                <Label>Source of Infection</Label>
                <Input type="text" value={formData.source_of_infection} onChange={(e) => handleChange('source_of_infection', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outcome & Follow-up */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Heart size={16} className="text-primary-600" />
              Outcome &amp; Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Outcome</Label>
                <select value={formData.outcome} onChange={(e) => handleChange('outcome', e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="Alive">Alive</option>
                  <option value="Death">Death</option>
                </select>
              </div>
              <YesNoField label="FTAT Done" field="ftat_done" />
              <div className="space-y-1.5">
                <Label>Referred Facility</Label>
                <Input type="text" value={formData.referred_facility} onChange={(e) => handleChange('referred_facility', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/cases')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {id ? 'Update Case' : (savedOffline ? 'Saved Offline' : 'Save Case')}
          </Button>
        </div>
      </form>
    </div>
  );
}
