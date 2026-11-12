# Installation and Setup Guide

## Smart College Bus Transportation System
**Real-Time GPS Tracking & Intelligent Bus Management Platform**

---

### 1. Prerequisites & Required Software

- **Operating System:** Windows 10/11, macOS, or Linux
- **Node.js:** v18.0.0 or higher (v20+ recommended). Check with `node -v`
- **npm:** v9.0.0 or higher. Check with `npm -v`
- **MySQL Server:** MySQL 8.0+ Community Server (running on port 3306)
- **Code Editor:** Visual Studio Code (VS Code)
- **Web Browser:** Modern Chromium browser (Chrome, Edge, Brave) or Safari (iOS 16.4+ for Web Push)

---

### 2. Project Directory Structure

```
smart-bus-tracking/
├── client/                     # Frontend: React, Vite, TypeScript, Tailwind CSS, Leaflet
│   ├── public/                 # Manifest, Service Worker, App Icons, Offline Fallback
│   └── src/                    # Components, Pages, Services, Context, Types
├── server/                     # Backend: Node.js, Express, Socket.IO, MySQL2, Web-Push
│   ├── src/                    # Controllers, Routes, Sockets, Jobs, Services, Database
│   └── data/                   # Embedded dataset fallback for instant zero-config boot
├── database/
│   ├── schema.sql              # Relational MySQL DDL Schema (18 tables, indexes, FKs)
│   └── seeds.sql               # Development seeds (Routes, Stops, Buses, Drivers, History)
├── docs/                       # Technical guides & documentation
├── .env.example                # Environment variables template
└── README.md
```

---

### 3. MySQL Database Setup

1. Open MySQL Command Line Client or MySQL Workbench.
2. Connect as `root` (or your privileged user).
3. Execute the schema and seed scripts:

```sql
-- 1. Create database and tables
SOURCE path/to/smart-bus-tracking/database/schema.sql;

-- 2. Populate development seeds
SOURCE path/to/smart-bus-tracking/database/seeds.sql;
```

Alternatively, from the Windows Command Prompt / PowerShell:
```powershell
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seeds.sql
```

> **Note on Zero-Config Fallback:** If MySQL credentials are not yet configured or MySQL is temporarily unreachable, the backend automatically boots using persistent embedded relational storage (`server/data/smart_bus.json`). All features, foreign keys, routes, stops, and real-time GPS tracking remain 100% active!

---

### 4. Environment Variables Configuration

Copy `.env.example` to `server/.env`:
```powershell
copy .env.example server\.env
```

Configure your environment settings in `server/.env`:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MySQL Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=smart_bus_tracking

# Security Secrets
JWT_SECRET=smart_bus_jwt_super_secure_secret_key_2026_x98

# Web Push VAPID Keys
VAPID_PUBLIC_KEY=BM_l6FZ9X7AXHfMyz5IHbz8PzlvssEtlAqWOCLitPV-dv4lDSGWZcM_pMb7PxNl3MdakifE2zxTPWEu4OmYoakw
VAPID_PRIVATE_KEY=Okh52QW5Ey7G0rCVNy053ermrM8e8Zp_hRszg-P6Uhc
VAPID_SUBJECT=mailto:admin@anjuman.edu
```

---

### 5. Running the Application in VS Code

For standard execution, open two separate terminal tabs in VS Code:

#### **Terminal 1: Start Backend Server**
```powershell
cd server
npm run dev
```
*Backend runs at:* `http://localhost:5000`

#### **Terminal 2: Start Frontend Application**
```powershell
cd client
npm run dev
```
*Frontend runs at:* `http://localhost:5173`

---

### 6. User Access Credentials

| Role | Username | Password | Access URL |
|---|---|---|---|
| **System Administrator** | `admin` | `admin123` | `http://localhost:5173/admin` |
| **Driver 1 (Ramesh)** | `driver1` | `driver123` | `http://localhost:5173/driver` |
| **Driver 2 (Suresh)** | `driver2` | `driver123` | `http://localhost:5173/driver` |
| **Student** | Public / `student1` | `student123` | `http://localhost:5173/` |

---

### 7. Verifying Application Features

1. **Student Dashboard (`http://localhost:5173/`):**
   - View personalized greeting and active bus status.
   - Click **TRACK MY BUS** to inspect the live map.
   - Search and select your preferred pickup point (e.g. *Bhatkal Bus Stand*).
   - Inspect the **7-Day Historical Timings table** and weekly on-time punctuality percentages.
   - Submit a student complaint and verify the auto-generated reference number (e.g. `CMP-1002`).

2. **Driver GPS Transmitter (`http://localhost:5173/driver`):**
   - Select Bus `KA-47-A-1234` and Route `Murdeshwar to College`.
   - Click **START TRIP & ACTIVATE GPS**.
   - Watch live coordinates, speed, and heading update.
   - Use the **Report Delay** modal to broadcast a 10-minute traffic delay.

3. **Admin Dashboard (`http://localhost:5173/admin`):**
   - Log in with `admin` / `admin123`.
   - Review fleet KPI metrics (buses running, GPS active, delays, complaints).
   - Add a new bus or pickup stop coordinate.
   - Review submitted student complaints, change status to *Resolved*, and record resolution notes.
   - Broadcast fleet announcements.

4. **Automated Test Suite:**
   Run the test suite in the `server` directory:
   ```powershell
   cd server
   npm test
   ```
   *Expected output: 11 tests pass with 0 failures.*
