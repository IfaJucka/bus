# Real-Time GPS Tracking Technical Guide

## Smart College Bus Transportation System

---

### 1. Architectural Distinction

This system makes a fundamental distinction between three functions:
1. **Displaying a Map:** Rendering tile layers, polylines, and UI markers using Leaflet and OpenStreetMap.
2. **Obtaining Device GPS Coordinates:** Requesting high-accuracy coordinates via hardware GPS.
3. **Continuous Tracking & Fleet Telemetry Distribution:** Streaming verified coordinates from the vehicle to the backend and distributing live ETAs to connected students via WebSockets (Socket.IO).

The map provider does **not** generate bus locations. Actual GPS hardware is required.

---

### 2. Supported GPS Ingestion Sources

#### Source A: Driver Smartphone (Web Prototype / Driver Portal)
- Accessible on driver mobile phones at `/driver`.
- Uses the HTML5 Geolocation API:
  ```javascript
  navigator.geolocation.watchPosition(successCallback, errorCallback, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 2000
  });
  ```
- **Requirements & Limitations:**
  - Requires mobile browser location permission (`Allow while using app`).
  - Mobile browsers may throttle background JavaScript execution when the phone locks or switches apps.
  - Recommended setup: Mount phone on bus dashboard with active screen-lock disabled and vehicle charger plugged in.

#### Source B: Dedicated OBD-II / Hardwired GPS Tracker (Production Fleet)
- For uninterrupted 24/7 commercial tracking, install a hardware tracker (e.g., Teltonika FMB920, Concox GT06, or Queclink).
- The device sends periodic telemetry (Latitude, Longitude, Speed, Heading, Ignition status) via HTTP POST / MQTT to `/api/tracking/location`:
  ```json
  POST /api/tracking/location
  Content-Type: application/json

  {
    "busId": 1,
    "latitude": 14.094000,
    "longitude": 74.489900,
    "speed": 42.5,
    "heading": 180.0,
    "accuracy": 3.0,
    "isDemo": false
  }
  ```

---

### 3. Coordinate Ingestion & Validation Rules

Incoming coordinates are strictly validated on the backend:
1. Latitude must be strictly between -90.0 and 90.0.
2. Longitude must be strictly between -180.0 and 180.0.
3. Values must be finite numbers; `NaN`, `null`, and impossible jumps are rejected.
4. Updates are recorded with server-side UTC timestamps in the `gps_locations` database table.

---

### 4. Telemetry Update Frequency & Bandwidth Optimization

- **Active Transit Interval:** 3 to 5 seconds while vehicle speed > 5 km/h.
- **Stationary Interval:** 15 to 30 seconds when bus is stationary at a scheduled pickup stop to conserve device battery and cellular data.
- **Detection Radius:** 200 meters around predefined stops triggers stop arrival and records actual arrival timestamps.

---

### 5. GPS Failure & Staleness Handling

- **Staleness Threshold:** 45 seconds.
- If no valid GPS telemetry arrives within 45 seconds:
  - The bus is flagged with `gps_status: 'stale'`.
  - The live map displays an amber warning badge: **"GPS Stale (Reconnecting...)"**.
  - Stale positions are never represented as live positions.
  - The ETA system displays an uncertainty label rather than fabricating arrival times.
  - When connection is restored, status automatically resumes to **"Live GPS Active"**.
