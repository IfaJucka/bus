import React from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut, User, Bus, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const UnauthorizedPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const attempted = searchParams.get('attempted') || 'dashboard';
  const userRole = searchParams.get('userRole') || user?.role || 'user';

  const getRoleDisplayName = (r: string) => {
    switch (r.toLowerCase()) {
      case 'student':
        return 'Student';
      case 'driver':
        return 'Bus Driver';
      case 'admin':
        return 'Fleet Administrator';
      default:
        return r.toUpperCase();
    }
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'admin':
        return '/admin';
      case 'driver':
        return '/driver';
      case 'student':
      default:
        return '/';
    }
  };

  const getRoleIcon = (r: string) => {
    switch (r.toLowerCase()) {
      case 'admin':
        return <Shield className="w-5 h-5 text-brand-navy" />;
      case 'driver':
        return <Bus className="w-5 h-5 text-brand-navy" />;
      case 'student':
      default:
        return <User className="w-5 h-5 text-brand-navy" />;
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-brand-primary/50 p-6 sm:p-8 text-center animate-fadeIn">
        {/* Warning Badge */}
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shadow-inner">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <h1 className="text-xl sm:text-2xl font-extrabold text-brand-navy tracking-tight">
          Access Restricted
        </h1>

        <p className="text-xs sm:text-sm text-brand-gray mt-2 leading-relaxed">
          The <span className="font-bold text-brand-navy capitalize">{getRoleDisplayName(attempted)} Portal</span> requires specific authorization privileges that are not assigned to your account.
        </p>

        {/* Current Active Role Box */}
        <div className="mt-5 p-3.5 bg-brand-cream/80 border border-brand-primary/40 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-8 h-8 rounded-xl bg-brand-secondary flex items-center justify-center">
              {getRoleIcon(userRole)}
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-brand-gray">Signed in as</p>
              <p className="font-extrabold text-brand-navy">{user?.fullName || 'Current User'}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-brand-primary/50 text-brand-navy font-bold rounded-lg text-[11px] border border-brand-primary">
            {getRoleDisplayName(userRole)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            to={getDashboardPath()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to {getRoleDisplayName(userRole)} Dashboard</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-brand-secondary/50 hover:bg-brand-secondary text-brand-navy border border-brand-primary/40 transition-colors"
          >
            <LogOut className="w-4 h-4 text-brand-gray" />
            <span>Sign Out & Switch Portal</span>
          </button>
        </div>

        {/* Security Notice */}
        <p className="mt-5 text-[11px] text-brand-gray/80">
          Role-based route isolation protects student telemetry, driver navigation sessions, and administrative fleet controls.
        </p>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
