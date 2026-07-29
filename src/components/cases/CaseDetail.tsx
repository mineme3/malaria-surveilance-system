import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, User, MapPin, Calendar, Stethoscope, TestTube, Plane, Heart } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

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
        <Button onClick={() => navigate('/cases')} variant="outline" className="mt-4">Back to Cases</Button>
      </div>
    );
  }

  const DetailItem = ({ label, value }: { label: string; value: string }) => (
    <div className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value || '-'}</dd>
    </div>
  );

  const SectionCard = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon size={16} className="text-primary-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2">{children}</dl>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cases')}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Case Details</h1>
            <p className="text-sm text-gray-500">Case #{caseData.id}</p>
          </div>
        </div>
        <Link to={`/cases/edit/${id}`}>
          <Button className="gap-2">
            <Edit size={16} /> Edit
          </Button>
        </Link>
      </div>

      {/* Patient Header */}
      <Card className="mb-6 bg-gradient-to-r from-primary-50 to-white border-primary-100">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center shadow-sm">
              <User className="text-primary-600" size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{caseData.patient_name}</h2>
              <p className="text-sm text-gray-500">
                {caseData.sex === 'M' ? 'Male' : 'Female'}, {caseData.age} years
                {caseData.age_category && <span> ({caseData.age_category})</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={caseData.outcome === 'Alive' ? 'success' : 'destructive'} className="text-sm px-3 py-1">
                {caseData.outcome}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard icon={MapPin} title="Location Information">
          <DetailItem label="Reporting Region" value={caseData.reporting_region} />
          <DetailItem label="Zone" value={caseData.zone} />
          <DetailItem label="Woreda" value={caseData.woreda} />
          <DetailItem label="Reporting HF" value={caseData.reporting_hf} />
          <DetailItem label="Kebele" value={caseData.kebele} />
          <DetailItem label="House No" value={caseData.house_no} />
          <DetailItem label="Mobile Phone" value={caseData.mobile_phone} />
        </SectionCard>

        <SectionCard icon={Calendar} title="Clinical Dates">
          <DetailItem label="Admission Type" value={caseData.admission_type} />
          <DetailItem label="Date of Onset" value={caseData.date_of_onset} />
          <DetailItem label="Date Seen" value={caseData.date_seen} />
          <DetailItem label="Epi-Week" value={caseData.epi_week?.toString()} />
          <DetailItem label="Created At" value={new Date(caseData.created_at).toLocaleString()} />
          <DetailItem label="Updated At" value={new Date(caseData.updated_at).toLocaleString()} />
        </SectionCard>

        <SectionCard icon={Stethoscope} title="Signs &amp; Symptoms">
          <DetailItem label="Fever" value={caseData.fever} />
          <DetailItem label="Headache" value={caseData.headache} />
          <DetailItem label="Joint Pain" value={caseData.joint_pain} />
          <DetailItem label="Chills &amp; Rigor" value={caseData.chills_rigor} />
          <DetailItem label="Vomiting" value={caseData.vomiting} />
          <DetailItem label="Back Pain" value={caseData.back_pain} />
          <DetailItem label="Other Symptoms" value={caseData.other_symptoms} />
        </SectionCard>

        <SectionCard icon={TestTube} title="Laboratory &amp; Diagnosis">
          <DetailItem label="Specimen Taken" value={caseData.specimen_taken} />
          <DetailItem label="Haemoparasite Species" value={caseData.haemoparasite_spp} />
          <DetailItem label="Travel to Malaria Area" value={caseData.travel_to_malaria_area} />
        </SectionCard>

        <SectionCard icon={Plane} title="Travel History">
          <DetailItem label="Travel History" value={caseData.travel_history} />
          <DetailItem label="Source of Infection" value={caseData.source_of_infection} />
        </SectionCard>

        <SectionCard icon={Heart} title="Outcome &amp; Follow-up">
          <DetailItem label="Outcome" value={caseData.outcome} />
          <DetailItem label="FTAT Done" value={caseData.ftat_done} />
          <DetailItem label="Referred Facility" value={caseData.referred_facility} />
        </SectionCard>
      </div>
    </div>
  );
}
