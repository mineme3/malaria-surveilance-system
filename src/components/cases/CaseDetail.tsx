import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, User, MapPin, Calendar, Stethoscope, TestTube, Plane, Heart } from 'lucide-react';
import { api } from '../../services/api';

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCase();
  }, [id]);

  const loadCase = async () => {
    try {
      const data = await api.getCase(parseInt(id!));
      setCaseData(data);
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

  if (!caseData) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Case not found</p>
        <button onClick={() => navigate('/cases')} className="btn-primary mt-4">Back to Cases</button>
      </div>
    );
  }

  const DetailItem = ({ label, value }: { label: string; value: string }) => (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{value || '-'}</dd>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/cases')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="page-title">Case Details</h1>
        </div>
        <Link to={`/cases/edit/${id}`} className="btn-primary flex items-center gap-2 text-sm">
          <Edit size={16} /> Edit
        </Link>
      </div>

      {/* Patient Header */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="text-primary-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{caseData.patient_name}</h2>
            <p className="text-sm text-gray-500">
              {caseData.sex === 'M' ? 'Male' : 'Female'}, {caseData.age} years ({caseData.age_category})
            </p>
          </div>
          <div className="ml-auto">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${caseData.outcome === 'Alive' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {caseData.outcome}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Location */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={18} className="text-primary-600" />
            <h3 className="font-semibold">Location Information</h3>
          </div>
          <dl className="space-y-3">
            <DetailItem label="Reporting Region" value={caseData.reporting_region} />
            <DetailItem label="Zone" value={caseData.zone} />
            <DetailItem label="Woreda" value={caseData.woreda} />
            <DetailItem label="Reporting HF" value={caseData.reporting_hf} />
            <DetailItem label="Kebele" value={caseData.kebele} />
            <DetailItem label="House No" value={caseData.house_no} />
            <DetailItem label="Mobile Phone" value={caseData.mobile_phone} />
          </dl>
        </div>

        {/* Clinical Dates */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-primary-600" />
            <h3 className="font-semibold">Clinical Dates</h3>
          </div>
          <dl className="space-y-3">
            <DetailItem label="Admission Type" value={caseData.admission_type} />
            <DetailItem label="Date of Onset" value={caseData.date_of_onset} />
            <DetailItem label="Date Seen" value={caseData.date_seen} />
            <DetailItem label="Epi-Week" value={caseData.epi_week?.toString()} />
          </dl>
        </div>

        {/* Symptoms */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope size={18} className="text-primary-600" />
            <h3 className="font-semibold">Signs & Symptoms</h3>
          </div>
          <dl className="space-y-3">
            <DetailItem label="Fever" value={caseData.fever} />
            <DetailItem label="Headache" value={caseData.headache} />
            <DetailItem label="Joint Pain" value={caseData.joint_pain} />
            <DetailItem label="Chills & Rigor" value={caseData.chills_rigor} />
            <DetailItem label="Vomiting" value={caseData.vomiting} />
            <DetailItem label="Back Pain" value={caseData.back_pain} />
            <DetailItem label="Other Symptoms" value={caseData.other_symptoms} />
          </dl>
        </div>

        {/* Lab & Diagnosis */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TestTube size={18} className="text-primary-600" />
            <h3 className="font-semibold">Laboratory & Diagnosis</h3>
          </div>
          <dl className="space-y-3">
            <DetailItem label="Specimen Taken" value={caseData.specimen_taken} />
            <DetailItem label="Haemoparasite Species" value={caseData.haemoparasite_spp} />
            <DetailItem label="Travel to Malaria Area" value={caseData.travel_to_malaria_area} />
          </dl>
        </div>

        {/* Travel */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Plane size={18} className="text-primary-600" />
            <h3 className="font-semibold">Travel History</h3>
          </div>
          <dl className="space-y-3">
            <DetailItem label="Travel History" value={caseData.travel_history} />
            <DetailItem label="Source of Infection" value={caseData.source_of_infection} />
          </dl>
        </div>

        {/* Outcome */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Heart size={18} className="text-primary-600" />
            <h3 className="font-semibold">Outcome & Follow-up</h3>
          </div>
          <dl className="space-y-3">
            <DetailItem label="Outcome" value={caseData.outcome} />
            <DetailItem label="FTAT Done" value={caseData.ftat_done} />
            <DetailItem label="Referred Facility" value={caseData.referred_facility} />
          </dl>
        </div>
      </div>
    </div>
  );
}
