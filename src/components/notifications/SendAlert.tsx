import { useState } from 'react';
import { Send, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function SendAlert() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('warning');
  const [targetRole, setTargetRole] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSend = async () => {
    if (!title || !message) return;
    setSending(true);
    try {
      const data: any = { title, message, type };
      if (targetRole) data.target_role = targetRole;
      const res = await api.request('/notifications/send', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setResult(res);
      setTitle('');
      setMessage('');
      setTargetRole('');
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="page-title mb-6">Send Alert / Notification</h1>

      <div className="card">
        <div className="space-y-4">
          <div>
            <label className="label">Alert Type</label>
            <div className="flex gap-3">
              {[
                { value: 'info', label: 'Info', icon: Info, color: 'bg-blue-100 text-blue-700' },
                { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'bg-amber-100 text-amber-700' },
                { value: 'alert', label: 'Critical', icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    type === opt.value ? opt.color + ' ring-2 ring-offset-1' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <opt.icon size={16} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Target Audience</label>
            <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="select-field">
              <option value="">All users in your scope</option>
              <option value="facility_user">Facility Users</option>
              <option value="facility_admin">Facility Admins</option>
              <option value="district_admin">District Admins</option>
              {user?.role === 'system_admin' && <option value="region_admin">Region Admins</option>}
            </select>
          </div>

          <div>
            <label className="label">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Alert title" />
          </div>

          <div>
            <label className="label">Message *</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input-field" rows={5} placeholder="Describe the alert or notification..." />
          </div>

          {result && (
            <div className={`p-3 rounded-lg text-sm ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {result.error || `Notification sent to ${result.sent} users`}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !title || !message}
            className="btn-primary flex items-center gap-2"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Send Notification
          </button>
        </div>
      </div>
    </div>
  );
}
