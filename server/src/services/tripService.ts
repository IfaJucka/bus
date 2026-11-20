import { db } from '../database';
import { BusService } from './busService';
import { RouteService } from './routeService';
import { NotificationService } from './notificationService';
import {
  isValidCoordinate,
  calculateRouteRemainingDistanceKm,
  calculateETA,
  isNearStop,
  calculateSpeedKmH,
} from '../utils/geo';

export interface ActiveTrip {
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
  route_snapshot?: any;
}

export class TripService {
  /**
   * Start a new active trip
   */
  public static async startTrip(data: {
    busId: number;
    driverId: number;
    routeId: number;
    isDemo?: boolean;
    initialLat?: number;
    initialLng?: number;
  }): Promise<ActiveTrip> {
    const bus = await BusService.getBusById(data.busId);
    if (!bus) throw new Error('Bus not found');

    const route = await RouteService.getRouteById(data.routeId);
    if (!route) throw new Error('Route not found');

    // Prevent duplicate active trips for the same bus
    const existingActive = await this.getActiveTripForBus(data.busId);
    if (existingActive) {
      return existingActive;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toISOString();

    const tripRecord: any = {
      bus_id: data.busId,
      driver_id: data.driverId,
      route_id: data.routeId,
      trip_date: dateStr,
      start_time: timeStr,
      end_time: null,
      status: 'in_progress' as const,
      start_lat: data.initialLat || bus.last_latitude || (route.stops[0]?.latitude ?? 14.094),
      start_lng: data.initialLng || bus.last_longitude || (route.stops[0]?.longitude ?? 74.4899),
      end_lat: null,
      end_lng: null,
      delay_mins: 0,
      delay_reason: null,
      is_demo: data.isDemo ? 1 : 0,
      route_snapshot: {
        route_id: route.id,
        route_name: route.route_name,
        start_point: route.start_point,
        destination: route.destination,
        version: (route as any).route_version || 1,
        stops: route.stops.map((s) => ({
          pickup_point_id: s.pickup_point_id,
          stop_name: s.stop_name,
          sequence: s.stop_sequence,
          scheduled_arrival_time: s.scheduled_arrival_time,
          scheduled_departure_time: s.scheduled_departure_time,
          latitude: s.latitude,
          longitude: s.longitude,
          landmark: s.landmark,
        })),
        road_geometry: (route as any).road_geometry || null,
      },
    };

    let tripId: number;

    if (db.mode === 'mysql' && db.getPool()) {
      const res: any = await db.query(
        `INSERT INTO trips (bus_id, driver_id, route_id, trip_date, start_time, status, start_lat, start_lng, is_demo)
         VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)`,
        [tripRecord.bus_id, tripRecord.driver_id, tripRecord.route_id, tripRecord.trip_date, tripRecord.start_time, tripRecord.start_lat, tripRecord.start_lng, tripRecord.is_demo]
      );
      tripId = res.insertId;

      // Seed scheduled stop events for this trip
      for (const stop of route.stops) {
        await db.query(
          `INSERT INTO trip_stop_events (trip_id, route_stop_id, pickup_point_id, scheduled_time, status)
           VALUES (?, ?, ?, ?, 'scheduled')`,
          [tripId, stop.id, stop.pickup_point_id, stop.scheduled_arrival_time]
        );
      }
    } else {
      const saved = db.insertRecord('trips', tripRecord);
      tripId = saved.id;

      for (const stop of route.stops) {
        db.insertRecord('trip_stop_events', {
          trip_id: tripId,
          route_stop_id: stop.id,
          pickup_point_id: stop.pickup_point_id,
          scheduled_time: stop.scheduled_arrival_time,
          actual_arrival_time: null,
          actual_departure_time: null,
          delay_minutes: 0,
          status: 'scheduled',
          is_uncertain: 0,
        });
      }
    }

    // Update bus state
    await BusService.updateBus(data.busId, {
      status: 'running_on_time',
      gps_status: 'active',
      last_latitude: tripRecord.start_lat,
      last_longitude: tripRecord.start_lng,
      last_gps_timestamp: timeStr,
      assigned_driver_id: data.driverId,
      assigned_route_id: data.routeId,
    });

    NotificationService.resetAlertsForTrip(tripId);

    // Send Trip Started announcement
    await NotificationService.createNotification({
      busId: data.busId,
      routeId: data.routeId,
      tripId: tripId,
      title: `Bus ${bus.bus_number} Started Trip`,
      message: `${bus.bus_name} has departed from ${route.start_point} towards ${route.destination}. Live GPS tracking is active.`,
      category: 'trip_started',
    });

    return (await this.getTripById(tripId))!;
  }

  /**
   * Ingest GPS location from driver or GPS device
   */
  public static async recordLocation(data: {
    busId: number;
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    timestamp?: string;
    isDemo?: boolean;
  }): Promise<{
    success: boolean;
    bus: any;
    etaMinutes: number;
    nextStopName: string;
    distanceRemainingKm: number;
    delayMinutes: number;
  }> {
    if (!isValidCoordinate(data.latitude, data.longitude)) {
      throw new Error(`Invalid GPS coordinates: lat=${data.latitude}, lng=${data.longitude}`);
    }

    const bus = await BusService.getBusById(data.busId);
    if (!bus) throw new Error('Bus not found');

    const activeTrip = await this.getActiveTripForBus(data.busId);
    const tripId = activeTrip?.id || 1;
    
    // Parse timestamp safely: use client device timestamp if valid, otherwise fallback to current server time
    let timestampStr: string;
    if (data.timestamp && !isNaN(new Date(data.timestamp).getTime())) {
      timestampStr = new Date(data.timestamp).toISOString();
    } else {
      timestampStr = new Date().toISOString();
    }
    const fixDate = new Date(timestampStr);

    // Speed calculation: use device reported speed, or calculate delta distance / delta time from previous fix
    let calculatedSpeed = data.speed ?? 0;
    if (calculatedSpeed <= 0 && bus.last_latitude && bus.last_longitude && bus.last_gps_timestamp) {
      calculatedSpeed = calculateSpeedKmH(
        bus.last_latitude,
        bus.last_longitude,
        new Date(bus.last_gps_timestamp),
        data.latitude,
        data.longitude,
        fixDate
      );
    }

    // Store in gps_locations table
    const gpsRecord = {
      trip_id: tripId,
      bus_id: data.busId,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: calculatedSpeed,
      heading: data.heading ?? 0,
      accuracy: data.accuracy ?? 5.0,
      is_valid: 1,
      is_stale: 0,
      timestamp: timestampStr,
    };

    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        `INSERT INTO gps_locations (trip_id, bus_id, latitude, longitude, speed, heading, accuracy, is_valid, is_stale, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [gpsRecord.trip_id, gpsRecord.bus_id, gpsRecord.latitude, gpsRecord.longitude, gpsRecord.speed, gpsRecord.heading, gpsRecord.accuracy, gpsRecord.timestamp]
      );
    } else {
      db.insertRecord('gps_locations', gpsRecord);
    }

    // Evaluate route stops and progress
    const route = bus.assigned_route_id ? await RouteService.getRouteById(bus.assigned_route_id) : null;
    let etaMinutes = 0;
    let distanceRemainingKm = 0;
    let nextStopName = 'Final Destination';
    let delayMinutes = activeTrip?.delay_mins || 0;

    if (route && route.stops.length > 0) {
      const stopPoints = route.stops.map((s) => ({
        id: s.pickup_point_id,
        name: s.stop_name,
        latitude: s.latitude,
        longitude: s.longitude,
        stopSequence: s.stop_sequence,
        scheduledTime: s.scheduled_arrival_time,
      }));

      // Check proximity to all stops along route (Arrival & Departure Detection)
      for (const stop of route.stops) {
        const isNear = isNearStop(data.latitude, data.longitude, stop.latitude, stop.longitude, 200);
        if (isNear) {
          // Detected inside stop radius: record arrival
          await this.recordStopArrival(tripId, stop.id, stop.pickup_point_id, stop.scheduled_arrival_time);
        } else {
          // Bus has departed away from this stop: record departure
          await this.recordStopDeparture(tripId, stop.id);
        }
      }

      // Route remaining distance & ETA calculation to next stop or last destination
      const lastStop = route.stops[route.stops.length - 1];
      const routeCalc = calculateRouteRemainingDistanceKm(
        data.latitude,
        data.longitude,
        stopPoints,
        lastStop.pickup_point_id
      );

      distanceRemainingKm = routeCalc.remainingDistanceKm;
      const nextStop = route.stops[routeCalc.nextStopIndex] || lastStop;
      nextStopName = nextStop.stop_name;

      const etaResult = calculateETA(
        distanceRemainingKm,
        calculatedSpeed,
        route.stops.length - 1 - routeCalc.nextStopIndex,
        delayMinutes
      );
      etaMinutes = etaResult.etaMinutes;

      // Evaluate Student Real Device Push Notifications (5-minute arrival & delay alerts)
      await this.evaluateStudentNotifications(
        data.busId,
        tripId,
        route,
        data.latitude,
        data.longitude,
        calculatedSpeed,
        delayMinutes
      );
    }

    // Determine status: delayed vs running_on_time vs approaching_pickup
    let newStatus = bus.status;
    if (etaMinutes <= 5 && etaMinutes > 0) {
      newStatus = 'approaching_pickup';
    } else if (delayMinutes >= 5) {
      newStatus = 'delayed';
    } else {
      newStatus = 'running_on_time';
    }

    // Update bus record only if this coordinate is newer than or equal to current telemetry
    const isNewestCoordinate = !bus.last_gps_timestamp || new Date(timestampStr).getTime() >= new Date(bus.last_gps_timestamp).getTime();
    if (isNewestCoordinate) {
      await BusService.updateBus(data.busId, {
        last_latitude: data.latitude,
        last_longitude: data.longitude,
        last_speed: calculatedSpeed,
        last_heading: data.heading ?? 0,
        last_gps_timestamp: timestampStr,
        gps_status: 'active',
        status: newStatus,
      });
    }

    const updatedBus = await BusService.getBusById(data.busId);

    return {
      success: true,
      bus: updatedBus,
      etaMinutes,
      nextStopName,
      distanceRemainingKm,
      delayMinutes,
    };
  }

  /**
   * Record stop arrival
   */
  private static async recordStopArrival(
    tripId: number,
    routeStopId: number,
    pickupPointId: number,
    scheduledTimeStr: string
  ): Promise<void> {
    const now = new Date();
    const arrivalTimeStr = now.toISOString();

    // Check delay in minutes against scheduled arrival
    const [schedHours, schedMins] = scheduledTimeStr.split(':').map(Number);
    const schedDate = new Date();
    schedDate.setHours(schedHours, schedMins, 0, 0);

    const diffMinutes = Math.round((now.getTime() - schedDate.getTime()) / (1000 * 60));
    const delayMinutes = Math.max(-5, Math.min(diffMinutes, 60));

    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        `UPDATE trip_stop_events
         SET actual_arrival_time = NOW(), delay_minutes = ?, status = 'arrived'
         WHERE trip_id = ? AND route_stop_id = ? AND status = 'scheduled'`,
        [delayMinutes, tripId, routeStopId]
      );
    } else {
      const events = db.getTable('trip_stop_events');
      const target = events.find(
        (e) => e.trip_id === tripId && e.route_stop_id === routeStopId && e.status === 'scheduled'
      );
      if (target) {
        target.actual_arrival_time = arrivalTimeStr;
        target.delay_minutes = delayMinutes;
        target.status = 'arrived';
        db.saveEmbeddedData();
      }
    }
  }

  /**
   * Record stop departure when bus leaves pickup point radius
   */
  private static async recordStopDeparture(
    tripId: number,
    routeStopId: number
  ): Promise<void> {
    const now = new Date();
    const departureTimeStr = now.toISOString();

    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        `UPDATE trip_stop_events
         SET actual_departure_time = NOW(), status = 'departed'
         WHERE trip_id = ? AND route_stop_id = ? AND status = 'arrived'`,
        [tripId, routeStopId]
      );
    } else {
      const events = db.getTable('trip_stop_events');
      const target = events.find(
        (e) => e.trip_id === tripId && e.route_stop_id === routeStopId && e.status === 'arrived'
      );
      if (target) {
        target.actual_departure_time = departureTimeStr;
        target.status = 'departed';
        db.saveEmbeddedData();
      }
    }
  }

  /**
   * Real-time Student Web Push notification evaluation
   */
  public static async evaluateStudentNotifications(
    busId: number,
    tripId: number,
    route: any,
    busLat: number,
    busLng: number,
    speed: number,
    delayMinutes: number
  ): Promise<void> {
    try {
      const bus = await BusService.getBusById(busId);
      const studentPreferences = db.getTable('student_pickup_preferences');
      const stopPoints = route.stops.map((s: any) => ({
        id: s.pickup_point_id,
        name: s.stop_name,
        latitude: s.latitude,
        longitude: s.longitude,
        stopSequence: s.stop_sequence,
        scheduledTime: s.scheduled_arrival_time,
      }));

      for (const pref of studentPreferences) {
        if (pref.bus_id === busId || pref.route_id === route.id) {
          const studentId = pref.student_identifier || 'student1';
          const targetStop = route.stops.find((s: any) => s.pickup_point_id === pref.pickup_point_id);
          if (!targetStop) continue;

          const calc = calculateRouteRemainingDistanceKm(busLat, busLng, stopPoints, targetStop.pickup_point_id);

          if (!calc.busDeparted) {
            const eta = calculateETA(calc.remainingDistanceKm, speed, Math.max(0, calc.nextStopIndex - 1), delayMinutes);

            // 1. 5-Minute Arrival Notification Window (ETA between 3 and 6 mins)
            if (pref.notification_5min_enabled && eta.etaMinutes >= 3 && eta.etaMinutes <= 6) {
              if (!NotificationService.hasAlertBeenSent(tripId, targetStop.pickup_point_id, studentId, '5min_arrival')) {
                NotificationService.markAlertSent(tripId, targetStop.pickup_point_id, studentId, '5min_arrival');

                await NotificationService.sendPushToStudent(studentId, {
                  title: '🚌 Your College Bus is Almost Here!',
                  body: `Your bus ${bus?.bus_number || ''} is expected to reach ${targetStop.stop_name} in approximately ${eta.etaMinutes} minutes. Please be ready.`,
                  icon: '/icons/icon-192x192.png',
                  data: { url: '/', busId, tripId, stopId: targetStop.pickup_point_id },
                });

                await NotificationService.createNotification({
                  studentIdentifier: studentId,
                  busId,
                  routeId: route.id,
                  tripId,
                  pickupPointId: targetStop.pickup_point_id,
                  title: '🚌 Bus Arriving in ~5 Minutes',
                  message: `Bus ${bus?.bus_number || ''} (${bus?.bus_name || ''}) will reach ${targetStop.stop_name} at approximately ${eta.estimatedArrivalTime}.`,
                  category: '5min_arrival',
                  metadata: { etaMinutes: eta.etaMinutes, targetStopName: targetStop.stop_name },
                });
              }
            }

            // 2. Delay Alert Window (delay >= 5 mins)
            if (pref.notification_delay_enabled && delayMinutes >= 5) {
              if (!NotificationService.hasAlertBeenSent(tripId, targetStop.pickup_point_id, studentId, 'delay_alert')) {
                NotificationService.markAlertSent(tripId, targetStop.pickup_point_id, studentId, 'delay_alert');

                await NotificationService.sendPushToStudent(studentId, {
                  title: '⚠️ Bus Delay Alert',
                  body: `Bus ${bus?.bus_number || ''} is currently delayed by ${delayMinutes} mins. Expected at ${targetStop.stop_name} around ${eta.estimatedArrivalTime}.`,
                  icon: '/icons/icon-192x192.png',
                  data: { url: '/', busId, tripId, delayMinutes },
                });

                await NotificationService.createNotification({
                  studentIdentifier: studentId,
                  busId,
                  routeId: route.id,
                  tripId,
                  pickupPointId: targetStop.pickup_point_id,
                  title: '⚠️ Bus Delay Alert',
                  message: `Bus ${bus?.bus_number || ''} is delayed by ${delayMinutes} mins. Expected arrival at ${targetStop.stop_name} updated to ${eta.estimatedArrivalTime}.`,
                  category: 'delay_alert',
                  metadata: { delayMinutes, newEtaTime: eta.estimatedArrivalTime },
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[TripService] evaluateStudentNotifications notice:', err.message);
    }
  }

  /**
   * End an active trip
   */
  public static async endTrip(tripId: number): Promise<ActiveTrip> {
    const trip = await this.getTripById(tripId);
    if (!trip) throw new Error('Trip not found');

    const now = new Date().toISOString();
    const bus = await BusService.getBusById(trip.bus_id);

    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        `UPDATE trips
         SET status = 'completed', end_time = NOW(), end_lat = ?, end_lng = ?
         WHERE id = ?`,
        [bus?.last_latitude || null, bus?.last_longitude || null, tripId]
      );
    } else {
      db.updateRecord('trips', tripId, {
        status: 'completed',
        end_time: now,
        end_lat: bus?.last_latitude || null,
        end_lng: bus?.last_longitude || null,
      });
    }

    // Reset bus state to offline
    if (bus) {
      await BusService.updateBus(bus.id, {
        status: 'trip_completed',
        gps_status: 'offline',
        last_speed: 0.0,
      });
    }

    NotificationService.resetAlertsForTrip(tripId);

    return (await this.getTripById(tripId))!;
  }

  /**
   * Report a delay manually or automatically
   */
  public static async reportDelay(tripId: number, delayMinutes: number, reason: string): Promise<void> {
    const trip = await this.getTripById(tripId);
    if (!trip) return;

    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        'UPDATE trips SET delay_mins = ?, delay_reason = ?, status = "delayed" WHERE id = ?',
        [delayMinutes, reason, tripId]
      );
      await db.query(
        'INSERT INTO delay_events (trip_id, bus_id, delay_minutes, reason, is_manual) VALUES (?, ?, ?, ?, 1)',
        [tripId, trip.bus_id, delayMinutes, reason]
      );
    } else {
      db.updateRecord('trips', tripId, {
        delay_mins: delayMinutes,
        delay_reason: reason,
        status: 'delayed',
      });
      db.insertRecord('delay_events', {
        trip_id: tripId,
        bus_id: trip.bus_id,
        delay_minutes: delayMinutes,
        reason,
        is_manual: 1,
        notified_count: 0,
      });
    }

    const bus = await BusService.getBusById(trip.bus_id);
    if (bus) {
      await BusService.updateBus(bus.id, { status: 'delayed' });

      // Dispatch delay notification
      await NotificationService.createNotification({
        busId: bus.id,
        routeId: trip.route_id,
        tripId: tripId,
        title: `College Bus Delay Alert: ${bus.bus_number}`,
        message: `Your college bus is delayed by approx ${delayMinutes} mins. Reason: ${reason}.`,
        category: 'delay_alert',
      });
    }
  }

  public static async getActiveTripForBus(busId: number): Promise<ActiveTrip | null> {
    if (db.mode === 'mysql' && db.getPool()) {
      const rows: any = await db.query(
        'SELECT * FROM trips WHERE bus_id = ? AND status IN ("in_progress", "active") ORDER BY id DESC LIMIT 1',
        [busId]
      );
      return rows[0] || null;
    }
    const trips = db.getTable<ActiveTrip>('trips');
    return trips.find((t) => Number(t.bus_id) === Number(busId) && (t.status === 'in_progress' || (t.status as string) === 'active')) || null;
  }

  public static async getTripById(tripId: number): Promise<ActiveTrip | null> {
    if (db.mode === 'mysql' && db.getPool()) {
      const rows: any = await db.query('SELECT * FROM trips WHERE id = ? LIMIT 1', [tripId]);
      return rows[0] || null;
    }
    const trips = db.getTable<ActiveTrip>('trips');
    return trips.find((t) => t.id === tripId) || null;
  }

  public static async getAllTrips(): Promise<any[]> {
    if (db.mode === 'mysql' && db.getPool()) {
      return db.query(`
        SELECT t.*, b.bus_number, b.bus_name, d.full_name as driver_name, r.route_name
        FROM trips t
        JOIN buses b ON t.bus_id = b.id
        JOIN drivers d ON t.driver_id = d.id
        JOIN routes r ON t.route_id = r.id
        ORDER BY t.id DESC
      `);
    }

    const trips = db.getTable<any>('trips');
    const buses = db.getTable<any>('buses');
    const drivers = db.getTable<any>('drivers');
    const routes = db.getTable<any>('routes');

    return trips.map((t) => {
      const b = buses.find((item) => item.id === t.bus_id);
      const d = drivers.find((item) => item.id === t.driver_id);
      const r = routes.find((item) => item.id === t.route_id);
      return {
        ...t,
        bus_number: b?.bus_number || 'N/A',
        bus_name: b?.bus_name || 'N/A',
        driver_name: d?.full_name || 'N/A',
        route_name: r?.route_name || 'N/A',
      };
    }).sort((a, b) => b.id - a.id);
  }

  public static async getTripStopEvents(tripId: number): Promise<any[]> {
    if (db.mode === 'mysql' && db.getPool()) {
      return db.query(`
        SELECT e.*, p.name as stop_name, p.landmark, p.latitude, p.longitude, p.address
        FROM trip_stop_events e
        LEFT JOIN pickup_points p ON e.pickup_point_id = p.id
        WHERE e.trip_id = ?
        ORDER BY e.id ASC
      `, [tripId]);
    }

    const events = db.getTable<any>('trip_stop_events').filter((e) => e.trip_id === tripId);
    const pickupPoints = db.getTable<any>('pickup_points');

    return events.map((e) => {
      const p = pickupPoints.find((item) => item.id === e.pickup_point_id);
      return {
        ...e,
        stop_name: p?.name || `Stop #${e.pickup_point_id}`,
        landmark: p?.landmark || '',
        latitude: p?.latitude || 0,
        longitude: p?.longitude || 0,
        address: p?.address || '',
      };
    }).sort((a, b) => a.id - b.id);
  }
}
