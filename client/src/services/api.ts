import {
  Bus,
  Route,
  PickupPoint,
  Driver,
  Trip,
  Complaint,
  NotificationItem,
  ETAData,
  HistoricalArrivalRow,
  WeeklySummaryStats,
  User,
} from '../types';

const RAW_API_URL = import.meta.env.VITE_API_URL as string | undefined;
const API_BASE = RAW_API_URL ? `${RAW_API_URL.replace(/\/+$/, '')}/api` : '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('smart_bus_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || 'API Request failed');
  }
  return data;
}

export const api = {
  // Authentication
  auth: {
    login: async (username: string, password: string, portal?: 'student' | 'driver' | 'admin'): Promise<{ token: string; user: User }> => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, portal }),
      });
      return handleResponse(res);
    },
    registerStudent: async (payload: any): Promise<{ token: string; user: User }> => {
      const res = await fetch(`${API_BASE}/auth/register-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
    me: async (): Promise<{ user: User }> => {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeader(),
      });
      return handleResponse(res);
    },
    getStudents: async (): Promise<any[]> => {
      const res = await fetch(`${API_BASE}/auth/students`, {
        headers: getAuthHeader(),
      });
      const data = await handleResponse<{ students: any[] }>(res);
      return data.students;
    },
  },

  // Buses
  buses: {
    getAll: async (): Promise<Bus[]> => {
      const res = await fetch(`${API_BASE}/buses`);
      const data = await handleResponse<{ buses: Bus[] }>(res);
      return data.buses;
    },
    getById: async (id: number): Promise<Bus> => {
      const res = await fetch(`${API_BASE}/buses/${id}`);
      const data = await handleResponse<{ bus: Bus }>(res);
      return data.bus;
    },
    create: async (bus: Partial<Bus>): Promise<Bus> => {
      const res = await fetch(`${API_BASE}/buses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(bus),
      });
      const data = await handleResponse<{ bus: Bus }>(res);
      return data.bus;
    },
    update: async (id: number, bus: Partial<Bus>): Promise<Bus> => {
      const res = await fetch(`${API_BASE}/buses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(bus),
      });
      const data = await handleResponse<{ bus: Bus }>(res);
      return data.bus;
    },
    delete: async (id: number): Promise<void> => {
      const res = await fetch(`${API_BASE}/buses/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      await handleResponse(res);
    },
  },

  // Drivers
  drivers: {
    getAll: async (): Promise<Driver[]> => {
      const res = await fetch(`${API_BASE}/drivers`);
      const data = await handleResponse<{ drivers: Driver[] }>(res);
      return data.drivers;
    },
    create: async (driver: Partial<Driver>): Promise<Driver> => {
      const res = await fetch(`${API_BASE}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(driver),
      });
      const data = await handleResponse<{ driver: Driver }>(res);
      return data.driver;
    },
    update: async (id: number, driver: Partial<Driver>): Promise<Driver> => {
      const res = await fetch(`${API_BASE}/drivers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(driver),
      });
      const data = await handleResponse<{ driver: Driver }>(res);
      return data.driver;
    },
    delete: async (id: number): Promise<void> => {
      const res = await fetch(`${API_BASE}/drivers/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      await handleResponse(res);
    },
  },

  // Routes
  routes: {
    getAll: async (): Promise<Route[]> => {
      const res = await fetch(`${API_BASE}/routes`);
      const data = await handleResponse<{ routes: Route[] }>(res);
      return data.routes;
    },
    getById: async (id: number): Promise<Route> => {
      const res = await fetch(`${API_BASE}/routes/${id}`);
      const data = await handleResponse<{ route: Route }>(res);
      return data.route;
    },
    create: async (payload: any): Promise<Route> => {
      const res = await fetch(`${API_BASE}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      const data = await handleResponse<{ route: Route }>(res);
      return data.route;
    },
    update: async (id: number, payload: any): Promise<Route> => {
      const res = await fetch(`${API_BASE}/routes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      const data = await handleResponse<{ route: Route }>(res);
      return data.route;
    },
    delete: async (id: number): Promise<void> => {
      const res = await fetch(`${API_BASE}/routes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      await handleResponse(res);
    },
    calculateRoadPath: async (stops: Array<{ latitude: number; longitude: number }>): Promise<{
      coordinates: [number, number][];
      totalDistanceKm: number;
      estimatedDurationMins: number;
      legs: Array<{ distanceKm: number; durationMins: number }>;
    }> => {
      const res = await fetch(`${API_BASE}/routes/calculate-road-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stops }),
      });
      return handleResponse(res);
    },
  },

  // Pickup Points
  pickupPoints: {
    getAll: async (): Promise<PickupPoint[]> => {
      const res = await fetch(`${API_BASE}/pickup-points`);
      const data = await handleResponse<{ pickupPoints: PickupPoint[] }>(res);
      return data.pickupPoints;
    },
    create: async (point: { name: string; latitude: number; longitude: number; landmark?: string; address?: string }): Promise<PickupPoint> => {
      const res = await fetch(`${API_BASE}/pickup-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(point),
      });
      const data = await handleResponse<{ pickupPoint: PickupPoint }>(res);
      return data.pickupPoint;
    },
    update: async (id: number, point: any): Promise<PickupPoint> => {
      const res = await fetch(`${API_BASE}/pickup-points/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(point),
      });
      const data = await handleResponse<{ pickupPoint: PickupPoint }>(res);
      return data.pickupPoint;
    },
    delete: async (id: number): Promise<void> => {
      const res = await fetch(`${API_BASE}/pickup-points/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      await handleResponse(res);
    },
  },

  // GPS Tracking
  tracking: {
    start: async (payload: { busId: number; driverId?: number; routeId?: number; isDemo?: boolean; initialLat?: number; initialLng?: number }): Promise<any> => {
      const res = await fetch(`${API_BASE}/tracking/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
    stop: async (payload: { busId?: number; tripId?: number }): Promise<any> => {
      const res = await fetch(`${API_BASE}/tracking/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
    sendLocation: async (payload: {
      busId: number;
      latitude: number;
      longitude: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
      timestamp?: string;
      isDemo?: boolean;
    }): Promise<any> => {
      const res = await fetch(`${API_BASE}/tracking/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
    getBusTracking: async (busId: number): Promise<{ bus: Bus; activeTrip: Trip | null }> => {
      const res = await fetch(`${API_BASE}/tracking/bus/${busId}`);
      return handleResponse(res);
    },
    getStatus: async (busId: number): Promise<any> => {
      const res = await fetch(`${API_BASE}/tracking/status/${busId}`);
      return handleResponse(res);
    },
  },

  // Trips
  trips: {
    getAll: async (): Promise<Trip[]> => {
      const res = await fetch(`${API_BASE}/trips`);
      const data = await handleResponse<{ trips: Trip[] }>(res);
      return data.trips;
    },
    getById: async (id: number): Promise<Trip> => {
      const res = await fetch(`${API_BASE}/trips/${id}`);
      const data = await handleResponse<{ trip: Trip }>(res);
      return data.trip;
    },
    getStopEvents: async (tripId: number): Promise<any[]> => {
      const res = await fetch(`${API_BASE}/trips/${tripId}/stop-events`);
      const data = await handleResponse<{ events: any[] }>(res);
      return data.events || [];
    },
    reportDelay: async (tripId: number, delayMinutes: number, reason: string): Promise<any> => {
      const res = await fetch(`${API_BASE}/trips/${tripId}/delay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ delayMinutes, reason }),
      });
      return handleResponse(res);
    },
  },

  // ETA
  eta: {
    getETA: async (busId: number, stopId: number): Promise<ETAData> => {
      const res = await fetch(`${API_BASE}/eta/bus/${busId}/stop/${stopId}`);
      return handleResponse<ETAData>(res);
    },
  },

  // History
  history: {
    getArrivals: async (busId: number, pickupPointId: number, days: number = 7): Promise<{ rows: HistoricalArrivalRow[]; stats: WeeklySummaryStats }> => {
      const res = await fetch(`${API_BASE}/history/arrivals?busId=${busId}&pickupPointId=${pickupPointId}&days=${days}`);
      return handleResponse(res);
    },
    getBusHistory: async (busId: number): Promise<Trip[]> => {
      const res = await fetch(`${API_BASE}/history/bus/${busId}`);
      const data = await handleResponse<{ trips: Trip[] }>(res);
      return data.trips;
    },
    getWeeklySummary: async (busId: number, pickupPointId: number): Promise<WeeklySummaryStats> => {
      const res = await fetch(`${API_BASE}/history/weekly-summary?busId=${busId}&pickupPointId=${pickupPointId}`);
      const data = await handleResponse<{ stats: WeeklySummaryStats }>(res);
      return data.stats;
    },
  },

  // Notifications
  notifications: {
    getAll: async (studentId?: string): Promise<NotificationItem[]> => {
      const url = studentId ? `${API_BASE}/notifications?studentId=${encodeURIComponent(studentId)}` : `${API_BASE}/notifications`;
      const res = await fetch(url);
      const data = await handleResponse<{ notifications: NotificationItem[] }>(res);
      return data.notifications;
    },
    sendAnnouncement: async (payload: { title: string; message: string; category?: string; busId?: number; routeId?: number }): Promise<any> => {
      const res = await fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
    markRead: async (id: number): Promise<void> => {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: getAuthHeader(),
      });
      await handleResponse(res);
    },
    markAllRead: async (studentIdentifier?: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ studentIdentifier }),
      });
      await handleResponse(res);
    },
    savePreferences: async (payload: any): Promise<any> => {
      const res = await fetch(`${API_BASE}/notifications/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
    getPreferences: async (studentId: string): Promise<any> => {
      const res = await fetch(`${API_BASE}/notifications/preferences/${encodeURIComponent(studentId)}`);
      return handleResponse(res);
    },
  },

  // Complaints
  complaints: {
    submit: async (payload: any): Promise<{ complaint: Complaint; message: string }> => {
      const res = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return handleResponse(res);
    },
    getAll: async (status?: string): Promise<Complaint[]> => {
      const url = status && status !== 'All' ? `${API_BASE}/complaints?status=${encodeURIComponent(status)}` : `${API_BASE}/complaints`;
      const res = await fetch(url);
      const data = await handleResponse<{ complaints: Complaint[] }>(res);
      return data.complaints;
    },
    getByRef: async (refNo: string): Promise<Complaint> => {
      const res = await fetch(`${API_BASE}/complaints/ref/${encodeURIComponent(refNo)}`);
      const data = await handleResponse<{ complaint: Complaint }>(res);
      return data.complaint;
    },
    updateStatus: async (id: number, status: string, notes: string, updatedBy?: string): Promise<Complaint> => {
      const res = await fetch(`${API_BASE}/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ status, notes, updatedBy }),
      });
      const data = await handleResponse<{ complaint: Complaint }>(res);
      return data.complaint;
    },
  },

  // Web Push
  push: {
    getVapidKey: async (): Promise<string> => {
      const res = await fetch(`${API_BASE}/push/vapid-key`);
      const data = await handleResponse<{ publicKey: string }>(res);
      return data.publicKey;
    },
    subscribe: async (subscription: PushSubscription, studentIdentifier: string): Promise<void> => {
      const subJson = subscription.toJSON();
      const res = await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subJson, studentIdentifier }),
      });
      await handleResponse(res);
    },
    sendTest: async (studentIdentifier?: string): Promise<any> => {
      const res = await fetch(`${API_BASE}/push/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIdentifier }),
      });
      return handleResponse(res);
    },
  },

  // Admin & Supabase Management
  admin: {
    getSupabaseStatus: async (): Promise<any> => {
      const res = await fetch(`${API_BASE}/admin/supabase-status`, {
        headers: getAuthHeader(),
      });
      return handleResponse(res);
    },
    syncSupabase: async (): Promise<any> => {
      const res = await fetch(`${API_BASE}/admin/supabase-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      });
      return handleResponse(res);
    },
    pullSupabase: async (): Promise<any> => {
      const res = await fetch(`${API_BASE}/admin/supabase-pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      });
      return handleResponse(res);
    },
  },
};
