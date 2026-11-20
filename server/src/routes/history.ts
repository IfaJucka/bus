import { Router, Request, Response } from 'express';
import { HistoryService } from '../services/historyService';
import { db } from '../database';

const router = Router();

// GET /api/history/arrivals
router.get('/arrivals', async (req: Request, res: Response) => {
  try {
    const busId = parseInt((req.query.busId as string) || '1', 10);
    const pickupPointId = parseInt((req.query.pickupPointId as string) || '2', 10);
    const days = parseInt((req.query.days as string) || '7', 10);

    const result = await HistoryService.getSevenDayArrivals(busId, pickupPointId, days);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/history/bus/:busId
router.get('/bus/:busId', async (req: Request, res: Response) => {
  try {
    const busId = parseInt(req.params.busId, 10);
    let trips: any[] = [];

    if (db.mode === 'mysql' && db.getPool()) {
      trips = await db.query(
        'SELECT * FROM trips WHERE bus_id = ? ORDER BY trip_date DESC, id DESC LIMIT 50',
        [busId]
      );
    } else {
      const all = db.getTable('trips');
      trips = all.filter((t) => t.bus_id === busId).sort((a, b) => b.id - a.id);
    }

    res.json({ success: true, count: trips.length, trips });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/history/weekly-summary
router.get('/weekly-summary', async (req: Request, res: Response) => {
  try {
    const busId = parseInt((req.query.busId as string) || '1', 10);
    const pickupPointId = parseInt((req.query.pickupPointId as string) || '2', 10);

    const { stats } = await HistoryService.getSevenDayArrivals(busId, pickupPointId, 7);
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/history/day-route
router.get('/day-route', async (req: Request, res: Response) => {
  try {
    const busId = parseInt((req.query.busId as string) || '1', 10);
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const result = await HistoryService.getDayRoute(busId, date);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
