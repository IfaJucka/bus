import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, StudentProfile } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDriver: boolean;
  isStudent: boolean;
  studentProfile: StudentProfile;
  login: (username: string, password: string, portal?: 'student' | 'driver' | 'admin') => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  updateStudentProfile: (profile: Partial<StudentProfile>) => void;
  isLoading: boolean;
}

const DEFAULT_PROFILE: StudentProfile = {
  fullName: 'Mohammed Zaid',
  studentId: '4AI21CS045',
  collegeName: 'Anjuman Institute of Technology & Management',
  phone: '+91 99024 29066',
  email: 'mohammed.student@anjuman.edu',
  selectedBusId: 1,
  preferredPickupPointId: 2, // Bhatkal Bus Stand
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('smart_bus_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [studentProfile, setStudentProfile] = useState<StudentProfile>(() => {
    const saved = localStorage.getItem('smart_bus_student_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return DEFAULT_PROFILE;
  });

  useEffect(() => {
    const verifyUser = async () => {
      if (token) {
        try {
          const res = await api.auth.me();
          setUser(res.user);
          if (res.user.role === 'student') {
            setStudentProfile((prev) => ({
              ...prev,
              fullName: res.user.fullName || prev.fullName,
              studentId: res.user.studentId || prev.studentId,
              email: res.user.email || prev.email,
              phone: res.user.phone || prev.phone,
              collegeName: res.user.collegeName || prev.collegeName,
            }));
          }
        } catch {
          // Token expired or invalid
          setToken(null);
          setUser(null);
          localStorage.removeItem('smart_bus_token');
        }
      }
      setIsLoading(false);
    };

    verifyUser();
  }, [token]);

  const login = async (
    username: string,
    password: string,
    portal?: 'student' | 'driver' | 'admin'
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const res = await api.auth.login(username, password, portal);
      localStorage.setItem('smart_bus_token', res.token);
      setToken(res.token);
      setUser(res.user);

      if (res.user.role === 'student') {
        const updated = {
          ...studentProfile,
          fullName: res.user.fullName || studentProfile.fullName,
          studentId: res.user.studentId || studentProfile.studentId,
          email: res.user.email || studentProfile.email,
          phone: res.user.phone || studentProfile.phone,
          collegeName: res.user.collegeName || studentProfile.collegeName,
        };
        setStudentProfile(updated);
        localStorage.setItem('smart_bus_student_profile', JSON.stringify(updated));
      }

      return { success: true, user: res.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('smart_bus_token');
    setToken(null);
    setUser(null);
  };

  const updateStudentProfile = (updates: Partial<StudentProfile>) => {
    const updated = { ...studentProfile, ...updates };
    setStudentProfile(updated);
    localStorage.setItem('smart_bus_student_profile', JSON.stringify(updated));

    // Sync preference with backend
    api.notifications.savePreferences({
      studentIdentifier: updated.studentId || 'default_student',
      busId: updated.selectedBusId,
      pickupPointId: updated.preferredPickupPointId,
      notification5minEnabled: true,
      notificationDelayEnabled: true,
    }).catch((e) => console.warn('[Profile] Sync preference notice:', e.message));
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isDriver: user?.role === 'driver',
    isStudent: user?.role === 'student',
    studentProfile,
    login,
    logout,
    updateStudentProfile,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
