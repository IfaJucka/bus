import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bus,
  Shield,
  Navigation,
  Bell,
  Clock,
  Download,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  unreadCount?: number;
  onOpenNotifications?: () => void;
  onInstallClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  unreadCount = 0,
  onOpenNotifications,
  onInstallClick,
}) => {
  const location = useLocation();
  const { user, isAdmin, logout, studentProfile } = useAuth();
  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-brand-primary/40 sticky top-0 z-40 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="w-10 h-10 rounded-xl bg-white border border-brand-primary/50 flex items-center justify-center p-1 shadow-sm group-hover:border-brand-accent transition-all overflow-hidden">
            <img
              src="/college-logo.png"
              alt="Anjuman College Logo"
              className="w-full h-full object-contain transition-transform group-hover:scale-105"
            />
          </div>
          <div>
            <span className="font-extrabold text-brand-navy text-lg tracking-tight flex items-center gap-1.5">
              Smart Bus <span className="text-xs font-semibold px-2 py-0.5 bg-brand-secondary text-brand-navy rounded-full">GPS Live</span>
            </span>
            <span className="text-[10px] text-brand-gray block tracking-wide uppercase font-medium">
              Anjuman College Transit
            </span>
          </div>
        </Link>

        {/* Center Navigation Switcher - Role Aware */}
        <nav className="hidden md:flex items-center p-1 bg-brand-cream/80 border border-brand-primary/40 rounded-xl text-xs font-semibold shadow-inner">
          {(!user || user.role === 'student' || user.role === 'admin') && (
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                isActive('/')
                  ? 'bg-brand-primary text-brand-navy shadow-sm'
                  : 'text-brand-gray hover:text-brand-navy'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{user?.role === 'admin' ? 'Student View' : 'Student Dashboard'}</span>
            </Link>
          )}

          {user?.role === 'driver' && (
            <Link
              to="/driver"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                isActive('/driver')
                  ? 'bg-brand-primary text-brand-navy shadow-sm'
                  : 'text-brand-gray hover:text-brand-navy'
              }`}
            >
              <Bus className="w-3.5 h-3.5" />
              <span>Driver GPS Dashboard</span>
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                isActive('/admin')
                  ? 'bg-brand-primary text-brand-navy shadow-sm'
                  : 'text-brand-gray hover:text-brand-navy'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Fleet Admin Portal</span>
            </Link>
          )}

          {!user && (
            <Link
              to="/login"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                isActive('/login')
                  ? 'bg-brand-primary text-brand-navy shadow-sm'
                  : 'text-brand-gray hover:text-brand-navy'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Login Portals</span>
            </Link>
          )}
        </nav>

        {/* Right Action Items */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Clock Pill */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-brand-gray bg-brand-cream px-2.5 py-1.5 rounded-lg border border-brand-primary/40">
            <Clock className="w-3.5 h-3.5 text-brand-navy" />
            <span className="font-mono text-brand-navy">{timeString}</span>
          </div>

          {/* Install App Button */}
          {onInstallClick && (
            <button
              onClick={onInstallClick}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-brand-secondary hover:bg-brand-primary text-brand-navy px-3 py-1.5 rounded-lg transition-colors border border-brand-primary/50"
              title="Add Smart Bus to Home Screen"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl text-brand-navy hover:bg-brand-secondary transition-colors border border-brand-primary/40"
            title="Notification Center"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Session / Login Link */}
          {user ? (
            <div className="flex items-center gap-2 pl-1 border-l border-brand-secondary">
              <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-xs font-bold text-brand-navy shadow-inner">
                {user.fullName ? user.fullName.charAt(0) : 'U'}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <p className="font-bold text-brand-navy leading-none">{user.fullName}</p>
                <p className="text-[10px] text-brand-gray uppercase font-semibold capitalize">{user.role}</p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-brand-gray hover:text-red-600 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-xs font-bold text-brand-navy bg-brand-secondary hover:bg-brand-primary px-3 py-1.5 rounded-xl border border-brand-primary/50 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-brand-secondary/60 py-2 bg-brand-cream/50 text-xs font-semibold">
        {(!user || user.role === 'student' || user.role === 'admin') && (
          <Link
            to="/"
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg ${
              isActive('/') ? 'bg-brand-primary text-brand-navy' : 'text-brand-gray'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Student</span>
          </Link>
        )}
        {user?.role === 'driver' && (
          <Link
            to="/driver"
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg ${
              isActive('/driver') ? 'bg-brand-primary text-brand-navy' : 'text-brand-gray'
            }`}
          >
            <Bus className="w-3.5 h-3.5" />
            <span>Driver GPS</span>
          </Link>
        )}
        {user?.role === 'admin' && (
          <Link
            to="/admin"
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg ${
              isActive('/admin') ? 'bg-brand-primary text-brand-navy' : 'text-brand-gray'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </Link>
        )}
        {!user && (
          <Link
            to="/login"
            className={`flex items-center gap-1 py-1 px-2.5 rounded-lg ${
              isActive('/login') ? 'bg-brand-primary text-brand-navy' : 'text-brand-gray'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Portals</span>
          </Link>
        )}
      </div>
    </header>
  );
};
