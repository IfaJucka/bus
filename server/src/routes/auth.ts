import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login and /api/login
router.post('/login', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { username, password, portal } = req.body || {};
    console.log('[LOGIN ATTEMPT]', {
      username: username || '(missing)',
      portal: portal || '(none)',
      origin: req.headers.origin || '(no-origin)',
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password required' });
      return;
    }

    const result = await AuthService.authenticate(username, password, portal);
    if (!result) {
      console.warn('[LOGIN FAILED] Invalid credentials for:', username);
      res.status(401).json({ success: false, error: 'Invalid credentials. Please verify your username and password.' });
      return;
    }

    if ('error' in result) {
      console.warn('[LOGIN FAILED] Portal mismatch for:', username, result.error);
      res.status(403).json({ success: false, error: result.error });
      return;
    }

    console.log('[LOGIN SUCCESS] User authenticated:', { id: result.user.id, username: result.user.username, role: result.user.role });
    res.json({ success: true, token: result.token, user: result.user });
  } catch (err: any) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/register-student
router.post('/register-student', async (req: Request, res: Response) => {
  try {
    const { username, password, fullName, studentId, email, phone, collegeName } = req.body;
    if (!username || !fullName) {
      res.status(400).json({ success: false, error: 'Username and Full Name are required' });
      return;
    }

    const result = await AuthService.registerStudent({
      username,
      password,
      fullName,
      studentId,
      email,
      phone,
      collegeName,
    });

    res.status(201).json({ success: true, token: result.token, user: result.user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const user = await AuthService.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/students (Admin only)
router.get('/students', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
      return;
    }
    const students = await AuthService.getAllStudents();
    res.json({ success: true, count: students.length, students });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
