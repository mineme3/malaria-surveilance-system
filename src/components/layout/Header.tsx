import { Bell, RefreshCw, CheckCheck, X, Wifi, WifiOff, Cloud } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { getPendingCount, syncPendingCases } from '../../services/db';

export default function Header() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUnread();
    updatePendingCount();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      autoSync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleSyncComplete = () => updatePendingCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-complete', handleSyncComplete);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUnread = async () => {
    try {
      const result = await api.getUnreadCount();
      setUnreadCount(result.count);
    } catch (e) {}
  };

  const updatePendingCount = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  };

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (e) {}
  };

  const toggleNotifications = async () => {
    if (!showNotifications) {
      await loadNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  const markAsRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const autoSync = async () => {
    if (pendingCount === 0) return;
    setSyncing(true);
    try {
      const result = await syncPendingCases((data) => api.createCase(data));
      setPendingCount(result.remaining);
      if (result.synced > 0) {
        setSyncResult(`Synced ${result.synced} case(s)`);
        setTimeout(() => setSyncResult(null), 3000);
      }
    } catch (e) {} finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    if (!isOnline) return;
    setSyncing(true);
    try {
      const result = await syncPendingCases((data) => api.createCase(data));
      setPendingCount(result.remaining);
      if (result.synced > 0) {
        setSyncResult(`Synced ${result.synced} case(s)`);
      } else if (result.remaining === 0) {
        setSyncResult('All data is up to date');
      } else {
        setSyncResult(`${result.remaining} case(s) pending`);
      }
      setTimeout(() => setSyncResult(null), 3000);
    } catch (e) {
      setSyncResult('Sync failed');
      setTimeout(() => setSyncResult(null), 3000);
    } finally {
      setSyncing(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'alert': return 'bg-red-100 text-red-700 border-red-200';
      case 'warning': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-end gap-3">
      <div className="flex items-center gap-2">
        {isOnline ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
            <Wifi size={12} />
            Online
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
            <WifiOff size={12} />
            Offline
          </span>
        )}
      </div>

      <span className="text-xs text-gray-500 hidden md:block">
        {user?.role?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>

      <div className="relative">
        <button
          onClick={handleSync}
          disabled={syncing || !isOnline}
          className={`p-2 rounded-lg hover:bg-gray-100 relative ${syncing ? 'animate-spin' : ''} ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={pendingCount > 0 ? `Sync ${pendingCount} pending case(s)` : 'Sync data'}
        >
          <RefreshCw size={18} className="text-gray-600" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
        {syncResult && (
          <div className="absolute right-0 top-full mt-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50">
            {syncResult}
          </div>
        )}
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={toggleNotifications}
          className="p-2 rounded-lg hover:bg-gray-100 relative"
          title="Notifications"
        >
          <Bell size={18} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showNotifications && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-72">
              {notifications.length === 0 ? (
                <p className="p-4 text-center text-gray-500 text-sm">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markAsRead(n.id)}
                    className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-primary-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getTypeColor(n.type)}`}>
                        {n.type.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                      {!n.is_read && <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 flex-shrink-0" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
