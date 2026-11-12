import { Router, Request, Response } from 'express';
import { TripService } from '../services/tripService';
import { SocketHandler } from '../sockets/socketHandler';

const router = Router();

// GET /api/trips
router.get('/', async (req: Request, res: Response) => {
  try {
    const trips = await TripService.getAllTrips();
    res.json({ success: true, count: trips.length, trips });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/trips/:tripId
router.get('/:tripId', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId, 10);
    const trip = await TripService.getTripById(tripId);
    if (!trip) {
      res.status(404).json({ success: false, error: 'Trip not found' });
      return;
    }
    res.json({ success: true, trip });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/trips/:tripId/stop-events
router.get('/:tripId/stop-events', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId, 10);
    const events = await TripService.getTripStopEvents(tripId);
    res.json({ success: true, count: events.length, events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/trips/start
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { busId, driverId, routeId, isDemo, initialLat, initialLng } = req.body;
    if (!busId || !driverId || !routeId) {
      res.status(400).json({ success: false, error: 'busId, driverId, and routeId are required' });
      return;
    }

    const trip = await TripService.startTrip({
      busId: parseInt(busId, 10),
      driverId: parseInt(driverId, 10),
      routeId: parseInt(routeId, 10),
      isDemo: Boolean(isDemo),
      initialLat,
      initialLng,
    });

    SocketHandler.broadcastTripStarted(trip);
    res.status(201).json({ success: true, trip });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/trips/:tripId/end
router.post('/:tripId/end', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId, 10);
    const trip = await TripService.endTrip(tripId);
    SocketHandler.broadcastTripEnded(trip);
    res.json({ success: true, trip });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/trips/:tripId/delay
router.post('/:tripId/delay', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId, 10);
    const { delayMinutes, reason } = req.body;
    if (delayMinutes === undefined || !reason) {
      res.status(400).json({ success: false, error: 'delayMinutes and reason are required' });
      return;
    }

    await TripService.reportDelay(tripId, parseInt(delayMinutes, 10), reason);
    res.json({ success: true, message: 'Delay reported and broadcasted to students' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
