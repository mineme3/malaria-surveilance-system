export type UserRole = 'facility_user' | 'facility_admin' | 'district_admin' | 'zone_admin' | 'region_admin' | 'system_admin';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  facility_id: number | null;
  region: string;
  zone: string;
  woreda: string;
  is_active: boolean;
  created_at: string;
}

export interface Facility {
  id: number;
  name: string;
  region: string;
  zone: string;
  woreda: string;
  kebele: string;
  facility_type: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

export interface MalariaCase {
  id: number;
  facility_id: number;
  reporting_region: string;
  zone: string;
  woreda: string;
  reporting_hf: string;
  kebele: string;
  house_no: string;
  mobile_phone: string;
  admission_type: 'Out-Patient' | 'In-Patient';
  patient_name: string;
  sex: 'M' | 'F';
  age: number;
  epi_week: number;
  age_category: string;
  date_of_onset: string;
  date_seen: string;
  fever: 'Yes' | 'No';
  headache: 'Yes' | 'No';
  joint_pain: 'Yes' | 'No';
  chills_rigor: 'Yes' | 'No';
  vomiting: 'Yes' | 'No';
  back_pain: 'Yes' | 'No';
  other_symptoms: string;
  specimen_taken: 'Yes' | 'No';
  haemoparasite_spp: 'PF' | 'PV' | 'Vivax' | 'Mixed' | '';
  travel_history: string;
  travel_to_malaria_area: 'Indigenous' | 'Imported' | 'No';
  outcome: 'Alive' | 'Death';
  ftat_done: 'Yes' | 'No';
  referred_facility: string;
  source_of_infection: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  sync_status: 'synced' | 'pending' | 'conflict';
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  total_cases: number;
  cases_this_week: number;
  cases_this_month: number;
  cases_this_year: number;
  positive_rate: number;
  deaths: number;
  facilities_reporting: number;
  cases_by_week: { week: string; count: number }[];
  cases_by_region: { region: string; count: number }[];
  cases_by_age: { category: string; count: number }[];
  cases_by_sex: { sex: string; count: number }[];
  species_distribution: { species: string; count: number }[];
}

export interface Report {
  id: number;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  period_start: string;
  period_end: string;
  generated_by: number;
  data: DashboardStats;
  created_at: string;
}
