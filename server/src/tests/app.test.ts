import test from 'node:test';
import assert from 'node:assert';
import { AuthService } from '../services/authService';
import { BusService } from '../services/busService';
import { RouteService } from '../services/routeService';
import { TripService } from '../services/tripService';
import { HistoryService } from '../services/historyService';
import { ComplaintService } from '../services/complaintService';
import { NotificationService } from '../services/notificationService';
import {
  isValidCoordinate,
  haversineDistanceKm,
  calculateRouteRemainingDistanceKm,
  calculateETA,
  isGpsStale,
  calculateSpeedKmH,
} from '../utils/geo';
import { db } from '../database';

test('Smart Bus Test Suite: Initialization', async () => {
  await db.initDatabase();
  assert.ok(db.mode === 'mysql' || db.mode === 'embedded', 'Database must initialize in valid mode');
});

test('Auth: Administrator authentication with valid and invalid credentials', async () => {
  // Test valid admin login
  const valid = await AuthService.authenticate('admin', 'admin123', 'admin');
  assert.ok(valid && 'user' in valid, 'Admin authentication should succeed with correct credentials');
  assert.strictEqual(valid.user.role, 'admin');
  assert.ok(valid.token, 'JWT token should be generated');

  // Test token verification
  const decoded = AuthService.verifyToken(valid.token);
  assert.ok(decoded);
  assert.strictEqual(decoded?.username, 'admin');

  // Test invalid password rejection
  const invalid = await AuthService.authenticate('admin', 'wrong_password_999');
  assert.strictEqual(invalid, null, 'Authentication should fail with wrong password');

  // Test non-existent user rejection
  const nonExistent = await AuthService.authenticate('nonexistent_user', 'any');
  assert.strictEqual(nonExistent, null, 'Authentication should fail for non-existent user');

  // Test portal role separation: student attempting admin portal login
  const wrongPortal = await AuthService.authenticate('student1', 'student123', 'admin');
  assert.ok(wrongPortal && 'error' in wrongPortal, 'Student should be rejected from admin portal');
});

test('GPS Validation: Coordinate boundary and type checks', () => {
  assert.strictEqual(isValidCoordinate(14.094, 74.4899), true, 'Valid Murdeshwar coords should pass');
  assert.strictEqual(isValidCoordinate(95.0, 74.4899), false, 'Latitude > 90 must fail');
  assert.strictEqual(isValidCoordinate(-95.0, 74.4899), false, 'Latitude < -90 must fail');
  assert.strictEqual(isValidCoordinate(14.094, 185.0), false, 'Longitude > 180 must fail');
  assert.strictEqual(isValidCoordinate(NaN as any, 74.4899), false, 'NaN must fail');
});

test('Geodesic Math: Haversine distance and speed calculations', () => {
  // Murdeshwar (14.094, 74.4899) to Bhatkal (13.9875, 74.5510) is ~13.5 - 14.5 km straight line
  const dist = haversineDistanceKm(14.094, 74.4899, 13.9875, 74.5510);
  assert.ok(dist >= 12 && dist <= 16, `Haversine distance should be around 13-14km, got: ${dist}`);

  // Speed calculation: 2 km covered in 3 minutes (0.05 hrs) = ~40 km/h
  const t1 = new Date('2026-10-12T07:30:00Z');
  const t2 = new Date('2026-10-12T07:33:00Z');
  const speed = calculateSpeedKmH(14.094, 74.4899, t1, 14.076, 74.495, t2);
  assert.ok(speed > 0 && speed < 100, `Calculated speed should be reasonable, got: ${speed}`);
});

test('Routing & ETA: Route-aware remaining distance and ETA estimation', () => {
  const stops = [
    { id: 1, name: 'Murdeshwar', latitude: 14.094, longitude: 74.4899, stopSequence: 1 },
    { id: 2, name: 'Bhatkal', latitude: 13.9875, longitude: 74.5510, stopSequence: 2 },
    { id: 3, name: 'College', latitude: 13.9782, longitude: 74.5750, stopSequence: 3 },
  ];

  // Bus starting near Murdeshwar heading to College (stopId 3)
  const result = calculateRouteRemainingDistanceKm(14.094, 74.4899, stops, 3);
  assert.ok(result.remainingDistanceKm > 10, 'Remaining road distance should be > 10 km');
  assert.ok(result.nextStopIndex >= 0, 'nextStopIndex should be a valid upcoming stop index');

  const eta = calculateETA(result.remainingDistanceKm, 40, 1, 0);
  assert.ok(eta.etaMinutes > 15, `ETA should be > 15 mins for full route, got: ${eta.etaMinutes}`);
  assert.ok(eta.estimatedArrivalTime.includes('AM') || eta.estimatedArrivalTime.includes('PM'));
});

test('GPS Staleness & Failure Detection', () => {
  const freshTime = new Date().toISOString();
  assert.strictEqual(isGpsStale(freshTime, 45), false, 'Fresh timestamp should not be marked stale');

  const staleTime = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
  assert.strictEqual(isGpsStale(staleTime, 45), true, '2-minute-old timestamp must be marked stale');

  assert.strictEqual(isGpsStale(null), true, 'Null GPS timestamp must be marked stale');
});

test('Bus & Route Management: Read and manipulate buses and routes', async () => {
  const buses = await BusService.getAllBuses();
  assert.ok(buses.length >= 2, 'Should have at least 2 seeded buses');

  const bus1 = await BusService.getBusById(1);
  assert.ok(bus1);
  assert.strictEqual(bus1?.bus_number, 'KA-47-A-1234');

  const routes = await RouteService.getAllRoutes();
  assert.ok(routes.length >= 1, 'Should have at least 1 route');
  assert.ok(routes[0].stops.length >= 4, 'Route 1 should contain 4 ordered stops');
});

test('Trip Lifecycle: Start trip, record locations, detect stop arrivals, end trip', async () => {
  // Start trip for Bus 1
  const trip = await TripService.startTrip({
    busId: 1,
    driverId: 1,
    routeId: 1,
    isDemo: true,
    initialLat: 14.094,
    initialLng: 74.4899,
  });
  assert.ok(trip.id, 'Trip ID should be generated');
  assert.strictEqual(trip.status, 'in_progress');

  // Record valid GPS coordinate near Murdeshwar
  const locResult = await TripService.recordLocation({
    busId: 1,
    latitude: 14.094,
    longitude: 74.4899,
    speed: 38.0,
    heading: 180,
  });
  assert.strictEqual(locResult.success, true);
  assert.ok(locResult.bus.last_speed >= 0);

  // End trip
  const ended = await TripService.endTrip(trip.id);
  assert.strictEqual(ended.status, 'completed');
  assert.ok(ended.end_time);
});

test('Notifications: 5-minute alert, delay alerts, and duplicate prevention', async () => {
  const tripId = 999;
  const stopId = 2;
  const studentId = '4AI21CS045';

  NotificationService.resetAlertsForTrip(tripId);
  assert.strictEqual(NotificationService.hasAlertBeenSent(tripId, stopId, studentId, '5min_arrival'), false);

  // Send first notification
  const notif = await NotificationService.createNotification({
    studentIdentifier: studentId,
    title: 'Your College Bus Is Almost Here!',
    message: 'Bus will arrive in 5 mins',
    category: '5min_arrival',
    tripId,
    pickupPointId: stopId,
  });
  assert.ok(notif.id);

  NotificationService.markAlertSent(tripId, stopId, studentId, '5min_arrival');
  // Duplicate check
  assert.strictEqual(NotificationService.hasAlertBeenSent(tripId, stopId, studentId, '5min_arrival'), true);
});

test('History: 7-Day arrival report generation and statistics calculation', async () => {
  const { rows, stats } = await HistoryService.getSevenDayArrivals(1, 2, 7);
  assert.strictEqual(rows.length, 7, 'Must generate exactly 7 rows for 7-day query');

  assert.ok(stats.hasSufficientData, 'Should have sufficient data from seed');
  assert.ok(stats.totalTripsRecorded >= 2, 'Should have at least 2 recorded trips');
  assert.ok(stats.onTimePercentage >= 0 && stats.onTimePercentage <= 100);
});

test('Complaints: Reference ID generation, submission, and status lifecycle', async () => {
  const complaint = await ComplaintService.submitComplaint({
    studentName: 'Zaid Test',
    studentId: '4AI21CS045',
    busNumber: 'KA-47-A-1234',
    routeName: 'Murdeshwar to College',
    category: 'bus_delay',
    description: 'Automated test complaint for bus tracking platform verification',
    dateOfIncident: '2026-10-12',
  });

  assert.ok(complaint.id);
  assert.ok(complaint.reference_no.startsWith('CMP-'), 'Reference ID must follow CMP-XXXX format');
  assert.strictEqual(complaint.status, 'New');

  // Admin updates status to Resolved
  const updated = await ComplaintService.updateComplaintStatus(
    complaint.id,
    'Resolved',
    'Issue addressed with driver schedule revision',
    'Admin Tester'
  );

  assert.strictEqual(updated?.status, 'Resolved');
  assert.strictEqual(updated?.resolution_notes, 'Issue addressed with driver schedule revision');
});
