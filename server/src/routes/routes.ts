import { Router, Request, Response } from 'express';
import { RouteService } from '../services/routeService';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { calculateRoadNetworkRoute } from '../utils/geo';

const router = Router();

// POST /api/routes/calculate-road-path (Calculates road geometry and distance via OSRM)
router.post('/calculate-road-path', async (req: Request, res: Response) => {
  try {
    const { stops } = req.body;
    if (!Array.isArray(stops) || stops.length < 2) {
      res.status(400).json({ success: false, error: 'At least 2 stop coordinates are required' });
      return;
    }

    const roadResult = await calculateRoadNetworkRoute(stops);
    res.json({ success: true, ...roadResult });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/routes
router.get('/', async (req: Request, res: Response) => {
  try {
    const routes = await RouteService.getAllRoutes();
    res.json({ success: true, count: routes.length, routes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/routes/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const route = await RouteService.getRouteById(id);
    if (!route) {
      res.status(404).json({ success: false, error: 'Route not found' });
      return;
    }
    res.json({ success: true, route });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/routes (Admin only)
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { route_name, start_point, destination, operating_days, estimated_duration_mins, total_distance_km, road_geometry, stops, bus_id } = req.body;
    if (!route_name || !start_point || !destination) {
      res.status(400).json({ success: false, error: 'Route name, start point, and destination are required' });
      return;
    }

    const route = await RouteService.createRoute({
      route_name,
      start_point,
      destination,
      operating_days,
      estimated_duration_mins,
      total_distance_km,
      road_geometry,
      stops,
      bus_id: bus_id ? parseInt(bus_id, 10) : undefined,
    });

    res.status(201).json({ success: true, route });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/routes/:id (Admin only)
router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const route = await RouteService.updateRoute(id, req.body);
    if (!route) {
      res.status(404).json({ success: false, error: 'Route not found' });
      return;
    }
    res.json({ success: true, route });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/routes/:id (Admin only)
router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await RouteService.deleteRoute(id);
    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
