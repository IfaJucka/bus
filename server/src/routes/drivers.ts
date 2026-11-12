import { Router, Request, Response } from 'express';
import { RouteService } from '../services/routeService';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/drivers (Accessible to authenticated or public overview)
router.get('/', async (req: Request, res: Response) => {
  try {
    const drivers = await RouteService.getAllDrivers();
    res.json({ success: true, count: drivers.length, drivers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/drivers (Admin only)
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { full_name, phone, employee_id, license_number, assigned_bus_id } = req.body;
    if (!full_name || !phone) {
      res.status(400).json({ success: false, error: 'Full name and phone are required' });
      return;
    }

    const driver = await RouteService.createDriver({
      full_name,
      phone,
      employee_id,
      license_number,
      assigned_bus_id: assigned_bus_id ? parseInt(assigned_bus_id, 10) : null,
    });
    res.status(201).json({ success: true, driver });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/drivers/:id (Admin only)
router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const driver = await RouteService.updateDriver(id, req.body);
    if (!driver) {
      res.status(404).json({ success: false, error: 'Driver not found' });
      return;
    }
    res.json({ success: true, driver });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/drivers/:id (Admin only)
router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await RouteService.deleteDriver(id);
    res.json({ success: true, message: 'Driver deactivated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
