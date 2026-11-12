import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';
import { OfflineBanner } from './components/common/OfflineBanner';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';
import { NotificationModal } from './components/notifications/NotificationModal';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { DriverDashboard } from './pages/driver/DriverDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { LoginPage } from './pages/auth/LoginPage';
import { UnauthorizedPage } from './pages/auth/UnauthorizedPage';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { socketService } from './services/socket';
import { api } from './services/api';
import { NotificationItem } from './types';

// Role wrapper to ensure drivers cannot access student dashboard
const StudentDashboardGuard: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'driver') {
    return <Navigate to="/driver" replace />;
  }
  return <StudentDashboard />;
};

const AppContent: React.FC = () => {
  const { studentProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);

  // Load initial notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const notifs = await api.notifications.getAll(studentProfile.studentId);
        setNotifications(notifs);
      } catch (e: any) {
        console.warn('[App] Notification load warning:', e.message);
      }
    };

    fetchNotifications();

    // Listen for live push notifications via Socket.IO
    const unsub = socketService.onNotification((newNotif: NotificationItem) => {
      setNotifications((prev) => [newNotif, ...prev]);

      // Play soft notification sound or browser alert if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(newNotif.title, {
          body: newNotif.message,
          icon: '/icons/icon-192x192.png',
        });
      }
    });

    return () => unsub();
  }, [studentProfile.studentId]);

  const handleMarkRead = async (id: number) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (e: any) {
      console.warn('[App] Mark read error:', e.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead(studentProfile.studentId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: 1 }))
      );
    } catch (e: any) {
      console.warn('[App] Mark all read error:', e.message);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-brand-cream text-brand-navy flex flex-col font-sans selection:bg-brand-primary selection:text-brand-navy">
      <OfflineBanner />
      <PwaInstallPrompt />

      <Navbar
        unreadCount={unreadCount}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Routes>
          <Route path="/" element={<StudentDashboardGuard />} />
          <Route path="/student" element={<StudentDashboardGuard />} />
          <Route
            path="/driver"
            element={
              <ProtectedRoute allowedRoles={['driver']}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        studentId={studentProfile.studentId || '*'}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-brand-primary/40 py-6 text-center text-xs text-brand-gray mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-brand-navy">Smart College Bus</span>
            <span>• Anjuman Institute of Technology & Management</span>
          </div>
          <div>
            Built with React, Leaflet, Node.js & Real-Time GPS Tracking Telemetry
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
};

export default App;
