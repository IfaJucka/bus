# Background Web Push Notifications Technical Guide

## Smart College Bus Transportation System

---

### 1. Technology Architecture

The application implements standard Web Push via:
- **W3C Push API & Notifications API**
- **Service Worker (`client/public/sw.js`)**
- **VAPID (Voluntary Application Server Identification) Keys**
- **Backend Push Delivery (`web-push` library)**
- **Database Subscriptions:** Persisted in MySQL / embedded database in the `push_subscriptions` table.

---

### 2. Multi-Device Push Capabilities

Web Push notifications are delivered when:
- The website is open in the browser.
- The website tab is minimized or in the background.
- The website tab has been closed.
- The smartphone screen is locked (where supported by OS).
- The laptop browser is minimized.

---

### 3. VAPID Key Configuration

VAPID keys sign notification payloads securely without requiring third-party messaging SDKs.

- **Public Key:** Exposed to frontend clients for subscription requests via `GET /api/push/vapid-key`.
- **Private Key:** Stored securely on the backend server in environment variable `VAPID_PRIVATE_KEY`. Never exposed in frontend bundles!

---

### 4. Automated Notification Workflows

#### A. Five-Minute Bus Arrival Alert
1. The backend **Background Monitoring Worker** (`jobs/monitoringWorker.ts`) runs every 4 seconds independently of open student browsers.
2. It monitors active trips and recalculates road distances and ETAs along the predefined stop sequence.
3. When the calculated ETA for a student's preferred pickup point enters the **5-minute window** (between 1 and 6 minutes):
   - It checks whether an alert has already been sent for that trip, stop, and student.
   - If not sent, it dispatches the push payload:
     - **Title:** *Your College Bus Is Almost Here!*
     - **Message:** *Bus KA-47-A-1234 will arrive at Bhatkal Bus Stand in approx 5 minutes. Please be ready at the stop!*
   - Marks the alert as delivered to prevent duplicate alerts.

#### B. Significant Bus Delay Alert
1. Compares scheduled stop arrival time against current ETA.
2. If variance exceeds the delay threshold (≥ 5 minutes):
   - An alert is dispatched to students subscribed to affected stops along that route:
     - **Title:** *College Bus Delay Alert*
     - **Message:** *Bus KA-47-A-1234 is delayed by approx 10 minutes. Updated estimated arrival: 7:55 AM. Reason: Heavy traffic.*

---

### 5. iOS / Safari Web Push Requirements

On iOS / iPadOS (version 16.4+):
- Web Push is supported **only when the PWA is added to the Home Screen**.
- The student must open Safari, tap the **Share** button, and select **Add to Home Screen**.
- Once launched from the Home Screen icon, notification permissions can be requested and push messages received just like native applications.
