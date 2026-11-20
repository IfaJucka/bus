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
  register: (data: any) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  updateStudentProfile: (profile: Partial<StudentProfile>) => Promise<void>;
  isLoading: boolean;
}

const DEFAULT_PROFILE: StudentProfile = {
  fullName: 'Student',
  studentId: '4AI21CS045',
  collegeName: 'Anjuman Institute of Technology & Management',
  phone: '+91 99024 29066',
  email: 'student@anjuman.edu',
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
            const dbProf = res.profile || {};
            const loadedProfile: StudentProfile = {
              fullName: res.user.fullName || dbProf.fullName || DEFAULT_PROFILE.fullName,
              studentId: res.user.studentId || dbProf.studentId || DEFAULT_PROFILE.studentId,
              email: res.user.email || dbProf.email || DEFAULT_PROFILE.email,
              phone: res.user.phone || dbProf.phone || DEFAULT_PROFILE.phone,
              collegeName: res.user.collegeName || dbProf.collegeName || DEFAULT_PROFILE.collegeName,
              selectedBusId: dbProf.selectedBusId ? Number(dbProf.selectedBusId) : 1,
              preferredPickupPointId: dbProf.preferredPickupPointId ? Number(dbProf.preferredPickupPointId) : 2,
            };
            setStudentProfile(loadedProfile);
            localStorage.setItem('smart_bus_student_profile', JSON.stringify(loadedProfile));
          }
        } catch {
          // Token expired or invalid
          setToken(null);
          setUser(null);
          localStorage.removeItem('smart_bus_token');
          localStorage.removeItem('smart_bus_student_profile');
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
        try {
          const profRes = await api.auth.getProfile();
          const p = profRes.profile || {};
          const loadedProfile: StudentProfile = {
            fullName: res.user.fullName || p.fullName || DEFAULT_PROFILE.fullName,
            studentId: res.user.studentId || p.studentId || DEFAULT_PROFILE.studentId,
            email: res.user.email || p.email || DEFAULT_PROFILE.email,
            phone: res.user.phone || p.phone || DEFAULT_PROFILE.phone,
            collegeName: res.user.collegeName || p.collegeName || DEFAULT_PROFILE.collegeName,
            selectedBusId: p.selectedBusId ? Number(p.selectedBusId) : 1,
            preferredPickupPointId: p.preferredPickupPointId ? Number(p.preferredPickupPointId) : 2,
          };
          setStudentProfile(loadedProfile);
          localStorage.setItem('smart_bus_student_profile', JSON.stringify(loadedProfile));
        } catch {
          const fallbackProfile: StudentProfile = {
            fullName: res.user.fullName || DEFAULT_PROFILE.fullName,
            studentId: res.user.studentId || DEFAULT_PROFILE.studentId,
            email: res.user.email || DEFAULT_PROFILE.email,
            phone: res.user.phone || DEFAULT_PROFILE.phone,
            collegeName: res.user.collegeName || DEFAULT_PROFILE.collegeName,
            selectedBusId: 1,
            preferredPickupPointId: 2,
          };
          setStudentProfile(fallbackProfile);
          localStorage.setItem('smart_bus_student_profile', JSON.stringify(fallbackProfile));
        }
      }

      return { success: true, user: res.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const register = async (data: any): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const res = await api.auth.registerStudent(data);
      localStorage.setItem('smart_bus_token', res.token);
      setToken(res.token);
      setUser(res.user);

      const p = res.profile || {};
      const newProf: StudentProfile = {
        fullName: res.user.fullName || data.fullName,
        studentId: res.user.studentId || data.studentId,
        email: res.user.email || data.email,
        phone: res.user.phone || data.phone,
        collegeName: res.user.collegeName || 'Anjuman Institute of Technology & Management',
        selectedBusId: data.preferredBusId ? Number(data.preferredBusId) : (p.selectedBusId ? Number(p.selectedBusId) : 1),
        preferredPickupPointId: data.preferredPickupPointId ? Number(data.preferredPickupPointId) : (p.preferredPickupPointId ? Number(p.preferredPickupPointId) : 2),
      };
      setStudentProfile(newProf);
      localStorage.setItem('smart_bus_student_profile', JSON.stringify(newProf));

      return { success: true, user: res.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('smart_bus_token');
    localStorage.removeItem('smart_bus_student_profile');
    setToken(null);
    setUser(null);
    setStudentProfile(DEFAULT_PROFILE);
  };

  const updateStudentProfile = async (updates: Partial<StudentProfile>) => {
    const updated = { ...studentProfile, ...updates };
    setStudentProfile(updated);
    localStorage.setItem('smart_bus_student_profile', JSON.stringify(updated));

    try {
      await api.auth.updateProfile({
        fullName: updated.fullName,
        studentId: updated.studentId,
        phone: updated.phone,
        email: updated.email,
        collegeName: updated.collegeName,
        selectedBusId: updated.selectedBusId,
        preferredPickupPointId: updated.preferredPickupPointId,
      });
    } catch (err: any) {
      console.warn('[AuthContext] Profile server update notice:', err.message);
    }

    // Also sync notification preference
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
    register,
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
