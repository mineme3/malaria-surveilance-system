import { useState, useEffect } from 'react';
import { Plus, Edit, X, Save, User } from 'lucide-react';
import { api } from '../../services/api';

const roles = [
  { value: 'facility_user', label: 'Facility User' },
  { value: 'facility_admin', label: 'Facility Admin' },
  { value: 'district_admin', label: 'District Admin' },
  { value: 'zone_admin', label: 'Zone Admin' },
  { value: 'region_admin', label: 'Region Admin' },
  { value: 'system_admin', label: 'System Admin' },
];

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({ full_name: '', role: 'facility_user', facility_id: '', is_active: true });
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', full_name: '', role: 'facility_user', facility_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [u, f] = await Promise.all([api.getUsers(), api.getFacilities()]);
      setUsers(u);
      setFacilities(f);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({ full_name: user.full_name, role: user.role, facility_id: user.facility_id?.toString() || '', is_active: !!user.is_active });
    setShowModal(true);
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await api.updateUser(editingUser.id, { ...formData, facility_id: formData.facility_id ? parseInt(formData.facility_id) : null });
      setShowModal(false);
      loadData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.register({ ...newUser, facility_id: newUser.facility_id ? parseInt(newUser.facility_id) : null });
      setShowCreateModal(false);
      setNewUser({ username: '', email: '', password: '', full_name: '', role: 'facility_user', facility_id: '' });
      loadData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">User Management</h1>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add User
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Username</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{u.username}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium capitalize">{u.role.replace(/_/g, ' ')}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3"><button onClick={() => handleEdit(u)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Edit User</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label">Role</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="select-field">
                  {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Facility</label>
                <select value={formData.facility_id} onChange={(e) => setFormData({ ...formData, facility_id: e.target.value })} className="select-field">
                  <option value="">None</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="rounded text-primary-600" />
                <span className="text-sm">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleUpdate} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Add User</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input type="text" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label">Username *</label>
                <input type="text" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label">Password *</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="select-field">
                  {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Facility</label>
                <select value={newUser.facility_id} onChange={(e) => setNewUser({ ...newUser, facility_id: e.target.value })} className="select-field">
                  <option value="">None</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !newUser.username || !newUser.email || !newUser.password || !newUser.full_name} className="btn-primary flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
