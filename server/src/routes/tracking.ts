import { Router, Request, Response } from 'express';
import { BusService } from '../services/busService';
import { TripService } from '../services/tripService';
import { SocketHandler } from '../sockets/socketHandler';
import { isGpsStale, isValidCoordinate } from '../utils/geo';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /api/tracking/start (Driver or Admin)
router.post('/start', authenticateJWT, requireRole(['driver', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { busId, driverId, routeId, isDemo, initialLat, initialLng } = req.body;
    if (!busId) {
      res.status(400).json({ success: false, error: 'busId is required' });
      return;
    }

    const bus = await BusService.getBusById(parseInt(busId, 10));
    if (!bus) {
      res.status(404).json({ success: false, error: 'Bus not found' });
      return;
    }

    // Verify the selected bus has a driver and route configured by the administrator
    if (!bus.assigned_driver_id) {
      res.status(400).json({
        success: false,
        error: `Cannot start trip: Bus ${bus.bus_number} has no driver assigned by the administrator.`,
      });
      return;
    }

    if (!bus.assigned_route_id) {
      res.status(400).json({
        success: false,
        error: `Cannot start trip: Bus ${bus.bus_number} has no route assigned by the administrator.`,
      });
      return;
    }

    const assignedDriverId = bus.assigned_driver_id;
    const assignedRouteId = bus.assigned_route_id;

    const trip = await TripService.startTrip({
      busId: bus.id,
      driverId: assignedDriverId,
      routeId: assignedRouteId,
      isDemo: Boolean(isDemo),
      initialLat,
      initialLng,
    });

    SocketHandler.broadcastTripStarted(trip);
    SocketHandler.broadcastBusStatus(bus.id, 'running_on_time', 'waiting_signal');

    res.json({ success: true, message: 'GPS Tracking started successfully', trip });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tracking/stop (Driver or Admin)
router.post('/stop', authenticateJWT, requireRole(['driver', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { busId, tripId } = req.body;
    let targetTripId = tripId;

    if (!targetTripId && busId) {
      const active = await TripService.getActiveTripForBus(parseInt(busId, 10));
      targetTripId = active?.id;
    }

    if (!targetTripId) {
      res.status(400).json({ success: false, error: 'No active trip found for this bus' });
      return;
    }

    const endedTrip = await TripService.endTrip(targetTripId);
    SocketHandler.broadcastTripEnded(endedTrip);
    SocketHandler.broadcastBusStatus(endedTrip.bus_id, 'trip_completed', 'offline');

    res.json({ success: true, message: 'GPS Tracking session stopped', trip: endedTrip });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tracking/location (Driver or Admin)
router.post('/location', authenticateJWT, requireRole(['driver', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { busId, latitude, longitude, speed, heading, accuracy, timestamp, isDemo } = req.body;

    if (!busId || latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, error: 'busId, latitude, and longitude are required' });
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const bId = parseInt(busId, 10);

    // 1. Strict coordinate validation: reject NaNs, nulls, and out-of-range coordinates
    if (!isValidCoordinate(lat, lng)) {
      res.status(400).json({
        success: false,
        error: `Invalid GPS coordinates provided: lat=${latitude}, lng=${longitude}. Must be valid numbers in [-90, 90] and [-180, 180].`,
      });
      return;
    }

    // 2. Bus existence check
    const bus = await BusService.getBusById(bId);
    if (!bus) {
      res.status(404).json({ success: false, error: `Bus with ID ${bId} does not exist.` });
      return;
    }

    // 3. Active trip check: do not ingest coordinates if bus is not on an active trip
    const activeTrip = await TripService.getActiveTripForBus(bId);
    if (!activeTrip || activeTrip.status !== 'in_progress') {
      res.status(400).json({
        success: false,
        error: `No active trip in progress for Bus ${bus.bus_number}. Please start a trip before sending GPS locations.`,
      });
      return;
    }

    // 4. Role-based isolation: ensure a driver can only transmit location for their assigned bus/trip
    if (req.user?.role === 'driver') {
      const driverId = req.user.driverId;
      if (driverId && bus.assigned_driver_id && bus.assigned_driver_id !== driverId && activeTrip.driver_id !== driverId) {
        res.status(403).json({
          success: false,
          error: `Forbidden: Driver "${req.user.fullName}" is not assigned to Bus ${bus.bus_number}.`,
        });
        return;
      }
    }

    // 5. Ingest and persist location
    const result = await TripService.recordLocation({
      busId: bId,
      latitude: lat,
      longitude: lng,
      speed: speed !== undefined && speed !== null ? parseFloat(speed) : undefined,
      heading: heading !== undefined && heading !== null ? parseFloat(heading) : 0,
      accuracy: accuracy !== undefined && accuracy !== null ? parseFloat(accuracy) : 5.0,
      timestamp,
      isDemo: Boolean(isDemo),
    });

    // 6. Broadcast live location to connected students via Socket.IO
    SocketHandler.broadcastBusLocation({
      busId: bId,
      latitude: lat,
      longitude: lng,
      speed: result.bus.last_speed,
      heading: result.bus.last_heading,
      status: result.bus.status,
      gpsStatus: 'active',
      timestamp: result.bus.last_gps_timestamp || new Date().toISOString(),
      etaMinutes: result.etaMinutes,
      nextStopName: result.nextStopName,
      distanceRemainingKm: result.distanceRemainingKm,
      delayMinutes: result.delayMinutes,
    });

    res.json({
      success: true,
      bus: result.bus,
      etaMinutes: result.etaMinutes,
      nextStopName: result.nextStopName,
      distanceRemainingKm: result.distanceRemainingKm,
      delayMinutes: result.delayMinutes,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/tracking/bus/:busId
router.get('/bus/:busId', async (req: Request, res: Response) => {
  try {
    const busId = parseInt(req.params.busId, 10);
    const bus = await BusService.getBusById(busId);
    if (!bus) {
      res.status(404).json({ success: false, error: 'Bus not found' });
      return;
    }

    const activeTrip = await TripService.getActiveTripForBus(busId);
    const stale = isGpsStale(bus.last_gps_timestamp);

    res.json({
      success: true,
      bus: {
        ...bus,
        is_stale: stale,
        gps_status: stale && bus.gps_status === 'active' ? 'stale' : bus.gps_status,
      },
      activeTrip,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tracking/status/:busId
router.get('/status/:busId', async (req: Request, res: Response) => {
  try {
    const busId = parseInt(req.params.busId, 10);
    const bus = await BusService.getBusById(busId);
    if (!bus) {
      res.status(404).json({ success: false, error: 'Bus not found' });
      return;
    }

    const stale = isGpsStale(bus.last_gps_timestamp);
    res.json({
      success: true,
      busId: bus.id,
      busNumber: bus.bus_number,
      gpsStatus: stale && bus.gps_status === 'active' ? 'stale' : bus.gps_status,
      lastUpdate: bus.last_gps_timestamp,
      isStale: stale,
      speed: bus.last_speed,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
