import { api } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class PushNotificationService {
  public static isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  public static getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  public static async requestPermissionAndSubscribe(studentIdentifier: string = '*'): Promise<{
    success: boolean;
    permission: NotificationPermission;
    error?: string;
  }> {
    if (!this.isSupported()) {
      return {
        success: false,
        permission: 'denied',
        error: 'Web Push Notifications are not supported in this browser.',
      };
    }

    try {
      // 1. Request Browser Permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return {
          success: false,
          permission,
          error: 'Notification permission was denied. You can re-enable notifications in your browser or device site settings.',
        };
      }

      // 2. Ensure Service Worker Registration
      const registration = await navigator.serviceWorker.ready;

      // 3. Get VAPID Public Key from server
      const publicKey = await api.push.getVapidKey();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // 4. Create Push Subscription
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any,
        });
      }

      // 5. Send subscription to server
      await api.push.subscribe(subscription, studentIdentifier);

      return {
        success: true,
        permission: 'granted',
      };
    } catch (err: any) {
      console.error('[Web Push] Subscription error:', err);
      return {
        success: false,
        permission: this.getPermissionStatus(),
        error: err.message || 'Failed to register push subscription.',
      };
    }
  }

  public static async sendTestNotification(studentIdentifier?: string): Promise<any> {
    return api.push.sendTest(studentIdentifier);
  }
}
