import { Router, Request, Response } from 'express';
import { BusService } from '../services/busService';
import { RouteService } from '../services/routeService';
import { TripService } from '../services/tripService';
import {
  calculateRouteRemainingDistanceKm,
  calculateETA,
  isGpsStale,
} from '../utils/geo';

const router = Router();

// GET /api/eta/bus/:busId/stop/:stopId
router.get('/bus/:busId/stop/:stopId', async (req: Request, res: Response) => {
  try {
    const busId = parseInt(req.params.busId, 10);
    const stopId = parseInt(req.params.stopId, 10);

    const bus = await BusService.getBusById(busId);
    if (!bus) {
      res.status(404).json({ success: false, error: 'Bus not found' });
      return;
    }

    if (!bus.assigned_route_id) {
      res.status(400).json({ success: false, error: 'Bus has no assigned route' });
      return;
    }

    const route = await RouteService.getRouteById(bus.assigned_route_id);
    if (!route) {
      res.status(404).json({ success: false, error: 'Route not found' });
      return;
    }

    const targetStop = route.stops.find((s) => s.pickup_point_id === stopId);
    if (!targetStop) {
      res.status(404).json({ success: false, error: 'Stop not found on bus route' });
      return;
    }

    const activeTrip = await TripService.getActiveTripForBus(busId);
    const stale = isGpsStale(bus.last_gps_timestamp);

    // 1. If bus is offline or has no active trip in progress
    if (!activeTrip || activeTrip.status !== 'in_progress' || bus.status === 'trip_completed' || bus.status === 'not_started' || bus.gps_status === 'offline') {
      res.json({
        success: true,
        isGpsAvailable: false,
        isStale: false,
        message: 'Bus is currently offline (no active trip in progress). Scheduled stop time: ' + (targetStop.scheduled_arrival_time || 'Morning'),
        scheduledArrivalTime: targetStop.scheduled_arrival_time,
        etaMinutes: null,
        estimatedArrivalTime: null,
        roadDistanceKm: null,
        straightLineKm: null,
        busStatus: bus.status,
      });
      return;
    }

    // 2. If bus is active but has not yet transmitted its first GPS coordinate
    if (!bus.last_latitude || !bus.last_longitude || bus.gps_status === 'waiting_signal') {
      res.json({
        success: true,
        isGpsAvailable: false,
        isStale: false,
        message: 'Trip active. Waiting for driver device GPS fix. Scheduled arrival: ' + (targetStop.scheduled_arrival_time || 'Morning'),
        scheduledArrivalTime: targetStop.scheduled_arrival_time,
        etaMinutes: null,
        estimatedArrivalTime: null,
        roadDistanceKm: null,
        straightLineKm: null,
        busStatus: bus.status,
      });
      return;
    }

    // 3. If GPS telemetry is stale (>45 seconds with no fresh fix)
    if (stale) {
      res.json({
        success: true,
        isGpsAvailable: false,
        isStale: true,
        message: 'GPS Signal Lost: Telemetry from driver is stale (>45s). Waiting for driver connection to resume.',
        scheduledArrivalTime: targetStop.scheduled_arrival_time,
        etaMinutes: null,
        estimatedArrivalTime: null,
        roadDistanceKm: null,
        straightLineKm: null,
        busStatus: 'delayed',
        lastGpsUpdate: bus.last_gps_timestamp,
      });
      return;
    }

    const stopPoints = route.stops.map((s) => ({
      id: s.pickup_point_id,
      name: s.stop_name,
      latitude: s.latitude,
      longitude: s.longitude,
      stopSequence: s.stop_sequence,
      scheduledTime: s.scheduled_arrival_time,
    }));

    const routeCalc = calculateRouteRemainingDistanceKm(
      bus.last_latitude,
      bus.last_longitude,
      stopPoints,
      stopId
    );

    // 4. If the bus has already departed this stop
    if (routeCalc.busDeparted) {
      res.json({
        success: true,
        isGpsAvailable: true,
        isStale: false,
        busDeparted: true,
        message: `Bus ${bus.bus_number} has already departed ${targetStop.stop_name} and is proceeding towards next stops.`,
        scheduledArrivalTime: targetStop.scheduled_arrival_time,
        etaMinutes: 0,
        estimatedArrivalTime: 'Departed',
        roadDistanceKm: 0,
        straightLineKm: 0,
        speedKmH: bus.last_speed,
        busStatus: bus.status,
        lastGpsUpdate: bus.last_gps_timestamp,
      });
      return;
    }

    const etaCalc = calculateETA(
      routeCalc.remainingDistanceKm,
      bus.last_speed,
      Math.max(0, targetStop.stop_sequence - routeCalc.nextStopIndex),
      activeTrip?.delay_mins || 0
    );

    res.json({
      success: true,
      isGpsAvailable: true,
      isStale: false,
      busDeparted: false,
      busId: bus.id,
      busNumber: bus.bus_number,
      busName: bus.bus_name,
      stopId: targetStop.pickup_point_id,
      stopName: targetStop.stop_name,
      scheduledArrivalTime: targetStop.scheduled_arrival_time,
      estimatedArrivalTime: etaCalc.estimatedArrivalTime,
      etaMinutes: etaCalc.etaMinutes,
      roadDistanceKm: routeCalc.remainingDistanceKm,
      straightLineKm: routeCalc.straightLineKm,
      speedKmH: bus.last_speed,
      delayMinutes: activeTrip?.delay_mins || 0,
      busStatus: bus.status,
      lastGpsUpdate: bus.last_gps_timestamp,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
