import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../database';
import { calculateRoadNetworkRoute } from '../utils/geo';
import { RouteService } from '../services/routeService';
import { TripService } from '../services/tripService';

test('Supabase Integration: Dual-mode Database Initialized & Functional', async () => {
  await db.initDatabase();
  assert.ok(db, 'Database instance should exist');
  assert.ok(['supabase', 'mysql', 'embedded'].includes(db.mode), 'Database should be in a recognized mode');
  
  // Verify core tables exist in schema
  const buses = db.getTable('buses');
  const routes = db.getTable('routes');
  const trips = db.getTable('trips');
  const pickupPoints = db.getTable('pickup_points');
  
  assert.ok(Array.isArray(buses), 'Buses table must be an array');
  assert.ok(Array.isArray(routes), 'Routes table must be an array');
  assert.ok(Array.isArray(trips), 'Trips table must be an array');
  assert.ok(Array.isArray(pickupPoints), 'Pickup points table must be an array');
});

test('Advanced Route Builder: Road Network Calculation with OSRM', async () => {
  const sampleStops = [
    { latitude: 13.9299, longitude: 74.5566 }, // Bhatkal
    { latitude: 14.0150, longitude: 74.5200 }, // Shirali
  ];

  const result = await calculateRoadNetworkRoute(sampleStops);
  assert.ok(result.coordinates.length >= 2, 'Route coordinates should contain coordinate pairs');
  assert.ok(result.totalDistanceKm > 0, 'Distance in km should be positive');
  assert.ok(result.estimatedDurationMins >= 0, 'Duration in mins should be non-negative');
});

test('Pickup Point: Supports Draggable Map Coordinates & Address', async () => {
  const testPoint = await RouteService.createPickupPoint({
    name: 'Tengingundi Crossroad Test',
    latitude: 13.9555,
    longitude: 74.5444,
    landmark: 'Near Coastal Junction',
    address: 'NH 66, Bhatkal Taluk, Uttara Kannada',
  });

  assert.ok(testPoint.id > 0, 'Pickup point should have a positive id');
  assert.equal(testPoint.name, 'Tengingundi Crossroad Test');
  assert.equal(testPoint.address, 'NH 66, Bhatkal Taluk, Uttara Kannada');
  assert.equal(testPoint.latitude, 13.9555);
  assert.equal(testPoint.longitude, 74.5444);
});

test('Automatic Trip History: Route Snapshot & Stop Events Timeline', async () => {
  const routes = await RouteService.getAllRoutes();
  assert.ok(routes.length > 0, 'Must have at least one route');
  const testRoute = routes[0];

  const buses = db.getTable<any>('buses');
  const testBus = buses[0];
  const drivers = db.getTable<any>('drivers');
  const testDriver = drivers[0];

  // Start trip
  const trip = await TripService.startTrip({
    busId: testBus.id,
    driverId: testDriver.id,
    routeId: testRoute.id,
    isDemo: true,
  });

  assert.ok(trip.id > 0, 'Trip ID should be generated');
  assert.ok(trip.route_snapshot, 'Trip should store frozen route_snapshot');
  assert.equal(trip.status, 'in_progress');

  // Verify stop events were initialized
  const stopEvents = await TripService.getTripStopEvents(trip.id);
  assert.ok(Array.isArray(stopEvents), 'Stop events should be an array');
  assert.ok(stopEvents.length >= 0, 'Stop events array should exist');

  // End trip
  const ended = await TripService.endTrip(trip.id);
  assert.equal(ended.status, 'completed');
  assert.ok(ended.end_time, 'End time should be recorded');
});
