-- ============================================================================
-- Smart College Bus Transportation System
-- Complete Relational Database Schema (MySQL 8.0+)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS smart_bus_tracking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_bus_tracking;

-- 1. Users Table (Students, Admins, Drivers)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(120),
  role ENUM('student', 'admin', 'driver') NOT NULL DEFAULT 'student',
  full_name VARCHAR(120) NOT NULL,
  student_id VARCHAR(50),
  phone VARCHAR(25),
  college_name VARCHAR(150) DEFAULT 'Anjuman Institute of Technology & Management',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_student_id (student_id)
) ENGINE=InnoDB;

-- 2. Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(25) NOT NULL,
  employee_id VARCHAR(50),
  license_number VARCHAR(50),
  status ENUM('active', 'inactive', 'on_duty') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_driver_status (status)
) ENGINE=InnoDB;

-- 3. Predefined Routes
CREATE TABLE IF NOT EXISTS routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_name VARCHAR(120) NOT NULL,
  start_point VARCHAR(100) NOT NULL,
  destination VARCHAR(100) NOT NULL,
  operating_days VARCHAR(100) NOT NULL DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  total_distance_km DECIMAL(6,2) DEFAULT 0.00,
  estimated_duration_mins INT DEFAULT 45,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_routes_status (status)
) ENGINE=InnoDB;

-- 4. Pickup Points / Bus Stops Master Table
CREATE TABLE IF NOT EXISTS pickup_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  landmark VARCHAR(150),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pickup_coords (latitude, longitude)
) ENGINE=InnoDB;

-- 5. Route Stops (Ordered stops along a specific route)
CREATE TABLE IF NOT EXISTS route_stops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL,
  pickup_point_id INT NOT NULL,
  stop_sequence INT NOT NULL,
  scheduled_arrival_time TIME NOT NULL,
  scheduled_departure_time TIME NOT NULL,
  distance_from_prev_km DECIMAL(6,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  FOREIGN KEY (pickup_point_id) REFERENCES pickup_points(id) ON DELETE CASCADE,
  UNIQUE KEY uq_route_stop_seq (route_id, stop_sequence),
  INDEX idx_route_stops_pickup (pickup_point_id)
) ENGINE=InnoDB;

-- 6. Buses Table
CREATE TABLE IF NOT EXISTS buses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_number VARCHAR(30) NOT NULL UNIQUE,
  bus_name VARCHAR(80) NOT NULL,
  registration_number VARCHAR(50),
  capacity INT DEFAULT 50,
  assigned_driver_id INT NULL,
  assigned_route_id INT NULL,
  status ENUM('not_started', 'running_on_time', 'approaching_pickup', 'delayed', 'trip_completed', 'gps_unavailable') NOT NULL DEFAULT 'not_started',
  gps_status ENUM('active', 'stale', 'offline', 'waiting_signal') NOT NULL DEFAULT 'waiting_signal',
  last_latitude DECIMAL(10, 7) NULL,
  last_longitude DECIMAL(10, 7) NULL,
  last_speed DECIMAL(5, 2) DEFAULT 0.00,
  last_heading DECIMAL(5, 2) DEFAULT 0.00,
  last_gps_timestamp TIMESTAMP NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_route_id) REFERENCES routes(id) ON DELETE SET NULL,
  INDEX idx_buses_status (status),
  INDEX idx_buses_gps (gps_status)
) ENGINE=InnoDB;

-- 7. Route Schedules (Operating schedule by day)
CREATE TABLE IF NOT EXISTS route_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  INDEX idx_schedules_day (route_id, day_of_week)
) ENGINE=InnoDB;

-- 8. Bus Assignments History
CREATE TABLE IF NOT EXISTS bus_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_id INT NOT NULL,
  driver_id INT NOT NULL,
  route_id INT NOT NULL,
  assignment_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Trips (Active and Historical Trip Lifecycle)
CREATE TABLE IF NOT EXISTS trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bus_id INT NOT NULL,
  driver_id INT NOT NULL,
  route_id INT NOT NULL,
  trip_date DATE NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NULL,
  status ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'delayed') NOT NULL DEFAULT 'scheduled',
  start_lat DECIMAL(10, 7) NULL,
  start_lng DECIMAL(10, 7) NULL,
  end_lat DECIMAL(10, 7) NULL,
  end_lng DECIMAL(10, 7) NULL,
  delay_mins INT NOT NULL DEFAULT 0,
  delay_reason VARCHAR(255) NULL,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  INDEX idx_trips_date_bus (bus_id, trip_date),
  INDEX idx_trips_status (status)
) ENGINE=InnoDB;

-- 10. GPS Locations (Ingested Coordinates Stream)
CREATE TABLE IF NOT EXISTS gps_locations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  bus_id INT NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  speed DECIMAL(5, 2) DEFAULT 0.00,
  heading DECIMAL(5, 2) DEFAULT 0.00,
  accuracy DECIMAL(6, 2) DEFAULT 0.00,
  altitude DECIMAL(6, 2) NULL,
  is_valid TINYINT(1) NOT NULL DEFAULT 1,
  is_stale TINYINT(1) NOT NULL DEFAULT 0,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
  INDEX idx_gps_trip_time (trip_id, timestamp),
  INDEX idx_gps_bus_time (bus_id, timestamp)
) ENGINE=InnoDB;

-- 11. Trip Stop Arrival & Departure Events (Actual vs Scheduled)
CREATE TABLE IF NOT EXISTS trip_stop_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  route_stop_id INT NOT NULL,
  pickup_point_id INT NOT NULL,
  scheduled_time TIME NOT NULL,
  actual_arrival_time DATETIME NULL,
  actual_departure_time DATETIME NULL,
  delay_minutes INT NOT NULL DEFAULT 0,
  status ENUM('scheduled', 'arrived', 'departed', 'skipped') NOT NULL DEFAULT 'scheduled',
  is_uncertain TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (route_stop_id) REFERENCES route_stops(id) ON DELETE CASCADE,
  FOREIGN KEY (pickup_point_id) REFERENCES pickup_points(id) ON DELETE CASCADE,
  INDEX idx_stop_events_trip (trip_id, pickup_point_id)
) ENGINE=InnoDB;

-- 12. Student Pickup Preferences & Settings
CREATE TABLE IF NOT EXISTS student_pickup_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  student_identifier VARCHAR(80) NOT NULL,
  bus_id INT NULL,
  route_id INT NULL,
  pickup_point_id INT NULL,
  notification_5min_enabled TINYINT(1) NOT NULL DEFAULT 1,
  notification_delay_enabled TINYINT(1) NOT NULL DEFAULT 1,
  notification_trip_start_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
  FOREIGN KEY (pickup_point_id) REFERENCES pickup_points(id) ON DELETE SET NULL,
  UNIQUE KEY uq_pref_student (student_identifier)
) ENGINE=InnoDB;

-- 13. Notifications Center
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  student_identifier VARCHAR(80) NULL,
  bus_id INT NULL,
  route_id INT NULL,
  trip_id INT NULL,
  pickup_point_id INT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  category ENUM('5min_arrival', 'delay_alert', 'trip_started', 'route_changed', 'service_interruption', 'announcement', 'gps_alert') NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE SET NULL,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL,
  INDEX idx_notif_student (student_identifier),
  INDEX idx_notif_category (category)
) ENGINE=InnoDB;

-- 14. Web Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  student_identifier VARCHAR(80) NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_push_student (student_identifier)
) ENGINE=InnoDB;

-- 15. Complaints and Feedback
CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_no VARCHAR(30) NOT NULL UNIQUE,
  user_id INT NULL,
  student_name VARCHAR(120) NOT NULL,
  student_id VARCHAR(50),
  phone VARCHAR(25),
  email VARCHAR(120),
  bus_number VARCHAR(30) NOT NULL,
  route_name VARCHAR(120) NOT NULL,
  category ENUM('bus_delay', 'driver_related', 'missed_pickup', 'incorrect_eta', 'gps_issue', 'route_problem', 'vehicle_condition', 'other') NOT NULL,
  description TEXT NOT NULL,
  date_of_incident DATE NOT NULL,
  preferred_contact VARCHAR(30) DEFAULT 'phone',
  status ENUM('New', 'Under Review', 'In Progress', 'Resolved', 'Rejected') NOT NULL DEFAULT 'New',
  resolution_notes TEXT NULL,
  resolved_by VARCHAR(120) NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_complaint_status (status),
  INDEX idx_complaint_ref (reference_no)
) ENGINE=InnoDB;

-- 16. Complaint Updates & Audit History
CREATE TABLE IF NOT EXISTS complaint_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_id INT NOT NULL,
  old_status VARCHAR(30) NOT NULL,
  new_status VARCHAR(30) NOT NULL,
  comment TEXT,
  updated_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 17. Delay Events Log
CREATE TABLE IF NOT EXISTS delay_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  bus_id INT NOT NULL,
  route_stop_id INT NULL,
  scheduled_time TIME NULL,
  estimated_time TIME NULL,
  delay_minutes INT NOT NULL,
  reason VARCHAR(255) DEFAULT 'Traffic Delay',
  is_manual TINYINT(1) NOT NULL DEFAULT 0,
  notified_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 18. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50) NULL,
  details TEXT NULL,
  ip_address VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
