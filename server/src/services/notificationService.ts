import webPush from 'web-push';
import { db } from '../database';
import { config } from '../config/env';

// Configure Web Push with VAPID details
webPush.setVapidDetails(
  config.vapid.subject,
  config.vapid.publicKey,
  config.vapid.privateKey
);

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class NotificationService {
  // In-memory set to prevent duplicate alerts within same trip lifecycle: `${tripId}_${stopId}_${studentId}_${type}`
  private static sentAlertKeySet: Set<string> = new Set();

  /**
   * Reset sent alert keys when trip starts or ends
   */
  public static resetAlertsForTrip(tripId: number): void {
    const prefix = `${tripId}_`;
    for (const key of this.sentAlertKeySet) {
      if (key.startsWith(prefix)) {
        this.sentAlertKeySet.delete(key);
      }
    }
  }

  /**
   * Check if alert has already been sent
   */
  public static hasAlertBeenSent(tripId: number, stopId: number, studentId: string, alertType: string): boolean {
    const key = `${tripId}_${stopId}_${studentId}_${alertType}`;
    return this.sentAlertKeySet.has(key);
  }

  /**
   * Mark alert as sent
   */
  public static markAlertSent(tripId: number, stopId: number, studentId: string, alertType: string): void {
    const key = `${tripId}_${stopId}_${studentId}_${alertType}`;
    this.sentAlertKeySet.add(key);
  }

  /**
   * Save Web Push subscription for a student
   */
  public static async savePushSubscription(studentIdentifier: string, sub: PushSubscriptionData, userAgent?: string): Promise<any> {
    const record = {
      user_id: null,
      student_identifier: studentIdentifier,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent || 'Browser',
      is_active: 1,
    };

    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        `INSERT INTO push_subscriptions (student_identifier, endpoint, p256dh, auth, user_agent, is_active)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth), is_active = 1`,
        [record.student_identifier, record.endpoint, record.p256dh, record.auth, record.user_agent]
      );
      return record;
    }

    const table = db.getTable('push_subscriptions');
    const existingIndex = table.findIndex((s) => s.endpoint === sub.endpoint);
    if (existingIndex !== -1) {
      table[existingIndex] = { ...table[existingIndex], ...record, updated_at: new Date().toISOString() };
    } else {
      db.insertRecord('push_subscriptions', record);
    }
    return record;
  }

  /**
   * Send Web Push notification to all active devices subscribed to student
   */
  public static async sendPushToStudent(studentIdentifier: string, payload: { title: string; body: string; icon?: string; data?: any }): Promise<number> {
    let subscriptions: any[] = [];

    if (db.mode === 'mysql' && db.getPool()) {
      subscriptions = await db.query(
        'SELECT * FROM push_subscriptions WHERE (student_identifier = ? OR student_identifier = "*") AND is_active = 1',
        [studentIdentifier]
      );
    } else {
      const table = db.getTable('push_subscriptions');
      subscriptions = table.filter((s) => (s.student_identifier === studentIdentifier || s.student_identifier === '*') && s.is_active === 1);
    }

    let successCount = 0;
    const payloadStr = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: payload.data || {},
    });

    for (const sub of subscriptions) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webPush.sendNotification(pushSub, payloadStr);
        successCount++;
      } catch (err: any) {
        // If expired or gone (410 / 404), mark subscription inactive
        if (err.statusCode === 410 || err.statusCode === 404) {
          if (db.mode === 'mysql' && db.getPool()) {
            await db.query('UPDATE push_subscriptions SET is_active = 0 WHERE id = ?', [sub.id]);
          } else {
            db.updateRecord('push_subscriptions', sub.id, { is_active: 0 });
          }
        }
        console.warn(`[Push] Delivery notice: ${err.message}`);
      }
    }

    return successCount;
  }

  /**
   * Create an in-app notification & dispatch push
   */
  public static async createNotification(data: {
    studentIdentifier?: string;
    userId?: number | null;
    busId?: number | null;
    routeId?: number | null;
    tripId?: number | null;
    pickupPointId?: number | null;
    title: string;
    message: string;
    category: '5min_arrival' | 'delay_alert' | 'trip_started' | 'route_changed' | 'service_interruption' | 'announcement' | 'gps_alert';
    metadata?: any;
  }): Promise<any> {
    const record = {
      user_id: data.userId || null,
      student_identifier: data.studentIdentifier || '*',
      bus_id: data.busId || null,
      route_id: data.routeId || null,
      trip_id: data.tripId || null,
      pickup_point_id: data.pickupPointId || null,
      title: data.title,
      message: data.message,
      category: data.category,
      is_read: 0,
      metadata: data.metadata ? (typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata)) : null,
    };

    let savedNotif: any;

    if (db.mode === 'mysql' && db.getPool()) {
      const res: any = await db.query(
        `INSERT INTO notifications (user_id, student_identifier, bus_id, route_id, trip_id, pickup_point_id, title, message, category, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [record.user_id, record.student_identifier, record.bus_id, record.route_id, record.trip_id, record.pickup_point_id, record.title, record.message, record.category]
      );
      savedNotif = { id: res.insertId, ...record, created_at: new Date().toISOString() };
    } else {
      savedNotif = db.insertRecord('notifications', record);
    }

    // Attempt Web Push deliver
    if (data.studentIdentifier) {
      await this.sendPushToStudent(data.studentIdentifier, {
        title: data.title,
        body: data.message,
        data: { notifId: savedNotif.id, category: data.category, busId: data.busId },
      });
    }

    return savedNotif;
  }

  /**
   * Get notifications for a student
   */
  public static async getNotifications(studentIdentifier?: string): Promise<any[]> {
    if (db.mode === 'mysql' && db.getPool()) {
      if (studentIdentifier) {
        return db.query(
          'SELECT * FROM notifications WHERE student_identifier = ? OR student_identifier = "*" ORDER BY created_at DESC LIMIT 50',
          [studentIdentifier]
        );
      }
      return db.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
    }

    const table = db.getTable('notifications');
    let items = [...table];
    if (studentIdentifier) {
      items = items.filter((n) => n.student_identifier === studentIdentifier || n.student_identifier === '*');
    }
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);
  }

  /**
   * Mark notification as read
   */
  public static async markAsRead(id: number): Promise<boolean> {
    if (db.mode === 'mysql' && db.getPool()) {
      await db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
      return true;
    }
    const updated = db.updateRecord('notifications', id, { is_read: 1 });
    if (db.supabaseClient) {
      try {
        await db.supabaseClient.from('notifications').update({ is_read: 1 }).eq('id', id);
      } catch (e: any) {
        console.warn('[NotificationService] Supabase markAsRead warning:', e.message);
      }
    }
    return updated !== null;
  }

  /**
   * Mark all notifications as read for student
   */
  public static async markAllAsRead(studentIdentifier?: string): Promise<boolean> {
    const student = studentIdentifier || '*';
    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        'UPDATE notifications SET is_read = 1 WHERE student_identifier = ? OR student_identifier = "*"',
        [student]
      );
      return true;
    }

    const notifs = db.getTable<any>('notifications');
    for (const n of notifs) {
      if (!studentIdentifier || n.student_identifier === '*' || n.student_identifier === studentIdentifier) {
        n.is_read = 1;
      }
    }
    db.saveEmbeddedData();

    if (db.supabaseClient) {
      try {
        await db.supabaseClient
          .from('notifications')
          .update({ is_read: 1 })
          .or(`student_identifier.eq.*,student_identifier.eq.${student}`);
      } catch (e: any) {
        console.warn('[NotificationService] Supabase markAllAsRead warning:', e.message);
      }
    }

    return true;
  }
}
