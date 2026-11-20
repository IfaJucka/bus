import { db } from '../database';
import { RouteService } from './routeService';

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

export class HistoryService {
  /**
   * Get 7-Day arrival records for a specific bus and pickup point
   */
  public static async getSevenDayArrivals(
    busId: number,
    pickupPointId: number,
    daysCount: number = 7
  ): Promise<{ rows: HistoricalArrivalRow[]; stats: WeeklySummaryStats }> {
    const today = new Date();
    const rows: HistoricalArrivalRow[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Retrieve bus info
    let busName = 'KA-47-A-1234';
    const buses = db.getTable('buses');
    const bus = buses.find((b) => b.id === busId);
    if (bus) busName = bus.bus_number;

    // Retrieve stop info
    let stopName = 'Selected Stop';
    const pickupPoints = db.getTable('pickup_points');
    const stop = pickupPoints.find((p) => p.id === pickupPointId);
    if (stop) stopName = stop.name;

    // Find route stop scheduled arrival time
    let scheduledTimeStr = '07:45:00';
    const routeStops = db.getTable('route_stops');
    const rs = routeStops.find((item) => item.pickup_point_id === pickupPointId);
    if (rs) scheduledTimeStr = rs.scheduled_arrival_time;

    // Fetch recorded stop events from database
    let stopEvents: any[] = [];
    if (db.mode === 'mysql' && db.getPool()) {
      stopEvents = await db.query(
        `SELECT tse.*, t.trip_date, t.bus_id
         FROM trip_stop_events tse
         JOIN trips t ON tse.trip_id = t.id
         WHERE t.bus_id = ? AND tse.pickup_point_id = ?
         ORDER BY t.trip_date DESC LIMIT 30`,
        [busId, pickupPointId]
      );
    } else {
      const allEvents = db.getTable('trip_stop_events');
      const allTrips = db.getTable('trips');
      stopEvents = allEvents
        .filter((e) => e.pickup_point_id === pickupPointId)
        .map((e) => {
          const trip = allTrips.find((t) => t.id === e.trip_id);
          return { ...e, trip_date: trip?.trip_date, bus_id: trip?.bus_id };
        })
        .filter((e) => e.bus_id === busId);
    }

    // Format 7-Day table
    const recordedArrivalTimes: number[] = []; // In minutes from midnight
    let totalDelayMinutes = 0;
    let onTimeCount = 0;
    let validTripsCount = 0;

    // Determine the base reference date: either today, or the latest recorded event date if all events are from earlier
    let referenceDate = new Date(today);
    if (stopEvents.length > 0) {
      const hasEventsInCurrentWindow = stopEvents.some((e) => {
        if (!e.trip_date) return false;
        const diffDays = (today.getTime() - new Date(e.trip_date).getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= daysCount + 2;
      });
      if (!hasEventsInCurrentWindow) {
        const sortedDates = stopEvents
          .map((e) => e.trip_date)
          .filter(Boolean)
          .sort()
          .reverse();
        if (sortedDates.length > 0) {
          const latest = new Date(sortedDates[0]);
          latest.setDate(latest.getDate() + 1);
          referenceDate = latest;
        }
      }
    }

    for (let i = daysCount; i >= 1; i--) {
      const pastDate = new Date(referenceDate);
      pastDate.setDate(referenceDate.getDate() - i);
      const dayOfWeek = dayNames[pastDate.getDay()];
      const dateStr = pastDate.toISOString().split('T')[0];

      if (dayOfWeek === 'Sunday') {
        rows.push({
          date: dateStr,
          dayOfWeek,
          scheduledArrival: 'Not scheduled',
          actualArrival: 'Not applicable',
          delayText: 'Not applicable',
          delayMinutes: null,
          statusText: 'Not scheduled',
        });
        continue;
      }

      // Find matching trip stop event for this date
      const event = stopEvents.find((e) => e.trip_date === dateStr);

      if (!event || !event.actual_arrival_time) {
        rows.push({
          date: dateStr,
          dayOfWeek,
          scheduledArrival: formatTimeAMPM(scheduledTimeStr),
          actualArrival: 'No recorded arrival',
          delayText: 'Not available',
          delayMinutes: null,
          statusText: 'No recorded arrival',
        });
      } else {
        validTripsCount++;
        const arrivalDate = new Date(event.actual_arrival_time);
        const arrivalTimeMinutes = arrivalDate.getHours() * 60 + arrivalDate.getMinutes();
        recordedArrivalTimes.push(arrivalTimeMinutes);

        const delay = event.delay_minutes || 0;
        totalDelayMinutes += delay;

        let delayText = '';
        let statusText: HistoricalArrivalRow['statusText'] = 'On time';

        if (delay === 0) {
          delayText = 'On time';
          onTimeCount++;
        } else if (delay > 0) {
          delayText = `${delay} min delay`;
          statusText = 'Delayed';
          if (delay <= 2) onTimeCount++; // 2 min threshold for on-time
        } else {
          delayText = `${Math.abs(delay)} min early`;
          statusText = 'Early';
          onTimeCount++;
        }

        const actualArrivalStr = formatTimeAMPM(
          `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}:00`
        );

        rows.push({
          date: dateStr,
          dayOfWeek,
          scheduledArrival: formatTimeAMPM(event.scheduled_time || scheduledTimeStr),
          actualArrival: actualArrivalStr,
          delayText,
          delayMinutes: delay,
          statusText,
        });
      }
    }

    // Compute stats
    let stats: WeeklySummaryStats;

    if (validTripsCount < 2) {
      stats = {
        hasSufficientData: false,
        message: 'Not enough historical data is available to calculate an average.',
        averageArrivalTime: 'N/A',
        averageDelayMinutes: 0,
        earliestArrival: 'N/A',
        latestArrival: 'N/A',
        totalTripsRecorded: validTripsCount,
        onTimePercentage: 0,
        pickupPointName: stopName,
        busNumber: busName,
      };
    } else {
      const avgMinutes = Math.round(recordedArrivalTimes.reduce((a, b) => a + b, 0) / recordedArrivalTimes.length);
      const avgHours = Math.floor(avgMinutes / 60);
      const avgMins = avgMinutes % 60;
      const avgTimeStr = formatTimeAMPM(`${String(avgHours).padStart(2, '0')}:${String(avgMins).padStart(2, '0')}:00`);

      const minArrival = Math.min(...recordedArrivalTimes);
      const maxArrival = Math.max(...recordedArrivalTimes);

      const earliestStr = formatTimeAMPM(`${String(Math.floor(minArrival / 60)).padStart(2, '0')}:${String(minArrival % 60).padStart(2, '0')}:00`);
      const latestStr = formatTimeAMPM(`${String(Math.floor(maxArrival / 60)).padStart(2, '0')}:${String(maxArrival % 60).padStart(2, '0')}:00`);

      const avgDelay = parseFloat((totalDelayMinutes / validTripsCount).toFixed(1));
      const onTimePct = Math.round((onTimeCount / validTripsCount) * 100);

      stats = {
        hasSufficientData: true,
        averageArrivalTime: avgTimeStr,
        averageDelayMinutes: avgDelay,
        earliestArrival: earliestStr,
        latestArrival: latestStr,
        totalTripsRecorded: validTripsCount,
        onTimePercentage: onTimePct,
        pickupPointName: stopName,
        busNumber: busName,
      };
    }

    return { rows, stats };
  }

  /**
   * Get historical route and GPS waypoints for a specific bus and single date
   */
  public static async getDayRoute(busId: number, dateStr: string): Promise<{
    hasTrip: boolean;
    isHoliday: boolean;
    isNoTrip: boolean;
    isMissingGps: boolean;
    statusText: string;
    message: string;
    trip?: any;
    routePath?: Array<{ lat: number; lng: number; speed: number; timestamp: string; stopName?: string }>;
    stops?: any[];
  }> {
    const inputDate = new Date(dateStr);
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][inputDate.getDay()];

    if (dayOfWeek === 'Sunday') {
      return {
        hasTrip: false,
        isHoliday: true,
        isNoTrip: false,
        isMissingGps: false,
        statusText: 'College Holiday',
        message: 'College Holiday – No bus service.',
      };
    }

    let trip: any = null;
    let locations: any[] = [];
    let stops: any[] = [];

    if (db.mode === 'mysql' && db.getPool()) {
      const trips: any = await db.query('SELECT * FROM trips WHERE bus_id = ? AND trip_date = ? LIMIT 1', [busId, dateStr]);
      if (trips && trips.length > 0) {
        trip = trips[0];
        locations = await db.query('SELECT * FROM gps_locations WHERE trip_id = ? ORDER BY timestamp ASC', [trip.id]);
        stops = await db.query('SELECT tse.*, pp.name as stop_name FROM trip_stop_events tse JOIN pickup_points pp ON tse.pickup_point_id = pp.id WHERE tse.trip_id = ? ORDER BY tse.id ASC', [trip.id]);
      }
    } else {
      const allTrips = db.getTable<any>('trips');
      trip = allTrips.find((t) => t.bus_id === busId && t.trip_date === dateStr);
      if (trip) {
        const allGps = db.getTable<any>('gps_locations');
        locations = allGps.filter((g) => g.trip_id === trip.id).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const allEvents = db.getTable<any>('trip_stop_events');
        const points = db.getTable<any>('pickup_points');
        stops = allEvents
          .filter((e) => e.trip_id === trip.id)
          .map((e) => {
            const pt = points.find((p) => p.id === e.pickup_point_id);
            return { ...e, stop_name: pt?.name || 'Stop' };
          });
      }
    }

    if (!trip) {
      return {
        hasTrip: false,
        isHoliday: false,
        isNoTrip: true,
        isMissingGps: false,
        statusText: 'No Bus Trip Recorded',
        message: 'No bus trip was recorded on this day.',
      };
    }

    if (locations.length === 0) {
      return {
        hasTrip: true,
        isHoliday: false,
        isNoTrip: false,
        isMissingGps: true,
        statusText: 'Missing GPS Data',
        message: 'Missing GPS telemetry data for this trip. The bus operated on schedule, but location streaming was unavailable.',
        trip,
        stops,
      };
    }

    const routePath = locations.map((loc) => ({
      lat: Number(loc.latitude),
      lng: Number(loc.longitude),
      speed: Number(loc.speed || 0),
      timestamp: loc.timestamp,
      stopName: loc.stop_name || undefined,
    }));

    return {
      hasTrip: true,
      isHoliday: false,
      isNoTrip: false,
      isMissingGps: false,
      statusText: 'Trip Completed',
      message: `Bus journey completed with ${routePath.length} recorded telemetry checkpoints.`,
      trip,
      routePath,
      stops,
    };
  }
}

function formatTimeAMPM(time24: string): string {
  if (!time24 || time24.includes('Not')) return time24;
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}
