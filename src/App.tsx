import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Dashboard from './components/dashboard/Dashboard';
import CaseForm from './components/cases/CaseForm';
import CaseList from './components/cases/CaseList';
import CaseDetail from './components/cases/CaseDetail';
import FacilityManagement from './components/facilities/FacilityManagement';
import Reports from './components/reports/Reports';
import DataQuality from './components/dataquality/DataQuality';
import AuditLog from './components/notifications/AuditLog';
import UserManagement from './components/notifications/UserManagement';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="cases/new" element={<CaseForm />} />
          <Route path="cases/edit/:id" element={<CaseForm />} />
          <Route path="cases" element={<CaseList />} />
          <Route path="cases/:id" element={<CaseDetail />} />
          <Route path="facilities" element={<FacilityManagement />} />
          <Route path="reports" element={<Reports />} />
          <Route path="data-quality" element={<DataQuality />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="users" element={<UserManagement />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
