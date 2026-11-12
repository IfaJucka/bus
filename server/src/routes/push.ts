import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';
import { config } from '../config/env';

const router = Router();

// GET /api/push/vapid-key
router.get('/vapid-key', (req: Request, res: Response) => {
  res.json({
    success: true,
    publicKey: config.vapid.publicKey,
  });
});

// POST /api/push/subscribe
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { subscription, studentIdentifier } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      res.status(400).json({ success: false, error: 'Valid PushSubscription required' });
      return;
    }

    const studentId = studentIdentifier || '*';
    const userAgent = req.headers['user-agent'];

    await NotificationService.savePushSubscription(studentId, subscription, userAgent);
    res.status(201).json({ success: true, message: 'Web push subscription registered successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/push/test
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { studentIdentifier } = req.body;
    const studentId = studentIdentifier || '*';

    const count = await NotificationService.sendPushToStudent(studentId, {
      title: 'Smart Bus Test Notification 🚌',
      body: 'Web push notifications are working smoothly on your device! You will receive 5-minute arrival and delay alerts.',
      data: { url: '/' },
    });

    res.json({
      success: true,
      deliveredToDevices: count,
      message: count > 0 ? `Notification delivered to ${count} device(s)` : 'No active push subscriptions found for this student.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
