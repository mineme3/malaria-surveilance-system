import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, CheckCircle, WifiOff, Cloud } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { saveCaseOffline, getPendingCount, syncPendingCases } from '../../services/db';

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
      const result = await syncPendingCases((data) => api.createCase(data));
      if (result.synced > 0) {
        setPendingCount(result.remaining);
        window.dispatchEvent(new CustomEvent('sync-complete', { detail: result }));
      }
    } catch (e) {}
  }, []);

  const loadFacilities = async () => {
    try {
      const data = await api.getFacilities();
      setFacilities(data);
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
    } catch (e) {}
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
      if (!navigator.onLine) {
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
        setErrors({ submit: err.message || 'Failed to save' });
      }
    } finally {
      setSaving(false);
    }
  };

  const YesNoField = ({ label, field }: { label: string; field: string }) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-4 mt-1">
        {['Yes', 'No'].map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={field}
              value={opt}
              checked={formData[field as keyof typeof formData] === opt}
              onChange={(e) => handleChange(field, e.target.value)}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm">{opt}</span>
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
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/cases')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">{id ? 'Edit Case' : 'New Malaria Case Entry'}</h1>
        <div className="ml-auto flex items-center gap-2">
          {!isOnline && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              <WifiOff size={12} />
              Offline Mode
            </span>
          )}
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              <Cloud size={12} />
              {pendingCount} pending sync
            </span>
          )}
        </div>
      </div>

      {success && (
        <div className={`mb-6 p-4 border rounded-lg flex items-center gap-3 ${savedOffline ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          {savedOffline ? (
            <>
              <WifiOff className="text-amber-600" size={20} />
              <span className="text-amber-700 font-medium">Case saved offline. It will sync when you&apos;re back online.</span>
            </>
          ) : (
            <>
              <CheckCircle className="text-green-600" size={20} />
              <span className="text-green-700 font-medium">Case saved successfully! Redirecting...</span>
            </>
          )}
        </div>
      )}

      {errors.submit && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Location Section */}
        <div className="card">
          <h3 className="section-title">Location Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Facility *</label>
              <select value={formData.facility_id} onChange={(e) => handleFacilityChange(e.target.value)} className="select-field">
                <option value="">Select Facility</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.facility_id && <p className="text-red-500 text-xs mt-1">{errors.facility_id}</p>}
            </div>
            <div>
              <label className="label">Reporting Region</label>
              <input type="text" value={formData.reporting_region} onChange={(e) => handleChange('reporting_region', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Zone</label>
              <input type="text" value={formData.zone} onChange={(e) => handleChange('zone', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Woreda</label>
              <input type="text" value={formData.woreda} onChange={(e) => handleChange('woreda', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Reporting HF</label>
              <input type="text" value={formData.reporting_hf} onChange={(e) => handleChange('reporting_hf', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Kebele</label>
              <input type="text" value={formData.kebele} onChange={(e) => handleChange('kebele', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">House No</label>
              <input type="text" value={formData.house_no} onChange={(e) => handleChange('house_no', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Mobile Phone</label>
              <input type="tel" value={formData.mobile_phone} onChange={(e) => handleChange('mobile_phone', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        {/* Patient Information */}
        <div className="card">
          <h3 className="section-title">Patient Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">Patient Name *</label>
              <input type="text" value={formData.patient_name} onChange={(e) => handleChange('patient_name', e.target.value)} className="input-field" placeholder="Full name" />
              {errors.patient_name && <p className="text-red-500 text-xs mt-1">{errors.patient_name}</p>}
            </div>
            <div>
              <label className="label">Admission Type</label>
              <select value={formData.admission_type} onChange={(e) => handleChange('admission_type', e.target.value)} className="select-field">
                <option value="Out-Patient">Out-Patient</option>
                <option value="In-Patient">In-Patient</option>
              </select>
            </div>
            <div>
              <label className="label">Sex *</label>
              <select value={formData.sex} onChange={(e) => handleChange('sex', e.target.value)} className="select-field">
                <option value="M">Male (M)</option>
                <option value="F">Female (F)</option>
              </select>
              {errors.sex && <p className="text-red-500 text-xs mt-1">{errors.sex}</p>}
            </div>
            <div>
              <label className="label">Age *</label>
              <input type="number" min="0" max="150" value={formData.age} onChange={(e) => handleChange('age', e.target.value)} className="input-field" placeholder="Years" />
              {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
            </div>
            <div>
              <label className="label">Age Category</label>
              <input type="text" value={formData.age_category} readOnly className="input-field bg-gray-50" />
            </div>
            <div>
              <label className="label">Epi-Week</label>
              <input type="number" min="1" max="53" value={formData.epi_week} onChange={(e) => handleChange('epi_week', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="card">
          <h3 className="section-title">Clinical Dates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Date of Onset</label>
              <input type="date" value={formData.date_of_onset} onChange={(e) => handleChange('date_of_onset', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Date Seen at Facility</label>
              <input type="date" value={formData.date_seen} onChange={(e) => handleChange('date_seen', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        {/* Symptoms */}
        <div className="card">
          <h3 className="section-title">Signs & Symptoms</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <YesNoField label="Fever" field="fever" />
            <YesNoField label="Headache" field="headache" />
            <YesNoField label="Joint Pain" field="joint_pain" />
            <YesNoField label="Chills & Rigor" field="chills_rigor" />
            <YesNoField label="Vomiting" field="vomiting" />
            <YesNoField label="Back Pain" field="back_pain" />
            <div className="md:col-span-3">
              <label className="label">Other Symptoms & Signs</label>
              <input type="text" value={formData.other_symptoms} onChange={(e) => handleChange('other_symptoms', e.target.value)} className="input-field" placeholder="Describe any other symptoms" />
            </div>
          </div>
        </div>

        {/* Lab & Diagnosis */}
        <div className="card">
          <h3 className="section-title">Laboratory & Diagnosis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <YesNoField label="Specimen Taken (RDT/BF/WBC)" field="specimen_taken" />
            <div>
              <label className="label">Haemoparasite Species</label>
              <select value={formData.haemoparasite_spp} onChange={(e) => handleChange('haemoparasite_spp', e.target.value)} className="select-field">
                <option value="">Select Species</option>
                <option value="PF">P.F (Plasmodium Falciparum)</option>
                <option value="PV">P.V (Plasmodium Vivax)</option>
                <option value="Vivax">Vivax</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="label">Travel to Malaria Area</label>
              <select value={formData.travel_to_malaria_area} onChange={(e) => handleChange('travel_to_malaria_area', e.target.value)} className="select-field">
                <option value="No">No</option>
                <option value="Indigenous">Indigenous</option>
                <option value="Imported">Imported</option>
              </select>
            </div>
          </div>
        </div>

        {/* Travel & History */}
        <div className="card">
          <h3 className="section-title">Travel History & Comments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Travel History / Comments</label>
              <textarea value={formData.travel_history} onChange={(e) => handleChange('travel_history', e.target.value)} className="input-field" rows={3} placeholder="Specify travel history" />
            </div>
            <div>
              <label className="label">Source of Infection</label>
              <input type="text" value={formData.source_of_infection} onChange={(e) => handleChange('source_of_infection', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        {/* Outcome & Follow-up */}
        <div className="card">
          <h3 className="section-title">Outcome & Follow-up</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Outcome</label>
              <select value={formData.outcome} onChange={(e) => handleChange('outcome', e.target.value)} className="select-field">
                <option value="Alive">Alive</option>
                <option value="Death">Death</option>
              </select>
            </div>
            <YesNoField label="FTAT Done" field="ftat_done" />
            <div>
              <label className="label">Referred Facility</label>
              <input type="text" value={formData.referred_facility} onChange={(e) => handleChange('referred_facility', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate('/cases')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {id ? 'Update Case' : (savedOffline ? 'Saved Offline' : 'Save Case')}
          </button>
        </div>
      </form>
    </div>
  );
}
