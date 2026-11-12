import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles: Array<'student' | 'admin' | 'driver'>;
  children: React.ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-9 w-9 border-b-2 border-brand-accent"></div>
          <p className="mt-3 text-xs font-semibold text-brand-gray tracking-wide uppercase">
            Verifying secure credentials...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    // Pick the primary portal to redirect to
    const portal = allowedRoles[0] || 'student';
    return <Navigate to={`/login?portal=${portal}`} state={{ from: location }} replace />;
  }

  // Authenticated, but role not permitted
  if (!allowedRoles.includes(user.role)) {
    const attempted = allowedRoles[0] || 'dashboard';
    return (
      <Navigate
        to={`/unauthorized?attempted=${attempted}&userRole=${user.role}`}
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
};
