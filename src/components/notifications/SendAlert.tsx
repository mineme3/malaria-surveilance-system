import { useState } from 'react';
import { Send, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function SendAlert() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
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
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-6">Send Alert / Notification</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Alert Type</label>
            <div className="flex gap-3">
              {[
                { value: 'info', label: 'Info', icon: Info, color: 'bg-blue-100 text-blue-700 border-blue-300', desc: 'General information' },
                { value: 'threshold', label: 'Threshold', icon: AlertTriangle, color: 'bg-amber-100 text-amber-700 border-amber-300', desc: 'Threshold exceeded' },
                { value: 'action_threshold', label: 'Action Threshold', icon: AlertCircle, color: 'bg-red-100 text-red-700 border-red-300', desc: 'Immediate action required' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
                    type === opt.value ? opt.color + ' ring-2 ring-offset-1 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <opt.icon size={18} />
                  <span>{opt.label}</span>
                  <span className="text-[10px] font-normal opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Target Audience</label>
            <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500">
              <option value="">All users in your scope</option>
              <option value="facility_user">Facility Users</option>
              <option value="facility_admin">Facility Admins</option>
              <option value="district_admin">District Admins</option>
              {user?.role === 'system_admin' && <option value="region_admin">Region Admins</option>}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500" placeholder="Alert title" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Message *</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="flex w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 min-h-[100px]" placeholder="Describe the alert or notification..." />
          </div>

          {result && (
            <div className={`p-3 rounded-lg text-sm ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {result.error || `Notification sent to ${result.sent} users`}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !title || !message}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
