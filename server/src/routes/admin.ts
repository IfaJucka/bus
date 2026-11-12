import { Router, Response } from 'express';
import { db } from '../database';
import { config } from '../config/env';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/admin/supabase-status
router.get('/supabase-status', async (req: AuthenticatedRequest, res: Response) => {
  const isConfigured = Boolean(config.supabase.url && (config.supabase.serviceKey || config.supabase.anonKey));
  res.json({
    success: true,
    supabase: {
      isConfigured,
      isConnected: db.supabaseConnected,
      mode: db.mode,
      url: config.supabase.url ? config.supabase.url.replace(/(https?:\/\/)(.{4}).*(.{6})/, '$1$2***$3') : null,
      error: db.supabaseError,
      records: {
        users: db.getTable('users').length,
        buses: db.getTable('buses').length,
        drivers: db.getTable('drivers').length,
        routes: db.getTable('routes').length,
        pickup_points: db.getTable('pickup_points').length,
        trips: db.getTable('trips').length,
        notifications: db.getTable('notifications').length,
        complaints: db.getTable('complaints').length,
      },
    },
  });
});

// POST /api/admin/supabase-sync (sync local data to Supabase)
router.post('/supabase-sync', authenticateJWT, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!db.supabaseClient) {
      res.status(400).json({
        success: false,
        error: 'Supabase is not configured yet. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
      });
      return;
    }

    const result = await db.syncToSupabase();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/supabase-pull (pull Supabase data into local state)
router.post('/supabase-pull', authenticateJWT, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!db.supabaseClient) {
      res.status(400).json({
        success: false,
        error: 'Supabase is not configured yet. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
      });
      return;
    }

    await db.pullFromSupabase();
    res.json({ success: true, message: 'Local cache updated from Supabase PostgreSQL!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
