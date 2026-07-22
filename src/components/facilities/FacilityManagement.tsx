import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Building2, X, Save } from 'lucide-react';
import { api } from '../../services/api';

const emptyFacility = { name: '', region: '', zone: '', woreda: '', kebele: '', facility_type: 'Health Center', phone: '' };

export default function FacilityManagement() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyFacility);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadFacilities(); }, []);

  const loadFacilities = async () => {
    try {
      const data = await api.getFacilities();
      setFacilities(data);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleOpen = (facility?: any) => {
    if (facility) {
      setEditingId(facility.id);
      setFormData({ name: facility.name, region: facility.region, zone: facility.zone, woreda: facility.woreda, kebele: facility.kebele, facility_type: facility.facility_type, phone: facility.phone });
    } else {
      setEditingId(null);
      setFormData(emptyFacility);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.updateFacility(editingId, { ...formData, is_active: true });
      } else {
        await api.createFacility(formData);
      }
      setShowModal(false);
      loadFacilities();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this facility?')) return;
    try { await api.deleteFacility(id); loadFacilities(); } catch (e) {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Health Facilities</h1>
        <button onClick={() => handleOpen()} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Facility
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Region</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Zone</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Woreda</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Phone</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
            ) : facilities.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No facilities found</td></tr>
            ) : facilities.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{f.name}</td>
                <td className="px-4 py-3 text-gray-600">{f.region}</td>
                <td className="px-4 py-3 text-gray-600">{f.zone}</td>
                <td className="px-4 py-3 text-gray-600">{f.woreda}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{f.facility_type}</span></td>
                <td className="px-4 py-3 text-gray-600">{f.phone}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleOpen(f)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit size={15} /></button>
                    <button onClick={() => handleDelete(f.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">{editingId ? 'Edit Facility' : 'Add Facility'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Facility Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Region *</label>
                  <input type="text" value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label">Zone *</label>
                  <input type="text" value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label">Woreda *</label>
                  <input type="text" value={formData.woreda} onChange={(e) => setFormData({ ...formData, woreda: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label">Kebele</label>
                  <input type="text" value={formData.kebele} onChange={(e) => setFormData({ ...formData, kebele: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label">Facility Type</label>
                  <select value={formData.facility_type} onChange={(e) => setFormData({ ...formData, facility_type: e.target.value })} className="select-field">
                    <option value="Health Center">Health Center</option>
                    <option value="Hospital">Hospital</option>
                    <option value="Clinic">Clinic</option>
                    <option value="Health Post">Health Post</option>
                  </select>
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-field" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formData.name || !formData.region} className="btn-primary flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
