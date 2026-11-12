import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';
import { db } from '../database';

const router = Router();

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const studentIdentifier = req.query.studentId as string;
    const notifications = await NotificationService.getNotifications(studentIdentifier);
    res.json({ success: true, count: notifications.length, notifications });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications (Admin announcement)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, message, category, studentIdentifier, busId, routeId } = req.body;
    if (!title || !message) {
      res.status(400).json({ success: false, error: 'Title and message are required' });
      return;
    }

    const notification = await NotificationService.createNotification({
      title,
      message,
      category: category || 'announcement',
      studentIdentifier,
      busId: busId ? parseInt(busId, 10) : null,
      routeId: routeId ? parseInt(routeId, 10) : null,
    });

    res.status(201).json({ success: true, notification });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await NotificationService.markAsRead(id);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', async (req: Request, res: Response) => {
  try {
    const { studentIdentifier } = req.body;
    await NotificationService.markAllAsRead(studentIdentifier);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/preferences
router.post('/preferences', async (req: Request, res: Response) => {
  try {
    const {
      studentIdentifier,
      userId,
      busId,
      routeId,
      pickupPointId,
      notification5minEnabled,
      notificationDelayEnabled,
      notificationTripStartEnabled,
    } = req.body;

    if (!studentIdentifier) {
      res.status(400).json({ success: false, error: 'studentIdentifier is required' });
      return;
    }

    const record = {
      user_id: userId ? parseInt(userId, 10) : null,
      student_identifier: studentIdentifier,
      bus_id: busId ? parseInt(busId, 10) : null,
      route_id: routeId ? parseInt(routeId, 10) : null,
      pickup_point_id: pickupPointId ? parseInt(pickupPointId, 10) : null,
      notification_5min_enabled: notification5minEnabled !== false ? 1 : 0,
      notification_delay_enabled: notificationDelayEnabled !== false ? 1 : 0,
      notification_trip_start_enabled: notificationTripStartEnabled !== false ? 1 : 0,
      updated_at: new Date().toISOString(),
    };

    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        `INSERT INTO student_pickup_preferences (
          user_id, student_identifier, bus_id, route_id, pickup_point_id,
          notification_5min_enabled, notification_delay_enabled, notification_trip_start_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          bus_id = VALUES(bus_id),
          route_id = VALUES(route_id),
          pickup_point_id = VALUES(pickup_point_id),
          notification_5min_enabled = VALUES(notification_5min_enabled),
          notification_delay_enabled = VALUES(notification_delay_enabled),
          notification_trip_start_enabled = VALUES(notification_trip_start_enabled)`,
        [
          record.user_id,
          record.student_identifier,
          record.bus_id,
          record.route_id,
          record.pickup_point_id,
          record.notification_5min_enabled,
          record.notification_delay_enabled,
          record.notification_trip_start_enabled,
        ]
      );
    } else {
      const table = db.getTable('student_pickup_preferences');
      const idx = table.findIndex((p) => p.student_identifier === studentIdentifier);
      if (idx !== -1) {
        table[idx] = { ...table[idx], ...record };
      } else {
        db.insertRecord('student_pickup_preferences', record);
      }
      db.saveEmbeddedData();
    }

    res.json({ success: true, message: 'Preferences updated successfully', preferences: record });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/notifications/preferences/:studentId
router.get('/preferences/:studentId', async (req: Request, res: Response) => {
  try {
    const studentIdentifier = req.params.studentId;
    let pref: any = null;

    if (db.mode === 'mysql' && db.getPool()) {
      const rows: any = await db.query(
        'SELECT * FROM student_pickup_preferences WHERE student_identifier = ? LIMIT 1',
        [studentIdentifier]
      );
      pref = rows[0] || null;
    } else {
      const table = db.getTable('student_pickup_preferences');
      pref = table.find((p) => p.student_identifier === studentIdentifier) || null;
    }

    res.json({ success: true, preferences: pref });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
