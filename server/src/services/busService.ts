import { db } from '../database';
import { isGpsStale } from '../utils/geo';

export interface BusRecord {
  id: number;
  bus_number: string;
  bus_name: string;
  registration_number: string;
  capacity: number;
  assigned_driver_id: number | null;
  assigned_route_id: number | null;
  status: 'not_started' | 'running_on_time' | 'approaching_pickup' | 'delayed' | 'trip_completed' | 'gps_unavailable';
  gps_status: 'active' | 'stale' | 'offline' | 'waiting_signal';
  last_latitude: number | null;
  last_longitude: number | null;
  last_speed: number;
  last_heading: number;
  last_gps_timestamp: string | null;
  is_active: number;
  driver_name?: string;
  driver_phone?: string;
  route_name?: string;
  start_point?: string;
  destination?: string;
  is_stale?: boolean;
}

export class BusService {
  public static async getAllBuses(includeInactive: boolean = false): Promise<BusRecord[]> {
    if (db.mode === 'mysql' && db.getPool()) {
      const sql = `
        SELECT 
          b.*,
          d.full_name as driver_name,
          d.phone as driver_phone,
          r.route_name,
          r.start_point,
          r.destination
        FROM buses b
        LEFT JOIN drivers d ON b.assigned_driver_id = d.id
        LEFT JOIN routes r ON b.assigned_route_id = r.id
        ${includeInactive ? '' : 'WHERE b.is_active = 1'}
        ORDER BY b.id ASC
      `;
      const rows: any = await db.query(sql);
      return rows.map((b: any) => ({
        ...b,
        is_stale: isGpsStale(b.last_gps_timestamp),
        gps_status: isGpsStale(b.last_gps_timestamp) && b.gps_status === 'active' ? 'stale' : b.gps_status,
      }));
    }

    const buses = includeInactive
      ? db.getTable<any>('buses')
      : db.getTable<any>('buses').filter((b) => b.is_active === 1);
    const drivers = db.getTable<any>('drivers');
    const routes = db.getTable<any>('routes');

    return buses.map((b) => {
      const driver = drivers.find((d) => d.id === b.assigned_driver_id);
      const route = routes.find((r) => r.id === b.assigned_route_id);
      const stale = isGpsStale(b.last_gps_timestamp);

      return {
        ...b,
        driver_name: driver?.full_name || 'Unassigned',
        driver_phone: driver?.phone || 'N/A',
        route_name: route?.route_name || 'Unassigned',
        start_point: route?.start_point || 'N/A',
        destination: route?.destination || 'N/A',
        is_stale: stale,
        gps_status: stale && b.gps_status === 'active' ? 'stale' : b.gps_status,
      };
    });
  }

  public static async getBusById(id: number, includeInactive: boolean = true): Promise<BusRecord | null> {
    const all = await this.getAllBuses(includeInactive);
    return all.find((b) => Number(b.id) === Number(id)) || null;
  }

  public static async createBus(data: {
    bus_number: string;
    bus_name: string;
    registration_number?: string;
    capacity?: number;
    assigned_driver_id?: number | null;
    assigned_route_id?: number | null;
  }): Promise<BusRecord> {
    const record = {
      bus_number: data.bus_number,
      bus_name: data.bus_name,
      registration_number: data.registration_number || data.bus_number.replace(/-/g, ''),
      capacity: data.capacity || 50,
      assigned_driver_id: data.assigned_driver_id || null,
      assigned_route_id: data.assigned_route_id || null,
      status: 'not_started' as const,
      gps_status: 'waiting_signal' as const,
      last_latitude: null,
      last_longitude: null,
      last_speed: 0.0,
      last_heading: 0.0,
      last_gps_timestamp: null,
      is_active: 1,
    };

    if (db.mode === 'mysql' && db.getPool()) {
      const result: any = await db.query(
        `INSERT INTO buses (bus_number, bus_name, registration_number, capacity, assigned_driver_id, assigned_route_id, status, gps_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [record.bus_number, record.bus_name, record.registration_number, record.capacity, record.assigned_driver_id, record.assigned_route_id, record.status, record.gps_status]
      );
      return (await this.getBusById(result.insertId))!;
    }

    const saved = db.insertRecord('buses', record);
    return (await this.getBusById(saved.id))!;
  }

  public static async updateBus(id: number, updates: Partial<BusRecord>): Promise<BusRecord | null> {
    if (db.mode === 'mysql' && db.getPool()) {
      const fields: string[] = [];
      const values: any[] = [];
      for (const [key, val] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'driver_name' && key !== 'driver_phone' && key !== 'route_name' && key !== 'start_point' && key !== 'destination' && key !== 'is_stale') {
          fields.push(`\`${key}\` = ?`);
          values.push(val);
        }
      }
      if (fields.length > 0) {
        values.push(id);
        await db.query(`UPDATE buses SET ${fields.join(', ')} WHERE id = ?`, values);
      }
      return this.getBusById(id);
    }

    db.updateRecord('buses', id, updates);
    return this.getBusById(id);
  }

  public static async deleteBus(id: number): Promise<boolean> {
    if (db.mode === 'mysql' && db.getPool()) {
      await db.query('UPDATE buses SET is_active = 0 WHERE id = ?', [id]);
      return true;
    }
    return db.updateRecord('buses', id, { is_active: 0 }) !== null;
  }
}
