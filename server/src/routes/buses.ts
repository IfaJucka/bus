import { Router, Request, Response } from 'express';
import { BusService } from '../services/busService';
import { authenticateJWT, requireRole, optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/buses (Public sees active buses; authenticated Admin sees all buses)
router.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const buses = await BusService.getAllBuses(isAdmin);
    res.json({ success: true, count: buses.length, buses });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/buses/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const bus = await BusService.getBusById(id);
    if (!bus) {
      res.status(404).json({ success: false, error: 'Bus not found' });
      return;
    }
    res.json({ success: true, bus });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/buses (Admin only)
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { bus_number, bus_name, registration_number, capacity, assigned_driver_id, assigned_route_id } = req.body;
    if (!bus_number || !bus_name) {
      res.status(400).json({ success: false, error: 'Bus number and bus name are required' });
      return;
    }

    const bus = await BusService.createBus({
      bus_number,
      bus_name,
      registration_number,
      capacity,
      assigned_driver_id: assigned_driver_id ? parseInt(assigned_driver_id, 10) : null,
      assigned_route_id: assigned_route_id ? parseInt(assigned_route_id, 10) : null,
    });

    res.status(201).json({ success: true, bus });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/buses/:id (Admin only)
router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updates = { ...req.body };
    if ('assigned_driver_id' in updates) {
      updates.assigned_driver_id = updates.assigned_driver_id ? parseInt(updates.assigned_driver_id, 10) : null;
    }
    if ('assigned_route_id' in updates) {
      updates.assigned_route_id = updates.assigned_route_id ? parseInt(updates.assigned_route_id, 10) : null;
    }
    if ('capacity' in updates && updates.capacity) {
      updates.capacity = parseInt(updates.capacity, 10);
    }

    const bus = await BusService.updateBus(id, updates);
    if (!bus) {
      res.status(404).json({ success: false, error: 'Bus not found' });
      return;
    }
    res.json({ success: true, bus });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/buses/:id (Admin only)
router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await BusService.deleteBus(id);
    res.json({ success: true, message: 'Bus deactivated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
