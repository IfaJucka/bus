-- ============================================================================
-- Smart College Bus Transportation System
-- Development Seeds File
-- ============================================================================

USE smart_bus_tracking;

-- 1. Users
-- Default passwords:
-- admin: admin123  ($2a$10$tZ9w.M3jJ2m1c5B0o0sA5eDkWq6p8vK4jL0zZ3xY7vU9nQ2rS4m1K - placeholder, will seed via API/service)
INSERT INTO users (id, username, password_hash, email, role, full_name, student_id, phone, college_name)
VALUES
(1, 'admin', '$2a$10$qR6H65s8Q8W1N9aJ5J5VneS4z8H3m2P7l4t9W1q3Z5x7Y9k1M3n5O', 'admin@anjuman.edu', 'admin', 'System Administrator', 'ADM-001', '+91 99024 29000', 'Anjuman Institute of Technology & Management'),
(2, 'driver1', '$2a$10$qR6H65s8Q8W1N9aJ5J5VneS4z8H3m2P7l4t9W1q3Z5x7Y9k1M3n5O', 'ramesh.driver@anjuman.edu', 'driver', 'Ramesh Kumar', 'DRV-101', '+91 98451 12345', 'Anjuman Institute of Technology & Management'),
(3, 'driver2', '$2a$10$qR6H65s8Q8W1N9aJ5J5VneS4z8H3m2P7l4t9W1q3Z5x7Y9k1M3n5O', 'suresh.driver@anjuman.edu', 'driver', 'Suresh Naik', 'DRV-102', '+91 98452 67890', 'Anjuman Institute of Technology & Management'),
(4, 'student1', '$2a$10$qR6H65s8Q8W1N9aJ5J5VneS4z8H3m2P7l4t9W1q3Z5x7Y9k1M3n5O', 'mohammed.student@anjuman.edu', 'student', 'Mohammed Zaid', '4AI21CS045', '+91 99024 29066', 'Anjuman Institute of Technology & Management')
ON DUPLICATE KEY UPDATE id=id;

-- 2. Drivers
INSERT INTO drivers (id, user_id, full_name, phone, employee_id, license_number, status)
VALUES
(1, 2, 'Ramesh Kumar', '+91 98451 12345', 'DRV-101', 'KA-47-2015-00431', 'active'),
(2, 3, 'Suresh Naik', '+91 98452 67890', 'DRV-102', 'KA-47-2018-00982', 'active')
ON DUPLICATE KEY UPDATE id=id;

-- 3. Predefined Routes
INSERT INTO routes (id, route_name, start_point, destination, operating_days, status, total_distance_km, estimated_duration_mins)
VALUES
(1, 'Murdeshwar to College', 'Murdeshwar Bus Stand', 'College Main Gate', 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', 'active', 28.5, 55),
(2, 'Kumta to College', 'Kumta Old Bus Stand', 'College Main Gate', 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', 'active', 64.0, 75)
ON DUPLICATE KEY UPDATE id=id;

-- 4. Pickup Points
INSERT INTO pickup_points (id, name, latitude, longitude, landmark, is_active)
VALUES
(1, 'Murdeshwar Bus Stand', 14.0940000, 74.4899000, 'Near Temple Arch, NH 66', 1),
(2, 'Bhatkal Bus Stand', 13.9875000, 74.5510000, 'Main KSRTC Bus Stand', 1),
(3, 'Shirali Bus Stop', 14.0321000, 74.5262000, 'Near Al-Kausar Hospital', 1),
(4, 'College Main Gate', 13.9782000, 74.5750000, 'Anjuman College Campus Entrance', 1),
(5, 'Kumta Old Bus Stand', 14.4285000, 74.4215000, 'Opposite Post Office', 1),
(6, 'Honnavar Circle', 14.2798000, 74.4442000, 'Sharavathi Bridge Junction', 1),
(7, 'Manki Junction', 14.1850000, 74.4680000, 'Near NH Toll Gate', 1)
ON DUPLICATE KEY UPDATE id=id;

-- 5. Route Stops
-- Route 1: Murdeshwar -> Bhatkal -> Shirali -> College
INSERT INTO route_stops (id, route_id, pickup_point_id, stop_sequence, scheduled_arrival_time, scheduled_departure_time, distance_from_prev_km)
VALUES
(1, 1, 1, 1, '07:30:00', '07:35:00', 0.00),
(2, 1, 2, 2, '07:45:00', '07:50:00', 14.20),
(3, 1, 3, 3, '07:55:00', '08:00:00', 6.80),
(4, 1, 4, 4, '08:25:00', '08:30:00', 7.50),
-- Route 2: Kumta -> Honnavar -> Manki -> College
(5, 2, 5, 1, '07:15:00', '07:20:00', 0.00),
(6, 2, 6, 2, '07:40:00', '07:45:00', 18.50),
(7, 2, 7, 3, '08:00:00', '08:05:00', 21.00),
(8, 2, 4, 4, '08:30:00', '08:35:00', 24.50)
ON DUPLICATE KEY UPDATE id=id;

-- 6. Buses
INSERT INTO buses (id, bus_number, bus_name, registration_number, capacity, assigned_driver_id, assigned_route_id, status, gps_status, last_latitude, last_longitude, last_speed, last_heading, last_gps_timestamp)
VALUES
(1, 'KA-47-A-1234', 'College Bus 01', 'KA47A1234', 52, 1, 1, 'not_started', 'waiting_signal', 14.0940000, 74.4899000, 0.00, 180.00, NOW()),
(2, 'KA-47-B-5678', 'College Bus 02', 'KA47B5678', 52, 2, 2, 'not_started', 'waiting_signal', 14.4285000, 74.4215000, 0.00, 165.00, NOW())
ON DUPLICATE KEY UPDATE id=id;

-- 7. Route Operating Schedules
INSERT INTO route_schedules (route_id, day_of_week, departure_time, arrival_time)
VALUES
(1, 'Monday', '07:30:00', '08:25:00'),
(1, 'Tuesday', '07:30:00', '08:25:00'),
(1, 'Wednesday', '07:30:00', '08:25:00'),
(1, 'Thursday', '07:30:00', '08:25:00'),
(1, 'Friday', '07:30:00', '08:25:00'),
(1, 'Saturday', '07:30:00', '08:25:00'),
(2, 'Monday', '07:15:00', '08:30:00'),
(2, 'Tuesday', '07:15:00', '08:30:00'),
(2, 'Wednesday', '07:15:00', '08:30:00'),
(2, 'Thursday', '07:15:00', '08:30:00'),
(2, 'Friday', '07:15:00', '08:30:00'),
(2, 'Saturday', '07:15:00', '08:30:00')
ON DUPLICATE KEY UPDATE id=id;

-- 8. Student Preferences
INSERT INTO student_pickup_preferences (user_id, student_identifier, bus_id, route_id, pickup_point_id, notification_5min_enabled, notification_delay_enabled)
VALUES
(4, '4AI21CS045', 1, 1, 2, 1, 1)
ON DUPLICATE KEY UPDATE id=id;

-- 9. Sample Initial Notifications
INSERT INTO notifications (user_id, student_identifier, bus_id, route_id, title, message, category, is_read)
VALUES
(4, '4AI21CS045', 1, 1, 'Welcome to Smart College Bus Tracking', 'You have selected Bhatkal Bus Stand as your preferred pickup point for Bus KA-47-A-1234.', 'announcement', 0),
(4, '4AI21CS045', 1, 1, 'Push Notifications Available', 'Enable browser push notifications to receive real-time 5-minute arrival and delay alerts.', 'announcement', 0);

-- 10. Sample Complaint
INSERT INTO complaints (id, reference_no, user_id, student_name, student_id, phone, email, bus_number, route_name, category, description, date_of_incident, preferred_contact, status, resolution_notes)
VALUES
(1, 'CMP-1001', 4, 'Mohammed Zaid', '4AI21CS045', '+91 99024 29066', 'mohammed.student@anjuman.edu', 'KA-47-A-1234', 'Murdeshwar to College', 'bus_delay', 'Bus arrived 12 minutes late due to traffic at Bhatkal circle on Monday.', CURDATE() - INTERVAL 2 DAY, 'phone', 'Resolved', 'Investigated: Highway repair work caused temporary slowdown. Extra time allocated in morning schedule.')
ON DUPLICATE KEY UPDATE id=id;
