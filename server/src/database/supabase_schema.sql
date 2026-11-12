-- ============================================================================
-- Smart College Bus Transportation System
-- Supabase PostgreSQL Relational Schema & Row-Level Security Policies
-- ============================================================================

-- 1. Users Table (Students, Drivers, Administrators)
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(120),
  role VARCHAR(30) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'driver')),
  full_name VARCHAR(120) NOT NULL,
  student_id VARCHAR(50),
  phone VARCHAR(25),
  college_name VARCHAR(150) DEFAULT 'Anjuman Institute of Technology & Management',
  is_active INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON public.users(student_id);

-- 2. Drivers Table
CREATE TABLE IF NOT EXISTS public.drivers (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(25) NOT NULL,
  employee_id VARCHAR(50),
  license_number VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_duty')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);

-- 3. Bus Routes Master Table
CREATE TABLE IF NOT EXISTS public.routes (
  id SERIAL PRIMARY KEY,
  route_name VARCHAR(120) NOT NULL,
  start_point VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  operating_days VARCHAR(100) NOT NULL DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  total_distance_km NUMERIC(6,2) DEFAULT 0.00,
  estimated_duration_mins INT DEFAULT 45,
  road_geometry JSONB NULL,
  route_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_status ON public.routes(status);

-- 4. Pickup Points / Bus Stops Master Table
CREATE TABLE IF NOT EXISTS public.pickup_points (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  landmark VARCHAR(150),
  address TEXT NULL,
  is_active INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_coords ON public.pickup_points(latitude, longitude);

-- 5. Route Stops (Sequential Stops along a Bus Route)
CREATE TABLE IF NOT EXISTS public.route_stops (
  id SERIAL PRIMARY KEY,
  route_id INT NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  pickup_point_id INT NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
  stop_sequence INT NOT NULL,
  scheduled_arrival_time VARCHAR(20) NOT NULL,
  scheduled_departure_time VARCHAR(20) NOT NULL,
  distance_from_prev_km NUMERIC(6,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_route_stop_seq UNIQUE (route_id, stop_sequence)
);

CREATE INDEX IF NOT EXISTS idx_route_stops_pickup ON public.route_stops(pickup_point_id);

-- 6. Buses Table
CREATE TABLE IF NOT EXISTS public.buses (
  id SERIAL PRIMARY KEY,
  bus_number VARCHAR(30) NOT NULL UNIQUE,
  bus_name VARCHAR(80) NOT NULL,
  registration_number VARCHAR(50),
  capacity INT DEFAULT 50,
  assigned_driver_id INT NULL REFERENCES public.drivers(id) ON DELETE SET NULL,
  assigned_route_id INT NULL REFERENCES public.routes(id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'running_on_time', 'approaching_pickup', 'delayed', 'trip_completed', 'gps_unavailable')),
  gps_status VARCHAR(30) NOT NULL DEFAULT 'waiting_signal' CHECK (gps_status IN ('active', 'stale', 'offline', 'waiting_signal')),
  last_latitude NUMERIC(10, 7) NULL,
  last_longitude NUMERIC(10, 7) NULL,
  last_speed NUMERIC(5, 2) DEFAULT 0.00,
  last_heading NUMERIC(5, 2) DEFAULT 0.00,
  last_gps_timestamp TIMESTAMPTZ NULL,
  is_active INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buses_status ON public.buses(status);
CREATE INDEX IF NOT EXISTS idx_buses_gps ON public.buses(gps_status);

-- 7. Route Schedules (Operating Day-wise Timings)
CREATE TABLE IF NOT EXISTS public.route_schedules (
  id SERIAL PRIMARY KEY,
  route_id INT NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  day_of_week VARCHAR(20) NOT NULL,
  departure_time VARCHAR(20) NOT NULL,
  arrival_time VARCHAR(20) NOT NULL,
  is_active INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Trips (Active and Historical Trip Records)
CREATE TABLE IF NOT EXISTS public.trips (
  id SERIAL PRIMARY KEY,
  bus_id INT NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  driver_id INT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  route_id INT NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  trip_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'delayed')),
  start_lat NUMERIC(10, 7) NULL,
  start_lng NUMERIC(10, 7) NULL,
  end_lat NUMERIC(10, 7) NULL,
  end_lng NUMERIC(10, 7) NULL,
  delay_mins INT NOT NULL DEFAULT 0,
  delay_reason VARCHAR(255) NULL,
  route_snapshot JSONB NULL,
  is_demo INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_date_bus ON public.trips(bus_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);

-- 9. GPS Locations Stream
CREATE TABLE IF NOT EXISTS public.gps_locations (
  id BIGSERIAL PRIMARY KEY,
  trip_id INT NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  bus_id INT NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  speed NUMERIC(5, 2) DEFAULT 0.00,
  heading NUMERIC(5, 2) DEFAULT 0.00,
  accuracy NUMERIC(6, 2) DEFAULT 0.00,
  altitude NUMERIC(6, 2) NULL,
  is_valid INT NOT NULL DEFAULT 1,
  is_stale INT NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_trip_time ON public.gps_locations(trip_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_gps_bus_time ON public.gps_locations(bus_id, timestamp);

-- 10. Trip Stop Arrival & Departure Events
CREATE TABLE IF NOT EXISTS public.trip_stop_events (
  id SERIAL PRIMARY KEY,
  trip_id INT NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  route_stop_id INT NOT NULL,
  pickup_point_id INT NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
  scheduled_time VARCHAR(20) NOT NULL,
  actual_arrival_time TIMESTAMPTZ NULL,
  actual_departure_time TIMESTAMPTZ NULL,
  delay_minutes INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'arrived', 'departed', 'skipped')),
  is_uncertain INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stop_events_trip ON public.trip_stop_events(trip_id, pickup_point_id);

-- 11. Student Pickup Preferences & Alert Settings
CREATE TABLE IF NOT EXISTS public.student_pickup_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_identifier VARCHAR(80) NOT NULL UNIQUE,
  bus_id INT NULL REFERENCES public.buses(id) ON DELETE SET NULL,
  route_id INT NULL REFERENCES public.routes(id) ON DELETE SET NULL,
  pickup_point_id INT NULL REFERENCES public.pickup_points(id) ON DELETE SET NULL,
  notification_5min_enabled INT NOT NULL DEFAULT 1,
  notification_delay_enabled INT NOT NULL DEFAULT 1,
  notification_trip_start_enabled INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. In-App Notifications Center
CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_identifier VARCHAR(80) NULL,
  bus_id INT NULL REFERENCES public.buses(id) ON DELETE SET NULL,
  route_id INT NULL REFERENCES public.routes(id) ON DELETE SET NULL,
  trip_id INT NULL REFERENCES public.trips(id) ON DELETE SET NULL,
  pickup_point_id INT NULL REFERENCES public.pickup_points(id) ON DELETE SET NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('5min_arrival', 'delay_alert', 'trip_started', 'route_changed', 'service_interruption', 'announcement', 'gps_alert')),
  is_read INT NOT NULL DEFAULT 0,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Web Push Subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_identifier VARCHAR(80) NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  is_active INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Complaints and Grievances
CREATE TABLE IF NOT EXISTS public.complaints (
  id SERIAL PRIMARY KEY,
  reference_no VARCHAR(30) NOT NULL UNIQUE,
  user_id INT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  student_name VARCHAR(120) NOT NULL,
  student_id VARCHAR(50),
  phone VARCHAR(25),
  email VARCHAR(120),
  bus_number VARCHAR(30) NOT NULL,
  route_name VARCHAR(120) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('bus_delay', 'driver_related', 'missed_pickup', 'incorrect_eta', 'gps_issue', 'route_problem', 'vehicle_condition', 'other')),
  description TEXT NOT NULL,
  date_of_incident DATE NOT NULL,
  preferred_contact VARCHAR(30) DEFAULT 'phone',
  status VARCHAR(30) NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Under Review', 'In Progress', 'Resolved', 'Rejected')),
  resolution_notes TEXT NULL,
  resolved_by VARCHAR(120) NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Complaint Updates History
CREATE TABLE IF NOT EXISTS public.complaint_updates (
  id SERIAL PRIMARY KEY,
  complaint_id INT NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  old_status VARCHAR(30) NOT NULL,
  new_status VARCHAR(30) NOT NULL,
  comment TEXT,
  updated_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50) NULL,
  details TEXT NULL,
  ip_address VARCHAR(50) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_stop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY service_role_all_users ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_drivers ON public.drivers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_buses ON public.buses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_routes ON public.routes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_pickup ON public.pickup_points FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_stops ON public.route_stops FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_trips ON public.trips FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_gps ON public.gps_locations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_events ON public.trip_stop_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_notif ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_push ON public.push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_complaints ON public.complaints FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public/Anon Read-Only access to active operational records
CREATE POLICY anon_read_buses ON public.buses FOR SELECT TO anon, authenticated USING (is_active = 1);
CREATE POLICY anon_read_routes ON public.routes FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY anon_read_pickup ON public.pickup_points FOR SELECT TO anon, authenticated USING (is_active = 1);
CREATE POLICY anon_read_stops ON public.route_stops FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY anon_read_trips ON public.trips FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY anon_read_stop_events ON public.trip_stop_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY anon_read_drivers ON public.drivers FOR SELECT TO anon, authenticated USING (status = 'active');

-- ============================================================================
-- INITIAL SEED DATA
-- ============================================================================

INSERT INTO public.users (id, username, password_hash, email, role, full_name, student_id, phone, college_name)
VALUES
  (1, 'admin', '$2a$10$wkIP2u0rEacoFXAvOPTQd.fykV3dMIokdEy39SdbsEEgNMm/V5ixi', 'admin@anjuman.edu', 'admin', 'System Administrator', 'ADM-001', '+91 99024 29000', 'Anjuman Institute of Technology & Management'),
  (2, 'driver1', '$2a$10$QXoXDtpvAe/xXomtLr/Ag.UvDFoz0TrouAKpEGXfAJgZo.CZE2eGG', 'ramesh.driver@anjuman.edu', 'driver', 'Ramesh Kumar', 'DRV-101', '+91 98451 12345', 'Anjuman Institute of Technology & Management'),
  (3, 'driver2', '$2a$10$QXoXDtpvAe/xXomtLr/Ag.UvDFoz0TrouAKpEGXfAJgZo.CZE2eGG', 'suresh.driver@anjuman.edu', 'driver', 'Suresh Naik', 'DRV-102', '+91 98452 67890', 'Anjuman Institute of Technology & Management'),
  (4, 'student1', '$2a$10$IYoJ9p3HrZRN1CdLhX7P2uxJVmo2iTZPU5i2RQI8Vu8Xpbb2FGj9u', 'mohammed.student@anjuman.edu', 'student', 'Mohammed Zaid', '4AI21CS045', '+91 99024 29066', 'Anjuman Institute of Technology & Management')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO public.drivers (id, user_id, full_name, phone, employee_id, license_number, status)
VALUES
  (1, 2, 'Ramesh Kumar', '+91 98451 12345', 'DRV-101', 'KA-47-2015-00431', 'active'),
  (2, 3, 'Suresh Naik', '+91 98452 67890', 'DRV-102', 'KA-47-2018-00982', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pickup_points (id, name, latitude, longitude, landmark, address)
VALUES
  (1, 'Murdeshwar Bus Stand', 14.0940000, 74.4899000, 'Near Temple Arch, NH 66', 'National Highway 66, Murdeshwar, Karnataka 581350'),
  (2, 'Bhatkal Bus Stand', 13.9875000, 74.5510000, 'Main KSRTC Bus Stand', 'Near Shamsuddin Circle, Bhatkal, Karnataka 581320'),
  (3, 'Shirali Bus Stop', 14.0321000, 74.5262000, 'Near Al-Kausar Hospital', 'NH 66, Shirali, Karnataka 581354'),
  (4, 'College Main Gate', 13.9782000, 74.5750000, 'Anjuman College Campus Entrance', 'Anjumanabad, Bhatkal, Karnataka 581320'),
  (5, 'Kumta Old Bus Stand', 14.4285000, 74.4215000, 'Opposite Post Office', 'Main Road, Kumta, Karnataka 581343'),
  (6, 'Honnavar Circle', 14.2798000, 74.4442000, 'Sharavathi Bridge Junction', 'Honnavar Town Circle, Karnataka 581334'),
  (7, 'Manki Junction', 14.1850000, 74.4680000, 'Near NH Toll Gate', 'NH 66, Manki, Karnataka 581348'),
  (8, 'Tengingundi Cross', 14.0042000, 74.5428000, 'Tengingundi Coastal Road Cross', 'NH 66 Junction, Bhatkal Taluk, Karnataka 581320')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.routes (id, route_name, start_point, destination, operating_days, status, total_distance_km, estimated_duration_mins, route_version)
VALUES
  (1, 'Murdeshwar to College', 'Murdeshwar Bus Stand', 'College Main Gate', 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', 'active', 28.5, 55, 1),
  (2, 'Kumta to College', 'Kumta Old Bus Stand', 'College Main Gate', 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', 'active', 64.0, 75, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.route_stops (id, route_id, pickup_point_id, stop_sequence, scheduled_arrival_time, scheduled_departure_time, distance_from_prev_km)
VALUES
  (1, 1, 1, 1, '07:30:00', '07:35:00', 0.0),
  (2, 1, 3, 2, '07:45:00', '07:50:00', 8.5),
  (3, 1, 2, 3, '07:55:00', '08:00:00', 6.8),
  (4, 1, 4, 4, '08:25:00', '08:30:00', 4.5),
  (5, 2, 5, 1, '07:15:00', '07:20:00', 0.0),
  (6, 2, 6, 2, '07:40:00', '07:45:00', 18.5),
  (7, 2, 7, 3, '08:00:00', '08:05:00', 21.0),
  (8, 2, 4, 4, '08:30:00', '08:35:00', 24.5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.buses (id, bus_number, bus_name, registration_number, capacity, assigned_driver_id, assigned_route_id, status, gps_status, last_latitude, last_longitude, last_speed, last_heading, is_active)
VALUES
  (1, 'KA-47-A-1234', 'College Bus 01', 'KA47A1234', 52, 1, 1, 'not_started', 'waiting_signal', 14.0940000, 74.4899000, 0.0, 180.0, 1),
  (2, 'KA-47-B-5678', 'College Bus 02', 'KA47B5678', 52, 2, 2, 'not_started', 'waiting_signal', 14.4285000, 74.4215000, 0.0, 165.0, 1)
ON CONFLICT (id) DO NOTHING;

SELECT setval('public.users_id_seq', (SELECT MAX(id) FROM public.users));
SELECT setval('public.drivers_id_seq', (SELECT MAX(id) FROM public.drivers));
SELECT setval('public.pickup_points_id_seq', (SELECT MAX(id) FROM public.pickup_points));
SELECT setval('public.routes_id_seq', (SELECT MAX(id) FROM public.routes));
SELECT setval('public.route_stops_id_seq', (SELECT MAX(id) FROM public.route_stops));
SELECT setval('public.buses_id_seq', (SELECT MAX(id) FROM public.buses));
