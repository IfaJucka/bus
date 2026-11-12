import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Megaphone,
  CheckCheck,
  Send,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { NotificationItem } from '../../types';
import { api } from '../../services/api';
import { PushNotificationService } from '../../services/pushNotification';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
  onMarkAllRead?: () => void;
  studentId: string;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  studentId,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'arrival' | 'delay' | 'announcement'>('all');
  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPushStatus(PushNotificationService.getPermissionStatus());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    setTestResult(null);
    try {
      const result = await PushNotificationService.requestPermissionAndSubscribe(studentId);
      setPushStatus(result.permission);
      if (result.success) {
        setTestResult('Push notifications enabled successfully! 🚀');
      } else if (result.error) {
        setTestResult(result.error);
      }
    } catch (e: any) {
      setTestResult(e.message || 'Error subscribing to notifications');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSendTestPush = async () => {
    try {
      setTestResult('Sending test push to your browser...');
      const res = await PushNotificationService.sendTestNotification(studentId);
      setTestResult(res.message || 'Test push sent!');
    } catch (e: any) {
      setTestResult(e.message || 'Failed to send test push.');
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'arrival') return n.category === '5min_arrival';
    if (activeTab === 'delay') return n.category === 'delay_alert';
    if (activeTab === 'announcement') return n.category === 'announcement' || n.category === 'trip_started';
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '5min_arrival':
        return <Clock className="w-4 h-4 text-emerald-600" />;
      case 'delay_alert':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default:
        return <Megaphone className="w-4 h-4 text-brand-navy" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-brand-secondary overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-brand-cream/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary rounded-xl text-brand-navy">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-brand-navy text-lg">Notification Center</h2>
              <p className="text-xs text-brand-gray">Real-time arrival alerts & travel announcements</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.is_read) && onMarkAllRead && (
              <button
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-brand-navy bg-brand-secondary/80 hover:bg-brand-secondary px-2.5 py-1.5 rounded-lg border border-brand-primary/60 transition-colors flex items-center gap-1.5 shadow-sm"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-brand-accent" />
                <span className="hidden sm:inline">Mark All Read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-brand-gray hover:text-brand-navy rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Web Push Setup Box */}
        <div className="p-4 bg-brand-secondary/40 border-b border-brand-primary/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-navy">
                <ShieldCheck className="w-4 h-4 text-brand-accent" />
                <span>Background Web Push Notifications</span>
              </div>
              <p className="text-xs text-brand-gray mt-0.5">
                {pushStatus === 'granted'
                  ? 'Active: You will receive 5-minute arrival & delay alerts even if your browser tab is closed.'
                  : pushStatus === 'denied'
                  ? 'Permission Blocked: Allow notifications in browser site settings to receive background alerts.'
                  : 'Enable push alerts to get notified on lock screen 5 minutes before bus arrives.'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              {pushStatus !== 'granted' ? (
                <button
                  onClick={handleEnablePush}
                  disabled={isSubscribing}
                  className="w-full sm:w-auto bg-brand-accent hover:bg-[#5b95c3] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSubscribing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                  <span>Enable Push Alerts</span>
                </button>
              ) : (
                <button
                  onClick={handleSendTestPush}
                  className="w-full sm:w-auto bg-white border border-brand-accent text-brand-navy hover:bg-brand-secondary text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-brand-accent" />
                  <span>Send Test Push</span>
                </button>
              )}
            </div>
          </div>

          {testResult && (
            <p className="mt-2 text-xs font-medium text-brand-navy bg-white/80 p-2 rounded-lg border border-brand-primary/50">
              {testResult}
            </p>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-gray-100 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'all' ? 'bg-brand-primary text-brand-navy font-semibold' : 'text-brand-gray hover:text-brand-navy'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('arrival')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'arrival' ? 'bg-brand-primary text-brand-navy font-semibold' : 'text-brand-gray hover:text-brand-navy'
            }`}
          >
            5-Min Arrivals ({notifications.filter((n) => n.category === '5min_arrival').length})
          </button>
          <button
            onClick={() => setActiveTab('delay')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'delay' ? 'bg-brand-primary text-brand-navy font-semibold' : 'text-brand-gray hover:text-brand-navy'
            }`}
          >
            Delays ({notifications.filter((n) => n.category === 'delay_alert').length})
          </button>
          <button
            onClick={() => setActiveTab('announcement')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'announcement' ? 'bg-brand-primary text-brand-navy font-semibold' : 'text-brand-gray hover:text-brand-navy'
            }`}
          >
            Announcements
          </button>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 text-brand-gray">
              <CheckCircle2 className="w-10 h-10 mx-auto text-brand-primary mb-2 opacity-60" />
              <p className="text-sm font-medium text-brand-navy">No notifications right now</p>
              <p className="text-xs text-brand-gray mt-1">You're all caught up with your college bus schedule!</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.is_read) {
                    onMarkRead(notif.id);
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all text-sm flex items-start gap-3 cursor-pointer ${
                  notif.is_read
                    ? 'bg-white border-gray-100 opacity-80'
                    : 'bg-brand-cream/60 border-brand-primary/80 hover:border-brand-accent shadow-sm'
                }`}
              >
                <div className="p-2 bg-white rounded-lg border border-brand-secondary flex-shrink-0 mt-0.5">
                  {getCategoryIcon(notif.category)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" title="New unread alert"></span>
                      )}
                      <h4 className="font-semibold text-brand-navy text-xs sm:text-sm truncate">
                        {notif.title}
                      </h4>
                    </div>
                    <span className="text-[11px] text-brand-gray flex-shrink-0">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-brand-navy/80 mt-1 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 bg-brand-secondary/60 text-brand-navy rounded-md">
                      {notif.category.replace('_', ' ')}
                    </span>

                    {!notif.is_read ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkRead(notif.id);
                        }}
                        className="text-xs text-brand-accent hover:text-brand-navy font-semibold flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark read</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Viewed</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
