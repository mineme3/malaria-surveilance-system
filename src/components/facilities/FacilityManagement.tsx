import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Building2, X, Save } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/table';

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Health Facilities</h1>
          <p className="text-sm text-gray-500 mt-1">{facilities.length} facility{facilities.length !== 1 ? 'ies' : 'y'} registered</p>
        </div>
        <Button onClick={() => handleOpen()} className="gap-2">
          <Plus size={16} /> Add Facility
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Woreda</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Cases</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">Loading...</TableCell>
              </TableRow>
            ) : facilities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">No facilities found</TableCell>
              </TableRow>
            ) : facilities.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell className="text-gray-600">{f.region}</TableCell>
                <TableCell className="text-gray-600">{f.zone}</TableCell>
                <TableCell className="text-gray-600">{f.woreda}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{f.facility_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{f.case_count || 0}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpen(f)}>
                      <Edit size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Modal using shadcn Dialog style */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Facility' : 'Add Facility'}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{editingId ? 'Update facility details' : 'Register a new health facility'}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Facility Name <span className="text-red-500">*</span></Label>
                <Input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Adama Health Center" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Region <span className="text-red-500">*</span></Label>
                  <Input type="text" value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} placeholder="e.g. Oromia" />
                </div>
                <div className="space-y-1.5">
                  <Label>Zone *</Label>
                  <Input type="text" value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Woreda *</Label>
                  <Input type="text" value={formData.woreda} onChange={(e) => setFormData({ ...formData, woreda: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Kebele</Label>
                  <Input type="text" value={formData.kebele} onChange={(e) => setFormData({ ...formData, kebele: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Facility Type</Label>
                  <select value={formData.facility_type} onChange={(e) => setFormData({ ...formData, facility_type: e.target.value })} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500">
                    <option value="Health Center">Health Center</option>
                    <option value="Hospital">Hospital</option>
                    <option value="Clinic">Clinic</option>
                    <option value="Health Post">Health Post</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+251..." />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !formData.name || !formData.region} className="gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
