import { useState, useEffect } from 'react';
import { Plus, Edit, KeyRound, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const roles = [
  { value: 'facility_user', label: 'Facility User' },
  { value: 'facility_admin', label: 'Facility Admin' },
  { value: 'district_admin', label: 'District Admin' },
  { value: 'zone_admin', label: 'Zone Admin' },
  { value: 'region_admin', label: 'Region Admin' },
  { value: 'system_admin', label: 'System Admin' },
];

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetUser, setResetUser] = useState<any>(null);
  const [formData, setFormData] = useState({ username: '', full_name: '', role: 'facility_user', facility_id: '', is_active: true, region: '', zone: '', woreda: '' });
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', full_name: '', role: 'facility_user', facility_id: '', region: '', zone: '', woreda: '' });
  const [resetPassword, setResetPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = ['system_admin', 'region_admin', 'zone_admin', 'district_admin'].includes(user?.role || '');

  const ROLE_LEVELS: Record<string, number> = {
    facility_user: 0,
    facility_admin: 1,
    district_admin: 2,
    zone_admin: 3,
    region_admin: 4,
    system_admin: 5,
  };

  const getAllowedRoles = (userRole: string): { value: string; label: string }[] => {
    const userLevel = ROLE_LEVELS[userRole] || 0;
    return roles.filter((r) => ROLE_LEVELS[r.value] < userLevel);
  };

  const canManageUser = (targetUser: any): boolean => {
    if (user?.role === 'system_admin') return true;
    const myLevel = ROLE_LEVELS[user?.role || 'facility_user'] || 0;
    const targetLevel = ROLE_LEVELS[targetUser.role] || 0;
    return targetLevel < myLevel;
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [u, f] = await Promise.all([api.getUsers(), api.getFacilities()]);
      setUsers(u);
      setFacilities(f);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleEdit = (u: any) => {
    setEditingUser(u);
    setFormData({ username: u.username, full_name: u.full_name, role: u.role, facility_id: u.facility_id?.toString() || '', is_active: !!u.is_active, region: u.region || '', zone: u.zone || '', woreda: u.woreda || '' });
    setError('');
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    setSaving(true);
    setError('');
    try {
      await api.updateUser(editingUser.id, {
        username: formData.username,
        full_name: formData.full_name,
        role: formData.role,
        facility_id: formData.facility_id ? parseInt(formData.facility_id) : null,
        is_active: formData.is_active,
        region: formData.region,
        zone: formData.zone,
        woreda: formData.woreda,
      });
      setShowEditDialog(false);
      loadData();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      await api.register({ ...newUser, facility_id: newUser.facility_id ? parseInt(newUser.facility_id) : null });
      setShowCreateDialog(false);
      setNewUser({ username: '', email: '', password: '', full_name: '', role: 'facility_user', facility_id: '', region: '', zone: '', woreda: '' });
      loadData();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setSaving(true);
    setError('');
    try {
      await api.resetPassword(resetUser.id, resetPassword);
      setShowResetDialog(false);
      setResetPassword('');
      setResetUser(null);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const openResetDialog = (u: any) => {
    setResetUser(u);
    setResetPassword('');
    setError('');
    setShowResetDialog(true);
  };

  const handleToggleActive = async (u: any) => {
    try {
      await api.toggleUserActive(u.id);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (u: any) => {
    if (!confirm(`Deactivate ${u.full_name}? They will no longer be able to log in.`)) return;
    try {
      await api.deleteUser(u.id);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const needsRegion = ['region_admin', 'zone_admin', 'district_admin'].includes(newUser.role);
  const needsZone = ['zone_admin', 'district_admin'].includes(newUser.role);
  const needsWoreda = newUser.role === 'district_admin';

  const editNeedsRegion = ['region_admin', 'zone_admin', 'district_admin'].includes(formData.role);
  const editNeedsZone = ['zone_admin', 'district_admin'].includes(formData.role);
  const editNeedsWoreda = formData.role === 'district_admin';

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
    switch (role) {
      case 'system_admin': return 'destructive';
      case 'region_admin': return 'warning';
      case 'zone_admin': return 'default';
      case 'district_admin': return 'default';
      case 'facility_admin': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        {isAdmin && (
          <Button onClick={() => { setError(''); setShowCreateDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add User
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500">Loading...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500">No users found</TableCell>
                </TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-gray-600">{u.username}</TableCell>
                  <TableCell className="text-gray-600">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(u.role)}>
                      {u.role.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? 'success' : 'destructive'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canManageUser(u) && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(u)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleActive(u)} title={u.is_active ? 'Deactivate' : 'Activate'}>
                            {u.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(u)} title="Deactivate user">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      {isAdmin && canManageUser(u) && (
                        <Button variant="ghost" size="icon" onClick={() => openResetDialog(u)} title="Reset password">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and role assignments.</DialogDescription>
          </DialogHeader>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input id="edit-username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input id="edit-name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(value) => {
                const next = { ...formData, role: value };
                // Prefill the editor's scope so promoted admins stay inside it
                if (['zone_admin', 'district_admin'].includes(value) && !next.region) next.region = user?.region || '';
                if (value === 'district_admin' && !next.zone) next.zone = user?.zone || '';
                setFormData(next);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAllowedRoles(user?.role || '').map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editNeedsRegion && (
              <div className="space-y-2">
                <Label>Region *</Label>
                <Input value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} placeholder="e.g. Oromia" />
              </div>
            )}
            {editNeedsZone && (
              <div className="space-y-2">
                <Label>Zone *</Label>
                <Input value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })} placeholder="e.g. East Hararghe" />
              </div>
            )}
            {editNeedsWoreda && (
              <div className="space-y-2">
                <Label>Woreda *</Label>
                <Input value={formData.woreda} onChange={(e) => setFormData({ ...formData, woreda: e.target.value })} placeholder="e.g. Gursum" />
              </div>
            )}
            {['facility_admin', 'facility_user'].includes(formData.role) && (
              <div className="space-y-2">
                <Label>Facility</Label>
                <Select value={formData.facility_id} onValueChange={(value) => setFormData({ ...formData, facility_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {facilities.map((f) => <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit-active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="rounded border-gray-300" />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving || (editNeedsRegion && !formData.region) || (editNeedsZone && !formData.zone) || (editNeedsWoreda && !formData.woreda)}>
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Full Name *</Label>
              <Input id="create-name" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-username">Username *</Label>
              <Input id="create-username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input id="create-email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password *</Label>
              <Input id="create-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(value) => {
                const next = { ...newUser, role: value };
                // Prefill the creator's scope so newly registered admins are correctly limited
                if (['zone_admin', 'district_admin'].includes(value) && !next.region) next.region = user?.region || '';
                if (value === 'district_admin' && !next.zone) next.zone = user?.zone || '';
                setNewUser(next);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAllowedRoles(user?.role || '').map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {needsRegion && (
              <div className="space-y-2">
                <Label>Region *</Label>
                <Input value={newUser.region} onChange={(e) => setNewUser({ ...newUser, region: e.target.value })} placeholder="e.g. Oromia" />
              </div>
            )}
            {needsZone && (
              <div className="space-y-2">
                <Label>Zone *</Label>
                <Input value={newUser.zone} onChange={(e) => setNewUser({ ...newUser, zone: e.target.value })} placeholder="e.g. East Hararghe" />
              </div>
            )}
            {needsWoreda && (
              <div className="space-y-2">
                <Label>Woreda *</Label>
                <Input value={newUser.woreda} onChange={(e) => setNewUser({ ...newUser, woreda: e.target.value })} placeholder="e.g. Gursum" />
              </div>
            )}
            {['facility_admin', 'facility_user'].includes(newUser.role) && (
              <div className="space-y-2">
                <Label>Facility</Label>
                <Select value={newUser.facility_id} onValueChange={(value) => setNewUser({ ...newUser, facility_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {facilities.map((f) => <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !newUser.username || !newUser.email || !newUser.password || !newUser.full_name || (needsRegion && !newUser.region) || (needsZone && !newUser.zone) || (needsWoreda && !newUser.woreda)}>
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-semibold">{resetUser?.full_name}</span>.
            </DialogDescription>
          </DialogHeader>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="reset-password">New Password</Label>
            <Input
              id="reset-password"
              type="password"
              placeholder="Enter new password (min 6 characters)"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={saving || resetPassword.length < 6}>
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
