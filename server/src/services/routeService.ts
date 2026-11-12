import { db } from '../database';
import { calculateRoadNetworkRoute } from '../utils/geo';

export interface RouteStopDetail {
  id: number;
  route_id: number;
  pickup_point_id: number;
  stop_sequence: number;
  scheduled_arrival_time: string;
  scheduled_departure_time: string;
  distance_from_prev_km: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  landmark: string;
}

export interface RouteDetail {
  id: number;
  route_name: string;
  start_point: string;
  destination: string;
  operating_days: string;
  status: 'active' | 'inactive';
  total_distance_km: number;
  estimated_duration_mins: number;
  road_geometry?: [number, number][];
  route_version?: number;
  stops: RouteStopDetail[];
  schedules?: any[];
}

export class RouteService {
  public static async getAllRoutes(): Promise<RouteDetail[]> {
    if (db.mode === 'mysql' && db.getPool()) {
      const routes: any = await db.query('SELECT * FROM routes ORDER BY id ASC');
      const results: RouteDetail[] = [];

      for (const route of routes) {
        const stops: any = await db.query(
          `SELECT 
             rs.*,
             pp.name as stop_name,
             pp.latitude,
             pp.longitude,
             pp.landmark
           FROM route_stops rs
           JOIN pickup_points pp ON rs.pickup_point_id = pp.id
           WHERE rs.route_id = ?
           ORDER BY rs.stop_sequence ASC`,
          [route.id]
        );
        results.push({ ...route, stops });
      }
      return results;
    }

    const routes = db.getTable<any>('routes');
    const routeStops = db.getTable<any>('route_stops');
    const pickupPoints = db.getTable<any>('pickup_points');

    return routes.map((r) => {
      const stops = routeStops
        .filter((rs) => rs.route_id === r.id)
        .sort((a, b) => a.stop_sequence - b.stop_sequence)
        .map((rs) => {
          const pp = pickupPoints.find((p) => p.id === rs.pickup_point_id);
          return {
            ...rs,
            stop_name: pp?.name || 'Unknown Stop',
            latitude: pp?.latitude || 0,
            longitude: pp?.longitude || 0,
            landmark: pp?.landmark || '',
          };
        });

      return { ...r, stops };
    });
  }

  public static async getRouteById(id: number): Promise<RouteDetail | null> {
    const all = await this.getAllRoutes();
    return all.find((r) => r.id === id) || null;
  }

  public static async createRoute(data: {
    route_name: string;
    start_point: string;
    destination: string;
    operating_days?: string;
    estimated_duration_mins?: number;
    total_distance_km?: number;
    road_geometry?: [number, number][];
    stops?: Array<{ pickup_point_id: number; stop_sequence: number; scheduled_arrival_time: string; scheduled_departure_time: string; distance_from_prev_km?: number }>;
  }): Promise<RouteDetail> {
    const allPoints = await this.getAllPickupPoints();
    let computedDistance = data.total_distance_km || 0.0;
    let computedDuration = data.estimated_duration_mins || 45;
    let roadGeometry = data.road_geometry || null;

    if (data.stops && data.stops.length >= 2) {
      const stopCoords = data.stops
        .map((s) => allPoints.find((p) => p.id === s.pickup_point_id))
        .filter((p): p is any => Boolean(p))
        .map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }));

      if (stopCoords.length >= 2) {
        const roadResult = await calculateRoadNetworkRoute(stopCoords);
        if (!data.total_distance_km || data.total_distance_km <= 0) {
          computedDistance = roadResult.totalDistanceKm;
        }
        if (!data.estimated_duration_mins || data.estimated_duration_mins <= 0) {
          computedDuration = roadResult.estimatedDurationMins;
        }
        roadGeometry = roadResult.coordinates;

        // Auto-fill leg distances if not provided
        if (roadResult.legs.length === data.stops.length - 1) {
          data.stops.forEach((s, idx) => {
            if (idx === 0) s.distance_from_prev_km = 0.0;
            else if (!s.distance_from_prev_km || s.distance_from_prev_km <= 0) {
              s.distance_from_prev_km = roadResult.legs[idx - 1]?.distanceKm || 0.0;
            }
          });
        }
      }
    }

    const routeRecord = {
      route_name: data.route_name,
      start_point: data.start_point,
      destination: data.destination,
      operating_days: data.operating_days || 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
      status: 'active' as const,
      total_distance_km: computedDistance,
      estimated_duration_mins: computedDuration,
      road_geometry: roadGeometry,
      route_version: 1,
    };

    let newRouteId: number;

    if (db.mode === 'mysql' && db.getPool()) {
      const res: any = await db.query(
        `INSERT INTO routes (route_name, start_point, destination, operating_days, status, total_distance_km, estimated_duration_mins)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [routeRecord.route_name, routeRecord.start_point, routeRecord.destination, routeRecord.operating_days, routeRecord.status, routeRecord.total_distance_km, routeRecord.estimated_duration_mins]
      );
      newRouteId = res.insertId;

      if (data.stops && data.stops.length > 0) {
        for (const stop of data.stops) {
          await db.query(
            `INSERT INTO route_stops (route_id, pickup_point_id, stop_sequence, scheduled_arrival_time, scheduled_departure_time, distance_from_prev_km)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [newRouteId, stop.pickup_point_id, stop.stop_sequence, stop.scheduled_arrival_time, stop.scheduled_departure_time, stop.distance_from_prev_km || 0.0]
          );
        }
      }
    } else {
      const saved = db.insertRecord('routes', routeRecord);
      newRouteId = saved.id;

      if (data.stops && data.stops.length > 0) {
        for (const stop of data.stops) {
          db.insertRecord('route_stops', {
            route_id: newRouteId,
            pickup_point_id: stop.pickup_point_id,
            stop_sequence: stop.stop_sequence,
            scheduled_arrival_time: stop.scheduled_arrival_time,
            scheduled_departure_time: stop.scheduled_departure_time,
            distance_from_prev_km: stop.distance_from_prev_km || 0.0,
          });
        }
      }
    }

    return (await this.getRouteById(newRouteId))!;
  }

  public static async updateRoute(id: number, updates: any): Promise<RouteDetail | null> {
    const existing = await this.getRouteById(id);
    const allPoints = await this.getAllPickupPoints();

    if (Array.isArray(updates.stops) && updates.stops.length >= 2) {
      const stopCoords = updates.stops
        .map((s: any) => allPoints.find((p: any) => p.id === s.pickup_point_id))
        .filter((p: any): p is any => Boolean(p))
        .map((p: any) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }));

      if (stopCoords.length >= 2) {
        const roadResult = await calculateRoadNetworkRoute(stopCoords);
        if (!updates.total_distance_km || updates.total_distance_km <= 0) {
          updates.total_distance_km = roadResult.totalDistanceKm;
        }
        if (!updates.estimated_duration_mins || updates.estimated_duration_mins <= 0) {
          updates.estimated_duration_mins = roadResult.estimatedDurationMins;
        }
        updates.road_geometry = roadResult.coordinates;

        // Auto-fill leg distances if needed
        if (roadResult.legs.length === updates.stops.length - 1) {
          updates.stops.forEach((s: any, idx: number) => {
            if (idx === 0) s.distance_from_prev_km = 0.0;
            else if (!s.distance_from_prev_km || s.distance_from_prev_km <= 0) {
              s.distance_from_prev_km = roadResult.legs[idx - 1]?.distanceKm || 0.0;
            }
          });
        }
      }
    }

    updates.route_version = ((existing?.route_version as number) || 1) + 1;

    if (db.mode === 'mysql' && db.getPool()) {
      const fields: string[] = [];
      const values: any[] = [];
      for (const [key, val] of Object.entries(updates)) {
        if (['route_name', 'start_point', 'destination', 'operating_days', 'status', 'total_distance_km', 'estimated_duration_mins'].includes(key)) {
          fields.push(`\`${key}\` = ?`);
          values.push(val);
        }
      }
      if (fields.length > 0) {
        values.push(id);
        await db.query(`UPDATE routes SET ${fields.join(', ')} WHERE id = ?`, values);
      }

      if (Array.isArray(updates.stops)) {
        await db.query('DELETE FROM route_stops WHERE route_id = ?', [id]);
        for (let idx = 0; idx < updates.stops.length; idx++) {
          const stop = updates.stops[idx];
          const seq = stop.stop_sequence !== undefined ? stop.stop_sequence : idx + 1;
          await db.query(
            `INSERT INTO route_stops (route_id, pickup_point_id, stop_sequence, scheduled_arrival_time, scheduled_departure_time, distance_from_prev_km)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              id,
              stop.pickup_point_id,
              seq,
              stop.scheduled_arrival_time || '07:30:00',
              stop.scheduled_departure_time || '07:35:00',
              stop.distance_from_prev_km || 0.0,
            ]
          );
        }
      }
    } else {
      db.updateRecord('routes', id, updates);

      if (Array.isArray(updates.stops)) {
        const allStops = db.getTable<any>('route_stops');
        const filtered = allStops.filter((rs) => rs.route_id !== id);
        (db as any).embeddedData['route_stops'] = filtered;
        for (let idx = 0; idx < updates.stops.length; idx++) {
          const stop = updates.stops[idx];
          const seq = stop.stop_sequence !== undefined ? stop.stop_sequence : idx + 1;
          db.insertRecord('route_stops', {
            route_id: id,
            pickup_point_id: stop.pickup_point_id,
            stop_sequence: seq,
            scheduled_arrival_time: stop.scheduled_arrival_time || '07:30:00',
            scheduled_departure_time: stop.scheduled_departure_time || '07:35:00',
            distance_from_prev_km: stop.distance_from_prev_km || 0.0,
          });
        }
      }
    }

    return this.getRouteById(id);
  }

  public static async deleteRoute(id: number): Promise<boolean> {
    if (db.mode === 'mysql' && db.getPool()) {
      await db.query('DELETE FROM route_stops WHERE route_id = ?', [id]);
      await db.query('DELETE FROM routes WHERE id = ?', [id]);
      return true;
    }
    const allStops = db.getTable<any>('route_stops');
    (db as any).embeddedData['route_stops'] = allStops.filter((rs) => rs.route_id !== id);
    return db.deleteRecord('routes', id);
  }

  // Pickup Points CRUD
  public static async getAllPickupPoints(): Promise<any[]> {
    if (db.mode === 'mysql' && db.getPool()) {
      return db.query('SELECT * FROM pickup_points WHERE is_active = 1 ORDER BY name ASC');
    }
    return db.getTable('pickup_points').filter((p) => p.is_active === 1);
  }

  public static async createPickupPoint(data: { name: string; latitude: number; longitude: number; landmark?: string; address?: string }): Promise<any> {
    const record = {
      name: data.name,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      landmark: data.landmark || '',
      address: data.address || '',
      is_active: 1,
    };

    if (db.mode === 'mysql' && db.getPool()) {
      const res: any = await db.query(
        'INSERT INTO pickup_points (name, latitude, longitude, landmark, address, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [record.name, record.latitude, record.longitude, record.landmark, record.address]
      );
      return { id: res.insertId, ...record };
    }

    return db.insertRecord('pickup_points', record);
  }

  public static async updatePickupPoint(id: number, data: any): Promise<any> {
    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.latitude !== undefined) updates.latitude = Number(data.latitude);
    if (data.longitude !== undefined) updates.longitude = Number(data.longitude);
    if (data.landmark !== undefined) updates.landmark = data.landmark;
    if (data.address !== undefined) updates.address = data.address;
    if (data.is_active !== undefined) updates.is_active = data.is_active;

    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        'UPDATE pickup_points SET name = COALESCE(?, name), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), landmark = COALESCE(?, landmark), address = COALESCE(?, address) WHERE id = ?',
        [updates.name, updates.latitude, updates.longitude, updates.landmark, updates.address, id]
      );
      const rows: any = await db.query('SELECT * FROM pickup_points WHERE id = ?', [id]);
      return rows[0];
    }
    return db.updateRecord('pickup_points', id, updates);
  }

  public static async deletePickupPoint(id: number): Promise<boolean> {
    if (db.mode === 'mysql' && db.getPool()) {
      await db.query('UPDATE pickup_points SET is_active = 0 WHERE id = ?', [id]);
      return true;
    }
    return db.updateRecord('pickup_points', id, { is_active: 0 }) !== null;
  }

  // Drivers CRUD
  public static async getAllDrivers(): Promise<any[]> {
    if (db.mode === 'mysql' && db.getPool()) {
      return db.query(`
        SELECT d.*, b.bus_number, b.bus_name, b.id as bus_id
        FROM drivers d
        LEFT JOIN buses b ON b.assigned_driver_id = d.id
        ORDER BY d.id ASC
      `);
    }

    const drivers = db.getTable<any>('drivers');
    const buses = db.getTable<any>('buses');
    return drivers.map((d) => {
      const bus = buses.find((b) => b.assigned_driver_id === d.id);
      return {
        ...d,
        bus_number: bus?.bus_number || null,
        bus_name: bus?.bus_name || null,
        bus_id: bus?.id || null,
      };
    });
  }

  public static async createDriver(data: {
    full_name: string;
    phone: string;
    employee_id?: string;
    license_number?: string;
    assigned_bus_id?: number | null;
  }): Promise<any> {
    const record = {
      user_id: null,
      full_name: data.full_name,
      phone: data.phone,
      employee_id: data.employee_id || '',
      license_number: data.license_number || '',
      status: 'active' as const,
    };

    let driverId: number;

    if (db.mode === 'mysql' && db.getPool()) {
      const res: any = await db.query(
        'INSERT INTO drivers (full_name, phone, employee_id, license_number, status) VALUES (?, ?, ?, ?, ?)',
        [record.full_name, record.phone, record.employee_id, record.license_number, record.status]
      );
      driverId = res.insertId;

      if (data.assigned_bus_id) {
        await db.query('UPDATE buses SET assigned_driver_id = ? WHERE id = ?', [driverId, data.assigned_bus_id]);
      }
    } else {
      const saved = db.insertRecord('drivers', record);
      driverId = saved.id;

      if (data.assigned_bus_id) {
        const buses = db.getTable<any>('buses');
        const targetBus = buses.find((b) => b.id === Number(data.assigned_bus_id));
        if (targetBus) {
          targetBus.assigned_driver_id = driverId;
          db.saveEmbeddedData();
        }
      }
    }

    const all = await this.getAllDrivers();
    return all.find((d) => d.id === driverId) || { id: driverId, ...record };
  }

  public static async updateDriver(id: number, data: any): Promise<any> {
    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        'UPDATE drivers SET full_name = ?, phone = ?, employee_id = ?, license_number = ?, status = ? WHERE id = ?',
        [data.full_name, data.phone, data.employee_id, data.license_number, data.status || 'active', id]
      );

      if (data.assigned_bus_id !== undefined) {
        await db.query('UPDATE buses SET assigned_driver_id = NULL WHERE assigned_driver_id = ?', [id]);
        if (data.assigned_bus_id) {
          await db.query('UPDATE buses SET assigned_driver_id = ? WHERE id = ?', [id, data.assigned_bus_id]);
        }
      }

      const rows: any = await db.query('SELECT * FROM drivers WHERE id = ?', [id]);
      return rows[0];
    }

    db.updateRecord('drivers', id, {
      full_name: data.full_name,
      phone: data.phone,
      employee_id: data.employee_id,
      license_number: data.license_number,
      status: data.status || 'active',
    });

    if (data.assigned_bus_id !== undefined) {
      const buses = db.getTable<any>('buses');
      buses.forEach((b) => {
        if (b.assigned_driver_id === id) b.assigned_driver_id = null;
        if (data.assigned_bus_id && b.id === Number(data.assigned_bus_id)) {
          b.assigned_driver_id = id;
        }
      });
      db.saveEmbeddedData();
    }

    const all = await this.getAllDrivers();
    return all.find((d) => d.id === id);
  }

  public static async deleteDriver(id: number): Promise<boolean> {
    if (db.mode === 'mysql' && db.getPool()) {
      await db.query("UPDATE drivers SET status = 'inactive' WHERE id = ?", [id]);
      await db.query('UPDATE buses SET assigned_driver_id = NULL WHERE assigned_driver_id = ?', [id]);
      return true;
    }
    const buses = db.getTable<any>('buses');
    buses.forEach((b) => {
      if (b.assigned_driver_id === id) b.assigned_driver_id = null;
    });
    return db.updateRecord('drivers', id, { status: 'inactive' }) !== null;
  }
}
