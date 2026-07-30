import { Bell, RefreshCw, CheckCheck, X, Wifi, WifiOff, Cloud } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { getPendingCount, syncPendingCases } from '../../services/db';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

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
      const result = await syncPendingCases((data) => api.syncCases(data));
      setPendingCount(result.remaining);
      if (result.synced > 0 || result.conflicts > 0) {
        const parts: string[] = [];
        if (result.synced > 0) parts.push(`${result.synced} synced`);
        if (result.conflicts > 0) parts.push(`${result.conflicts} conflicts (server kept)`);
        setSyncResult(parts.join(', '));
        setTimeout(() => setSyncResult(null), 4000);
      }
    } catch (e) {} finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    if (!isOnline) return;
    setSyncing(true);
    try {
      const result = await syncPendingCases((data) => api.syncCases(data));
      setPendingCount(result.remaining);
      const parts: string[] = [];
      if (result.synced > 0) parts.push(`${result.synced} synced`);
      if (result.conflicts > 0) parts.push(`${result.conflicts} conflicts (server kept)`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);

      if (parts.length > 0) {
        setSyncResult(parts.join(', '));
      } else if (result.remaining === 0) {
        setSyncResult('All data is up to date');
      } else {
        setSyncResult(`${result.remaining} case(s) pending`);
      }
      setTimeout(() => setSyncResult(null), 4000);
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

  const getTypeVariant = (type: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' => {
    switch (type) {
      case 'alert': return 'destructive';
      case 'warning': return 'warning';
      default: return 'default';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-end gap-3 sticky top-0 z-30">
      {/* Online/Offline Status */}
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Badge variant="success" className="gap-1.5 text-xs px-2 py-0.5 rounded-full">
            <Wifi size={10} />
            Online
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1.5 text-xs px-2 py-0.5 rounded-full">
            <WifiOff size={10} />
            Offline
          </Badge>
        )}
      </div>

      {/* Role Badge */}
      <Badge variant="secondary" className="hidden md:inline-flex text-xs px-3 py-0.5 rounded-full capitalize">
        {user?.role?.replace(/_/g, ' ')}
      </Badge>

      {/* Sync Button */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSync}
          disabled={syncing || !isOnline}
          className={`relative ${syncing ? 'animate-spin pointer-events-none' : ''}`}
          title={pendingCount > 0 ? `Sync ${pendingCount} pending case(s)` : 'Sync data'}
        >
          <RefreshCw size={18} className="text-gray-600" />
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold ring-2 ring-white shadow-sm">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </Button>
        {syncResult && (
          <div className="absolute right-0 top-full mt-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg animate-in slide-in-from-top-1 duration-200">
            {syncResult}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleNotifications}
          className="relative"
          title="Notifications"
        >
          <Bell size={18} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold ring-2 ring-white shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {showNotifications && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs gap-1 h-auto px-2 py-1 text-primary-600">
                    <CheckCheck size={12} /> Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setShowNotifications(false)} className="w-6 h-6">
                  <X size={12} />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-72 divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markAsRead(n.id)}
                    className={`px-4 py-3 cursor-pointer transition-all duration-150 hover:bg-gray-50 ${
                      !n.is_read ? 'bg-primary-50/40 border-l-2 border-l-primary-500' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Badge variant={getTypeVariant(n.type)} className="rounded text-[10px] px-1.5 py-0 flex-shrink-0 mt-0.5">
                        {n.type.toUpperCase()}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1.5 font-medium">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0 shadow-sm" />
                      )}
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
