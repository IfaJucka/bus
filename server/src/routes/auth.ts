import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, portal } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password required' });
      return;
    }

    const result = await AuthService.authenticate(username, password, portal);
    if (!result) {
      res.status(401).json({ success: false, error: 'Invalid credentials. Please verify your username and password.' });
      return;
    }

    if ('error' in result) {
      res.status(403).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, token: result.token, user: result.user });
  } catch (err: any) {
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
