import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  GraduationCap,
  Bus,
  Shield,
  KeyRound,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  LogOut,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, login, logout } = useAuth();

  const urlPortal = (searchParams.get('portal') as 'student' | 'driver' | 'admin') || 'student';
  const [activePortal, setActivePortal] = useState<'student' | 'driver' | 'admin'>(urlPortal);

  // Form states for each separate portal
  const [studentUsername, setStudentUsername] = useState<string>('student1');
  const [studentPassword, setStudentPassword] = useState<string>('student123');

  const [driverUsername, setDriverUsername] = useState<string>('driver1');
  const [driverPassword, setDriverPassword] = useState<string>('driver123');

  const [adminUsername, setAdminUsername] = useState<string>('admin');
  const [adminPassword, setAdminPassword] = useState<string>('admin123');

  // Loading & error states
  const [loadingPortal, setLoadingPortal] = useState<'student' | 'driver' | 'admin' | null>(null);
  const [errorPortal, setErrorPortal] = useState<{ portal: string; message: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('portal')) {
      const p = searchParams.get('portal') as 'student' | 'driver' | 'admin';
      if (['student', 'driver', 'admin'].includes(p)) {
        setActivePortal(p);
      }
    }
  }, [searchParams]);

  // Handle Login for a specific portal
  const handlePortalLogin = async (portal: 'student' | 'driver' | 'admin', e: React.FormEvent) => {
    e.preventDefault();
    setErrorPortal(null);
    setLoadingPortal(portal);

    let u = '';
    let p = '';

    if (portal === 'student') {
      u = studentUsername;
      p = studentPassword;
    } else if (portal === 'driver') {
      u = driverUsername;
      p = driverPassword;
    } else {
      u = adminUsername;
      p = adminPassword;
    }

    const res = await login(u, p, portal);
    setLoadingPortal(null);

    if (!res.success) {
      setErrorPortal({ portal, message: res.error || 'Authentication failed' });
      return;
    }

    // Redirect to permitted dashboard based on authenticated role
    if (res.user?.role === 'admin') {
      navigate('/admin');
    } else if (res.user?.role === 'driver') {
      navigate('/driver');
    } else {
      navigate('/');
    }
  };

  const getDashboardPath = (role?: string) => {
    if (role === 'admin') return '/admin';
    if (role === 'driver') return '/driver';
    return '/';
  };

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 animate-fadeIn">
      {/* Header Banner */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-secondary/70 border border-brand-primary/60 rounded-full text-xs font-bold text-brand-navy mb-3">
          <Shield className="w-3.5 h-3.5 text-brand-accent" />
          <span>Role-Based Authentication & Fleet Security</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
          Smart College Bus Portal Access
        </h1>
        <p className="text-xs sm:text-sm text-brand-gray mt-2 max-w-2xl mx-auto leading-relaxed">
          Select your authorized access portal below. Each dashboard is strictly isolated with independent security permissions for Students, Drivers, and Fleet Administrators.
        </p>
      </div>

      {/* Already Logged In Banner */}
      {isAuthenticated && user && (
        <div className="mb-8 p-4 sm:p-5 bg-white border border-brand-primary/60 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center font-bold text-brand-navy shadow-inner">
              {user.fullName.charAt(0)}
            </div>
            <div>
              <p className="text-xs text-brand-gray font-medium">Currently signed in</p>
              <p className="text-sm font-extrabold text-brand-navy flex items-center gap-2">
                {user.fullName}
                <span className="text-[10px] uppercase px-2 py-0.5 bg-brand-secondary text-brand-navy rounded-full font-bold">
                  {user.role}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              to={getDashboardPath(user.role)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white transition-all shadow-sm"
            >
              <span>Go to My Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={logout}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-brand-gray hover:text-red-600 bg-brand-cream border border-brand-primary/40 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3 Separate Login Portal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
        {/* CARD 1: STUDENT LOGIN */}
        <div
          onClick={() => setActivePortal('student')}
          className={`bg-white rounded-3xl border transition-all duration-300 flex flex-col p-6 sm:p-7 shadow-sm cursor-pointer ${
            activePortal === 'student'
              ? 'border-brand-accent ring-2 ring-brand-primary/50 shadow-md transform -translate-y-1'
              : 'border-brand-primary/40 hover:border-brand-primary hover:shadow'
          }`}
        >
          {/* Card Badge & Title */}
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-secondary/70 border border-brand-primary/50 flex items-center justify-center text-brand-navy">
              <GraduationCap className="w-6 h-6 text-brand-accent" />
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-brand-cream text-brand-navy rounded-full border border-brand-primary/40">
              Student Access
            </span>
          </div>

          <h2 className="text-lg font-extrabold text-brand-navy">Student Portal</h2>
          <p className="text-xs text-brand-gray mt-1 leading-relaxed min-h-[38px]">
            Live bus map, pickup stops, arrival ETAs, delay alerts & complaint lodging.
          </p>

          {/* Error inside this card */}
          {errorPortal?.portal === 'student' && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-start gap-1.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorPortal.message}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={(e) => handlePortalLogin('student', e)} className="mt-5 space-y-3.5 flex-1 flex flex-col justify-end">
            <div>
              <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase tracking-wider">
                Student Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-brand-gray absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={studentUsername}
                  onChange={(e) => setStudentUsername(e.target.value)}
                  placeholder="e.g. student1"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-brand-cream/40 border border-brand-primary/60 rounded-xl text-brand-navy placeholder-brand-gray/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-brand-gray absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-brand-cream/40 border border-brand-primary/60 rounded-xl text-brand-navy placeholder-brand-gray/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>
            </div>

            {/* Quick Demo Hint */}
            <div className="p-2 bg-brand-cream/60 rounded-lg text-[10px] text-brand-gray flex items-center justify-between">
              <span>Demo login:</span>
              <span className="font-mono font-bold text-brand-navy">student1 / student123</span>
            </div>

            <button
              type="submit"
              disabled={loadingPortal === 'student'}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-brand-primary hover:bg-brand-accent text-brand-navy hover:text-white transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loadingPortal === 'student' ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-brand-navy"></span>
              ) : (
                <>
                  <span>Sign In as Student</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* CARD 2: DRIVER LOGIN */}
        <div
          onClick={() => setActivePortal('driver')}
          className={`bg-white rounded-3xl border transition-all duration-300 flex flex-col p-6 sm:p-7 shadow-sm cursor-pointer ${
            activePortal === 'driver'
              ? 'border-emerald-500 ring-2 ring-emerald-200 shadow-md transform -translate-y-1'
              : 'border-brand-primary/40 hover:border-emerald-300 hover:shadow'
          }`}
        >
          {/* Card Badge & Title */}
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Bus className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
              Driver GPS Portal
            </span>
          </div>

          <h2 className="text-lg font-extrabold text-brand-navy">Driver Portal</h2>
          <p className="text-xs text-brand-gray mt-1 leading-relaxed min-h-[38px]">
            Device GPS tracking streamer, trip controls, stop navigation & delay alert dispatcher.
          </p>

          {/* Error inside this card */}
          {errorPortal?.portal === 'driver' && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-start gap-1.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorPortal.message}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={(e) => handlePortalLogin('driver', e)} className="mt-5 space-y-3.5 flex-1 flex flex-col justify-end">
            <div>
              <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase tracking-wider">
                Driver Username / ID
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-brand-gray absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={driverUsername}
                  onChange={(e) => setDriverUsername(e.target.value)}
                  placeholder="e.g. driver1"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-brand-cream/40 border border-brand-primary/60 rounded-xl text-brand-navy placeholder-brand-gray/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-brand-gray absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={driverPassword}
                  onChange={(e) => setDriverPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-brand-cream/40 border border-brand-primary/60 rounded-xl text-brand-navy placeholder-brand-gray/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            {/* Quick Demo Hint */}
            <div className="p-2 bg-emerald-50/70 border border-emerald-100 rounded-lg text-[10px] text-emerald-800 flex items-center justify-between">
              <span>Demo login:</span>
              <span className="font-mono font-bold">driver1 / driver123</span>
            </div>

            <button
              type="submit"
              disabled={loadingPortal === 'driver'}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loadingPortal === 'driver' ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
              ) : (
                <>
                  <span>Sign In as Driver</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* CARD 3: ADMIN LOGIN */}
        <div
          onClick={() => setActivePortal('admin')}
          className={`bg-white rounded-3xl border transition-all duration-300 flex flex-col p-6 sm:p-7 shadow-sm cursor-pointer ${
            activePortal === 'admin'
              ? 'border-brand-navy ring-2 ring-brand-navy/30 shadow-md transform -translate-y-1'
              : 'border-brand-primary/40 hover:border-brand-navy hover:shadow'
          }`}
        >
          {/* Card Badge & Title */}
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-navy/10 border border-brand-navy/20 flex items-center justify-center text-brand-navy">
              <Shield className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-brand-navy/10 text-brand-navy rounded-full border border-brand-navy/20">
              Fleet Admin
            </span>
          </div>

          <h2 className="text-lg font-extrabold text-brand-navy">Administrator Portal</h2>
          <p className="text-xs text-brand-gray mt-1 leading-relaxed min-h-[38px]">
            Manage buses, drivers, pickup points, route builder, announcements & complaints.
          </p>

          {/* Error inside this card */}
          {errorPortal?.portal === 'admin' && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-start gap-1.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorPortal.message}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={(e) => handlePortalLogin('admin', e)} className="mt-5 space-y-3.5 flex-1 flex flex-col justify-end">
            <div>
              <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase tracking-wider">
                Admin Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-brand-gray absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-brand-cream/40 border border-brand-primary/60 rounded-xl text-brand-navy placeholder-brand-gray/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-navy mb-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-brand-gray absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-brand-cream/40 border border-brand-primary/60 rounded-xl text-brand-navy placeholder-brand-gray/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
            </div>

            {/* Quick Demo Hint */}
            <div className="p-2 bg-brand-navy/5 rounded-lg text-[10px] text-brand-navy flex items-center justify-between">
              <span>Demo login:</span>
              <span className="font-mono font-bold">admin / admin123</span>
            </div>

            <button
              type="submit"
              disabled={loadingPortal === 'admin'}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-brand-navy hover:bg-brand-navy/90 text-white transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loadingPortal === 'admin' ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></span>
              ) : (
                <>
                  <span>Sign In as Administrator</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Security Footer Notice */}
      <div className="mt-10 max-w-2xl mx-auto p-4 bg-white/70 border border-brand-primary/40 rounded-2xl text-center text-xs text-brand-gray">
        <div className="flex items-center justify-center gap-1.5 font-bold text-brand-navy mb-1">
          <Info className="w-4 h-4 text-brand-accent" />
          <span>Strict Access Separation</span>
        </div>
        <p>
          Each user role is confined to its respective interface. Direct URL access to unauthorized portals is blocked by server-side JWT verification and client route guards.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
