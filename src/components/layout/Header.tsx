import { Bell, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

export default function Header() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnread = async () => {
    try {
      const result = await api.getUnreadCount();
      setUnreadCount(result.count);
    } catch (e) {}
  };

  const handleSync = async () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 2000);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-end gap-3">
      <button
        onClick={handleSync}
        className={`p-2 rounded-lg hover:bg-gray-100 ${syncing ? 'animate-spin' : ''}`}
        title="Sync data"
      >
        <RefreshCw size={18} className="text-gray-600" />
      </button>
      <div className="relative">
        <button className="p-2 rounded-lg hover:bg-gray-100 relative" title="Notifications">
          <Bell size={18} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
