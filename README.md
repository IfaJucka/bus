# Smart College Bus Transportation System
### Real-Time GPS Tracking & Intelligent Bus Management Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.4-38B2AC.svg)](https://tailwindcss.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.7-black.svg)](https://socket.io/)
[![PWA](https://img.shields.io/badge/PWA-Installable-purple.svg)](https://web.dev/progressive-web-apps/)

---

## 1. Project Overview

The **Smart College Bus Transportation System** is a modern, fully functional, responsive transportation platform engineered for college transit operations. It enables students to track college buses in real time, check route-aware arrival estimates (ETA) at their selected pickup points, receive automated 5-minute arrival and delay notifications, investigate 7-day historical punctuality timings, and lodge complaints.

Simultaneously, it equips fleet administrators and drivers with role-based interfaces for bus inventory management, route scheduling, real device GPS streaming, delay broadcasts, and complaint resolution.

---

## 2. Coordinated Visual Color Palette

The user interface adheres to a clean, minimal, student-friendly light blue and cream visual palette:

| Element | Color Name | Hex Code | Purpose |
|---|---|---|---|
| **Primary** | Light Blue | `#A9D6F5` | Main highlights, branding accents, badge backgrounds |
| **Secondary** | Soft Blue | `#D9ECFA` | Sub-nav pills, subtle containers, table headers |
| **Background** | Warm Cream | `#FFF8E7` | Primary page body background |
| **Cards** | Clean White | `#FFFFFF` | Rounded cards, modals, content containers |
| **Accent** | Muted Blue | `#6FA8D6` | Primary action buttons, route polylines, focus rings |
| **Main Text** | Dark Navy | `#263746` | High-contrast headers, bold data points, icons |
| **Secondary Text** | Gray-Blue | `#657786` | Subtitles, helper text, timestamps |
| **Success** | Soft Green | `#2E7D32` | On-time badges, verified GPS active indicators |
| **Warning** | Muted Amber | `#D97706` | Delay alerts, GPS stale notifications |
| **Error** | Soft Red | `#DC2626` | GPS offline warnings, rejected complaint status |

---

## 3. Key Implemented Features

### 🎓 A. Student Dashboard
- **Welcome Hero Section:** Personalized dynamic morning/afternoon greeting, active bus status badge, live ETA readout, and primary **TRACK MY BUS** trigger.
- **Student Details Form:** Persistent storage of name, student ID, phone, email, college, and preferred pickup point (persisted in DB and `localStorage`).
- **Available Buses Grid:** Live fleet cards showing bus numbers, driver names & contact, assigned routes, status badges, next departure, and ETA.
- **Interactive Live Map:**
  - Full-size interactive Leaflet map using OpenStreetMap tiles.
  - Bus marker featuring heading rotation, live pulse aura, and speed badge.
  - Predefined route polylines connecting all sequential stops along NH 66.
  - Highlighted pickup point marker for the student's selected stop.
  - Live telemetry card displaying road distance (km), ETA (mins), speed (km/h), coordinates, and last GPS timestamp.
  - Distinct handling for missing/stale GPS data (*"Waiting for GPS signal"*).
- **Pickup Point Selection:** Searchable stop list + map stop picker.
- **7-Day Historical Arrival Timings:**
  - Complete 7-day performance table comparing scheduled vs. actual arrival times and delay variances.
  - Analytical metrics: Average arrival time, average delay, earliest/latest recorded arrival, and on-time arrival percentage.
- **Feedback & Complaints System:**
  - Submits complaints across 8 categories with automatic reference number generation (`CMP-1001`, `CMP-1002`).
  - Searchable complaint status tracker by reference ID.

### 🛡️ B. Administrator Dashboard
- **Secure Authentication:** Protected route `/admin` with bcrypt password hashing and JWT sessions.
- **Fleet KPI Metrics:** Total buses, active buses, buses running, GPS connected, delayed, routes, drivers, and open complaints.
- **Bus Management:** Add new bus, edit, assign driver/route, deactivate, start/stop tracking.
- **Driver Management:** Add driver, edit phone, employee ID, and license details.
- **Route & Stop Management:** Predefined routes with ordered stops, arrival/departure schedules, and operating days (Mon-Sat).
- **Pickup Point Coordinator:** Coordinates lat/lng coordinates and landmarks.
- **Live GPS Fleet Telemetry Table:** Real-time stream of coordinates, speed, and freshness health.
- **Delay Alerts & Fleet Announcements:** Declare manual delays or send system-wide announcements to all students.
- **Complaint Management:** Filter complaints by status (*New, Under Review, In Progress, Resolved, Rejected*), record resolution notes, and assign resolver name.

### 🚌 C. Driver GPS Tracking Portal (`/driver`)
- Mobile-first interface designed for mobile phone dashboard mounts.
- Select assigned bus and route.
- **START TRIP** and **END TRIP** lifecycle management.
- Real Browser Geolocation API (`navigator.geolocation.watchPosition`) streaming coordinates every 3-5 seconds.
- Live speed (km/h), heading (°), accuracy (m), and connection health display.
- One-click **Report Delay** modal with delay reason presets and minutes slider.
- Clearly labeled **Demo GPS Simulation** toggle for testing when stationary.

### 📲 D. Background Web Push Notifications & Installable PWA
- **Progressive Web App (PWA):** `manifest.webmanifest`, branded `offline.html` fallback, and service worker `sw.js`.
- **Add to Home Screen:** Custom installation banner supporting Android/Chromium `beforeinstallprompt` and iOS Safari step-by-step walkthrough modal.
- **Web Push Notifications:** Signed with VAPID keys; delivers alerts even when the browser tab is minimized or closed.
- **Automatic 5-Minute Arrival Alert:** Background worker evaluates active trips every 4 seconds and triggers push alerts when bus is ~5 minutes away from student's pickup stop.
- **Automatic Delay Alerts:** Compares scheduled arrival against live ETA and dispatches alerts for delays ≥ 5 minutes.
- **Duplicate Prevention:** Tracks delivered alerts per trip, student, and stop to prevent spamming.

---

## 4. Technology Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router, Lucide React, Leaflet, Socket.IO Client.
- **Backend:** Node.js, Express, Socket.IO, MySQL2, `web-push`, JWT, bcryptjs, TypeScript, TSX.
- **Database:** MySQL 8.0+ Relational Schema (18 tables, foreign keys, indexes, seeds) + Embedded zero-config fallback storage engine (`server/data/smart_bus.json`).
- **Testing:** Built-in Node test runner (`node:test`, `node:assert`).

---

## 5. Quick Start Instructions

### 1. Clone & Install Dependencies
```powershell
# In project root:
cd server
npm install
cd ../client
npm install
```

### 2. Configure Environment Variables
```powershell
copy .env.example server\.env
```

### 3. Launch Backend Server
In VS Code Terminal 1:
```powershell
cd server
npm run dev
```
*Backend active on:* `http://localhost:5000`

### 4. Launch Frontend Application
In VS Code Terminal 2:
```powershell
cd client
npm run dev
```
*Frontend active on:* `http://localhost:5173`

### 5. Run Automated Tests
```powershell
cd server
npm test
```
*Result: 11 tests pass with 0 errors.*

---

## 6. Default Login Credentials

| Role | Username | Password | URL |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | `http://localhost:5173/admin` |
| **Driver 1** | `driver1` | `driver123` | `http://localhost:5173/driver` |
| **Driver 2** | `driver2` | `driver123` | `http://localhost:5173/driver` |
| **Student** | Public / `student1` | `student123` | `http://localhost:5173/` |

---

## 7. License & Attribution

Built for **Anjuman Institute of Technology & Management** Transit Fleet.
OpenStreetMap map tiles © OpenStreetMap contributors.
