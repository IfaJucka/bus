import { Router, Request, Response } from 'express';
import { RouteService } from '../services/routeService';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/pickup-points
router.get('/', async (req: Request, res: Response) => {
  try {
    const pickupPoints = await RouteService.getAllPickupPoints();
    res.json({ success: true, count: pickupPoints.length, pickupPoints });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/pickup-points (Admin only)
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { name, latitude, longitude, landmark } = req.body;
    if (!name || latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, error: 'Name, latitude, and longitude are required' });
      return;
    }

    const point = await RouteService.createPickupPoint({
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      landmark,
    });

    res.status(201).json({ success: true, pickupPoint: point });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/pickup-points/:id (Admin only)
router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const point = await RouteService.updatePickupPoint(id, req.body);
    if (!point) {
      res.status(404).json({ success: false, error: 'Pickup point not found' });
      return;
    }
    res.json({ success: true, pickupPoint: point });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/pickup-points/:id (Admin only)
router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await RouteService.deletePickupPoint(id);
    res.json({ success: true, message: 'Pickup point removed successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
