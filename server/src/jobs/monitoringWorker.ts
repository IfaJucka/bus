import { BusService } from '../services/busService';
import { RouteService } from '../services/routeService';
import { TripService } from '../services/tripService';
import { NotificationService } from '../services/notificationService';
import { SocketHandler } from '../sockets/socketHandler';
import { db } from '../database';
import {
  calculateRouteRemainingDistanceKm,
  calculateETA,
  isGpsStale,
} from '../utils/geo';

export class MonitoringWorker {
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static isRunning: boolean = false;

  public static start(intervalMs: number = 4000): void {
    if (this.intervalTimer) return;
    console.log(`[Worker] Background ETA, 5-Minute Arrival & Delay Monitor started (every ${intervalMs}ms)`);

    this.intervalTimer = setInterval(() => {
      this.checkActiveTripsAndDispatchAlerts().catch((err) => {
        console.error('[Worker] Monitor loop error:', err.message);
      });
    }, intervalMs);
  }

  public static stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('[Worker] Monitoring worker stopped.');
    }
  }

  private static async checkActiveTripsAndDispatchAlerts(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const buses = await BusService.getAllBuses();
      const activeBuses = buses.filter(
        (b) => (b.status === 'running_on_time' || b.status === 'approaching_pickup' || b.status === 'delayed') && b.assigned_route_id
      );

      for (const bus of activeBuses) {
        // 1. Check GPS Staleness
        if (bus.last_gps_timestamp && isGpsStale(bus.last_gps_timestamp, 45)) {
          if (bus.gps_status !== 'stale') {
            await BusService.updateBus(bus.id, { gps_status: 'stale' });
            SocketHandler.broadcastBusStatus(bus.id, bus.status, 'stale');
          }
          continue; // Skip ETA processing if GPS is stale
        }

        if (!bus.last_latitude || !bus.last_longitude || !bus.assigned_route_id) continue;

        const route = await RouteService.getRouteById(bus.assigned_route_id);
        if (!route || route.stops.length === 0) continue;

        const activeTrip = await TripService.getActiveTripForBus(bus.id);
        const tripId = activeTrip?.id || 1;

        const stopPoints = route.stops.map((s) => ({
          id: s.pickup_point_id,
          name: s.stop_name,
          latitude: s.latitude,
          longitude: s.longitude,
          stopSequence: s.stop_sequence,
          scheduledTime: s.scheduled_arrival_time,
        }));

        // Retrieve student preferences for this bus/route
        const preferences = await this.getStudentPreferences(bus.id, route.id);

        for (const stop of route.stops) {
          const routeCalc = calculateRouteRemainingDistanceKm(
            bus.last_latitude,
            bus.last_longitude,
            stopPoints,
            stop.pickup_point_id
          );

          // Calculate ETA to this specific stop
          const etaCalc = calculateETA(
            routeCalc.remainingDistanceKm,
            bus.last_speed,
            Math.max(0, routeCalc.nextStopIndex),
            activeTrip?.delay_mins || 0
          );

          const etaMins = etaCalc.etaMinutes;

          // 2. Five-Minute Arrival Alert Detection (Trigger when 4 <= ETA <= 6 minutes)
          if (etaMins <= 6 && etaMins >= 1) {
            // Find students who selected this stop
            const targetStudents = preferences.filter(
              (p) => p.pickup_point_id === stop.pickup_point_id && p.notification_5min_enabled
            );

            for (const student of targetStudents) {
              const studentId = student.student_identifier || `user_${student.user_id}`;
              const alreadySent = NotificationService.hasAlertBeenSent(
                tripId,
                stop.pickup_point_id,
                studentId,
                '5min_arrival'
              );

              if (!alreadySent) {
                NotificationService.markAlertSent(tripId, stop.pickup_point_id, studentId, '5min_arrival');

                await NotificationService.createNotification({
                  studentIdentifier: studentId,
                  userId: student.user_id,
                  busId: bus.id,
                  routeId: route.id,
                  tripId: tripId,
                  pickupPointId: stop.pickup_point_id,
                  title: 'Your College Bus Is Almost Here!',
                  message: `Bus ${bus.bus_number} will arrive at ${stop.stop_name} in approx ${etaMins} minutes (${etaCalc.estimatedArrivalTime}). Please be ready at the stop!`,
                  category: '5min_arrival',
                });
                console.log(`[Worker] Sent 5-min arrival alert to ${studentId} for stop ${stop.stop_name}`);
              }
            }
          }

          // 3. Significant Delay Alert Detection
          if (activeTrip && activeTrip.delay_mins >= 5) {
            const targetStudents = preferences.filter(
              (p) => p.pickup_point_id === stop.pickup_point_id && p.notification_delay_enabled
            );

            for (const student of targetStudents) {
              const studentId = student.student_identifier || `user_${student.user_id}`;
              const alreadySent = NotificationService.hasAlertBeenSent(
                tripId,
                stop.pickup_point_id,
                studentId,
                `delay_${activeTrip.delay_mins}`
              );

              if (!alreadySent) {
                NotificationService.markAlertSent(tripId, stop.pickup_point_id, studentId, `delay_${activeTrip.delay_mins}`);

                await NotificationService.createNotification({
                  studentIdentifier: studentId,
                  userId: student.user_id,
                  busId: bus.id,
                  routeId: route.id,
                  tripId: tripId,
                  pickupPointId: stop.pickup_point_id,
                  title: 'College Bus Delay Alert',
                  message: `Bus ${bus.bus_number} is delayed by approx ${activeTrip.delay_mins} mins. Expected arrival at ${stop.stop_name}: ${etaCalc.estimatedArrivalTime}. Reason: ${activeTrip.delay_reason || 'Heavy Traffic'}.`,
                  category: 'delay_alert',
                });
                console.log(`[Worker] Sent delay alert to ${studentId} for stop ${stop.stop_name}`);
              }
            }
          }
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  private static async getStudentPreferences(busId: number, routeId: number): Promise<any[]> {
    if (db.mode === 'mysql' && db.getPool()) {
      return db.query(
        'SELECT * FROM student_pickup_preferences WHERE bus_id = ? OR route_id = ?',
        [busId, routeId]
      );
    }
    const table = db.getTable('student_pickup_preferences');
    return table.filter((p) => p.bus_id === busId || p.route_id === routeId);
  }
}
