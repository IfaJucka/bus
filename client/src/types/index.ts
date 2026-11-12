export interface User {
  id: number;
  username: string;
  role: 'student' | 'admin' | 'driver';
  fullName: string;
  studentId?: string;
  email?: string;
  phone?: string;
  collegeName?: string;
  driverId?: number;
  assignedBusId?: number;
}

export interface StudentUser {
  id: number;
  username: string;
  full_name: string;
  student_id: string;
  email: string;
  phone: string;
  college_name: string;
  is_active: number;
  created_at: string;
  preferred_bus_id?: number | null;
  preferred_pickup_point_id?: number | null;
  bus_number?: string | null;
  bus_name?: string | null;
  pickup_point_name?: string | null;
}

export interface Driver {
  id: number;
  user_id?: number | null;
  full_name: string;
  phone: string;
  employee_id?: string;
  license_number?: string;
  status: 'active' | 'inactive' | 'on_duty';
  bus_id?: number | null;
  assigned_bus_id?: number | null;
  bus_number?: string | null;
  bus_name?: string | null;
}

export interface Bus {
  id: number;
  bus_number: string;
  bus_name: string;
  registration_number: string;
  capacity: number;
  assigned_driver_id: number | null;
  assigned_route_id: number | null;
  status: 'not_started' | 'running_on_time' | 'approaching_pickup' | 'delayed' | 'trip_completed' | 'gps_unavailable';
  gps_status: 'active' | 'stale' | 'offline' | 'waiting_signal';
  last_latitude: number | null;
  last_longitude: number | null;
  last_speed: number;
  last_heading: number;
  last_gps_timestamp: string | null;
  is_active: number;
  driver_name?: string;
  driver_phone?: string;
  route_name?: string;
  start_point?: string;
  destination?: string;
  is_stale?: boolean;
}

export interface PickupPoint {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  address?: string;
  is_active: number;
}

export interface RouteStop {
  id: number;
  route_id: number;
  pickup_point_id: number;
  stop_sequence: number;
  scheduled_arrival_time: string;
  scheduled_departure_time: string;
  distance_from_prev_km: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  landmark: string;
}

export interface Route {
  id: number;
  route_name: string;
  start_point: string;
  destination: string;
  operating_days: string;
  status: 'active' | 'inactive';
  total_distance_km: number;
  estimated_duration_mins: number;
  road_geometry?: [number, number][];
  route_version?: number;
  stops: RouteStop[];
}

export interface Trip {
  id: number;
  bus_id: number;
  driver_id: number;
  route_id: number;
  trip_date: string;
  start_time: string;
  end_time: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'delayed';
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  delay_mins: number;
  delay_reason: string | null;
  is_demo: number;
  bus_number?: string;
  bus_name?: string;
  driver_name?: string;
  route_name?: string;
  route_snapshot?: any;
}

export interface HistoricalArrivalRow {
  date: string;
  dayOfWeek: string;
  scheduledArrival: string;
  actualArrival: string;
  delayText: string;
  delayMinutes: number | null;
  statusText: 'On time' | 'Delayed' | 'Early' | 'Not scheduled' | 'No recorded arrival';
}

export interface WeeklySummaryStats {
  hasSufficientData: boolean;
  message?: string;
  averageArrivalTime: string;
  averageDelayMinutes: number;
  earliestArrival: string;
  latestArrival: string;
  totalTripsRecorded: number;
  onTimePercentage: number;
  pickupPointName: string;
  busNumber: string;
}

export interface Complaint {
  id: number;
  reference_no: string;
  user_id: number | null;
  student_name: string;
  student_id: string;
  phone: string;
  email: string;
  bus_number: string;
  route_name: string;
  category: 'bus_delay' | 'driver_related' | 'missed_pickup' | 'incorrect_eta' | 'gps_issue' | 'route_problem' | 'vehicle_condition' | 'other';
  description: string;
  date_of_incident: string;
  preferred_contact: string;
  status: 'New' | 'Under Review' | 'In Progress' | 'Resolved' | 'Rejected';
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: number;
  user_id?: number | null;
  student_identifier?: string;
  bus_id?: number | null;
  route_id?: number | null;
  trip_id?: number | null;
  pickup_point_id?: number | null;
  title: string;
  message: string;
  category: '5min_arrival' | 'delay_alert' | 'trip_started' | 'route_changed' | 'service_interruption' | 'announcement' | 'gps_alert';
  is_read: number;
  created_at: string;
}

export interface ETAData {
  success: boolean;
  isGpsAvailable: boolean;
  isStale?: boolean;
  busDeparted?: boolean;
  message?: string;
  busId?: number;
  busNumber?: string;
  busName?: string;
  stopId?: number;
  stopName?: string;
  scheduledArrivalTime?: string;
  estimatedArrivalTime?: string | null;
  etaMinutes?: number | null;
  roadDistanceKm?: number | null;
  straightLineKm?: number | null;
  speedKmH?: number;
  delayMinutes?: number;
  busStatus?: string;
  lastGpsUpdate?: string | null;
}

export interface StudentProfile {
  fullName: string;
  studentId: string;
  collegeName: string;
  phone: string;
  email: string;
  selectedBusId: number;
  preferredPickupPointId: number;
}
