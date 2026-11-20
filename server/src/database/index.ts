import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env';

export type DBMode = 'supabase' | 'mysql' | 'embedded';

class DatabaseManager {
  private pool: mysql.Pool | null = null;
  public supabaseClient: SupabaseClient | null = null;
  public mode: DBMode = 'embedded';
  public supabaseConnected: boolean = false;
  public supabaseError: string | null = null;
  private embeddedData: Record<string, any[]> = {};
  private embeddedFilePath: string;

  constructor() {
    this.embeddedFilePath = path.resolve(__dirname, '../../data/smart_bus.json');
  }

  public async initDatabase(): Promise<void> {
    const dataDir = path.dirname(this.embeddedFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Always load embedded storage first so baseline data is ready
    this.initEmbeddedDatabase();

    // 1. Try Supabase if credentials are provided
    if (config.supabase.url && (config.supabase.serviceKey || config.supabase.anonKey)) {
      const keyToUse = config.supabase.serviceKey || config.supabase.anonKey;
      console.log(`[DB] Attempting Supabase connection to: ${config.supabase.url}...`);
      try {
        const client = createClient(config.supabase.url, keyToUse, {
          auth: { persistSession: false },
        });

        // Test Supabase connection with a quick query
        const { data, error } = await client.from('buses').select('id').limit(1);
        if (error) {
          const errMsg = error.message || '';
          if (errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND')) {
            throw new Error(`Network unreachable: ${errMsg}`);
          }
          // Tables may not exist yet if schema was not yet run in Supabase SQL editor
          console.warn(`[DB] Supabase ping returned: ${errMsg}. Waiting for schema setup.`);
          this.supabaseClient = client;
          this.supabaseConnected = true;
          this.mode = 'supabase';
          this.supabaseError = errMsg;
          return;
        } else {
          this.supabaseClient = client;
          this.supabaseConnected = true;
          this.mode = 'supabase';
          this.supabaseError = null;
          console.log(`[DB] Successfully connected to Supabase PostgreSQL at ${config.supabase.url}`);

          // If Supabase users table is empty, auto-populate with seed data
          try {
            const { count } = await client.from('users').select('*', { count: 'exact', head: true });
            if (count === 0 || count === null) {
              console.log('[DB] Supabase database is empty. Auto-syncing initial dataset...');
              await this.syncToSupabase();
            } else {
              await this.pullFromSupabase();
            }
          } catch {
            await this.pullFromSupabase();
          }
          return;
        }
      } catch (sbErr: any) {
        console.warn(`[DB] Supabase connection error (${sbErr.message}).`);
        this.supabaseError = sbErr.message;
      }
    }

    // 2. Try MySQL connection if Supabase wasn't connected
    try {
      console.log(`[DB] Attempting MySQL connection on ${config.db.host}:${config.db.port}...`);
      const testConnection = await mysql.createConnection({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
      });

      await testConnection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.name}\`;`);
      await testConnection.end();

      this.pool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.name,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // Test pool
      await this.pool.query('SELECT 1 as connected');
      this.mode = 'mysql';
      console.log(`[DB] Successfully connected to MySQL database: ${config.db.name}`);
      await this.initMySQLTables();
      await this.seedMySQLIfEmpty();
      return;
    } catch (err: any) {
      console.warn(`[DB] MySQL connection skipped (${err.message}). Running in persistent local storage mode.`);
    }

    // 3. Fallback to embedded storage
    this.mode = 'embedded';
    console.log(`[DB] Active database mode: ${this.mode}`);
  }

  /**
   * Pull existing records from Supabase into memory if tables have records
   */
  public async pullFromSupabase(): Promise<void> {
    if (!this.supabaseClient) return;
    const tables = [
      'users',
      'drivers',
      'routes',
      'pickup_points',
      'route_stops',
      'buses',
      'trips',
      'trip_stop_events',
      'gps_locations',
      'student_pickup_preferences',
      'notifications',
      'push_subscriptions',
      'complaints',
    ];

    try {
      for (const table of tables) {
        const { data, error } = await this.supabaseClient.from(table).select('*');
        if (!error && Array.isArray(data) && data.length > 0) {
          this.embeddedData[table] = data;
        }
      }
      this.saveEmbeddedData();
      console.log('[DB] Synced data cache from Supabase PostgreSQL.');
    } catch (e: any) {
      console.warn('[DB] Supabase pull notice:', e.message);
    }
  }

  /**
   * Push full local dataset to Supabase PostgreSQL (Upsert all tables)
   */
  public async syncToSupabase(): Promise<{ success: boolean; stats: Record<string, number>; message?: string }> {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    const tables = [
      'users',
      'drivers',
      'pickup_points',
      'routes',
      'route_stops',
      'buses',
      'trips',
      'trip_stop_events',
      'student_pickup_preferences',
      'notifications',
      'push_subscriptions',
      'complaints',
    ];

    const stats: Record<string, number> = {};

    for (const table of tables) {
      const records = this.getTable(table);
      if (records && records.length > 0) {
        try {
          const { error } = await this.supabaseClient.from(table).upsert(records, { onConflict: 'id' });
          if (error) {
            console.warn(`[DB] Supabase sync table "${table}" warning: ${error.message}`);
            stats[table] = 0;
          } else {
            stats[table] = records.length;
          }
        } catch (tableErr: any) {
          stats[table] = 0;
        }
      } else {
        stats[table] = 0;
      }
    }

    return {
      success: true,
      stats,
      message: 'Database successfully synced with Supabase PostgreSQL!',
    };
  }

  /**
   * Helper to push live changes to Supabase in background
   */
  private async pushToSupabase(tableName: string, action: 'insert' | 'update' | 'delete', record?: any, id?: number): Promise<void> {
    if (!this.supabaseClient) return;

    try {
      if (action === 'insert' && record) {
        await this.supabaseClient.from(tableName).upsert([record], { onConflict: 'id' });
      } else if (action === 'update' && record && id) {
        await this.supabaseClient.from(tableName).update(record).eq('id', id);
      } else if (action === 'delete' && id) {
        await this.supabaseClient.from(tableName).delete().eq('id', id);
      }
    } catch (err: any) {
      console.warn(`[DB] Supabase live sync error on ${tableName} (${action}):`, err.message);
    }
  }

  private async initMySQLTables(): Promise<void> {
    if (!this.pool) return;
    const schemaFile = path.resolve(__dirname, '../../../database/schema.sql');
    if (fs.existsSync(schemaFile)) {
      const sql = fs.readFileSync(schemaFile, 'utf8');
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('use ') && !s.toLowerCase().startsWith('create database'));

      for (const statement of statements) {
        try {
          await this.pool.query(statement);
        } catch (e: any) {
          // Ignore table already exists
        }
      }
    }
  }

  private async seedMySQLIfEmpty(): Promise<void> {
    if (!this.pool) return;
    try {
      const [userRows]: any = await this.pool.query('SELECT COUNT(*) as count FROM users');
      if (userRows[0]?.count > 0) return;

      console.log('[DB] Seeding MySQL database with initial data...');
      const adminPass = await bcrypt.hash('Hello@123', 10);
      const driverPass = await bcrypt.hash('Driver786', 10);
      const studentPass = await bcrypt.hash('Student123', 10);
      const legacyAdminPass = await bcrypt.hash('admin123', 10);
      const legacyDriverPass = await bcrypt.hash('driver123', 10);
      const legacyStudentPass = await bcrypt.hash('student123', 10);

      // Seed Users
      await this.pool.query(
        `INSERT IGNORE INTO users (id, username, password_hash, email, role, full_name, student_id, phone, college_name) VALUES
        (1, 'Administrator', ?, 'admin@anjuman.edu', 'admin', 'System Administrator', 'ADM-001', '+91 99024 29000', 'Anjuman Institute of Technology & Management'),
        (2, 'Driver', ?, 'driver@anjuman.edu', 'driver', 'Ramesh Kumar', 'DRV-101', '+91 98451 12345', 'Anjuman Institute of Technology & Management'),
        (3, 'Student', ?, 'student@anjuman.edu', 'student', 'Mohammed Zaid', '4AI21CS045', '+91 99024 29066', 'Anjuman Institute of Technology & Management'),
        (4, 'admin', ?, 'admin.legacy@anjuman.edu', 'admin', 'Admin Legacy', 'ADM-002', '+91 99024 29001', 'Anjuman Institute of Technology & Management'),
        (5, 'driver1', ?, 'driver1@anjuman.edu', 'driver', 'Ramesh Kumar', 'DRV-101', '+91 98451 12345', 'Anjuman Institute of Technology & Management'),
        (6, 'student1', ?, 'student1@anjuman.edu', 'student', 'Mohammed Zaid', '4AI21CS045', '+91 99024 29066', 'Anjuman Institute of Technology & Management')`,
        [adminPass, driverPass, studentPass, legacyAdminPass, legacyDriverPass, legacyStudentPass]
      );

      const seedsFile = path.resolve(__dirname, '../../../database/seeds.sql');
      if (fs.existsSync(seedsFile)) {
        const sql = fs.readFileSync(seedsFile, 'utf8');
        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('use ') && !s.toLowerCase().includes('insert into users'));

        for (const statement of statements) {
          try {
            await this.pool.query(statement);
          } catch (e: any) {
            // Ignore duplicate seed errors
          }
        }
      }
    } catch (err: any) {
      console.error('[DB] Error during MySQL seed:', err.message);
    }
  }

  private initEmbeddedDatabase(): void {
    if (fs.existsSync(this.embeddedFilePath)) {
      try {
        const raw = fs.readFileSync(this.embeddedFilePath, 'utf8');
        this.embeddedData = JSON.parse(raw);
        console.log(`[DB] Loaded embedded storage from ${this.embeddedFilePath}`);
        if (!this.embeddedData.users || this.embeddedData.users.length === 0 || !this.embeddedData.buses || this.embeddedData.buses.length === 0) {
          console.log('[DB] Embedded data was empty or incomplete, reseeding with full dataset...');
          this.seedEmbeddedDataset();
          this.saveEmbeddedData();
        } else {
          this.ensureFreshSevenDayTrips();
        }
        return;
      } catch (err) {
        console.warn('[DB] Failed parsing embedded JSON file, recreating fresh dataset.');
      }
    }

    this.seedEmbeddedDataset();
    this.saveEmbeddedData();
    console.log(`[DB] Created fresh embedded persistent dataset with full seed records.`);
  }

  private seedEmbeddedDataset(): void {
    const adminPass = bcrypt.hashSync('Hello@123', 10);
    const driverPass = bcrypt.hashSync('Driver786', 10);
    const studentPass = bcrypt.hashSync('Student123', 10);
    const legacyAdminPass = bcrypt.hashSync('admin123', 10);
    const legacyDriverPass = bcrypt.hashSync('driver123', 10);
    const legacyStudentPass = bcrypt.hashSync('student123', 10);

    const now = new Date().toISOString();

    this.embeddedData = {
      users: [
        { id: 1, username: 'Administrator', password_hash: adminPass, email: 'admin@anjuman.edu', role: 'admin', full_name: 'System Administrator', student_id: 'ADM-001', phone: '+91 99024 29000', college_name: 'Anjuman Institute of Technology & Management', is_active: 1, created_at: now },
        { id: 2, username: 'Driver', password_hash: driverPass, email: 'driver@anjuman.edu', role: 'driver', full_name: 'Ramesh Kumar', student_id: 'DRV-101', phone: '+91 98451 12345', college_name: 'Anjuman Institute of Technology & Management', is_active: 1, created_at: now },
        { id: 3, username: 'Student', password_hash: studentPass, email: 'student@anjuman.edu', role: 'student', full_name: 'Mohammed Zaid', student_id: '4AI21CS045', phone: '+91 99024 29066', college_name: 'Anjuman Institute of Technology & Management', is_active: 1, created_at: now },
        { id: 4, username: 'admin', password_hash: legacyAdminPass, email: 'admin.legacy@anjuman.edu', role: 'admin', full_name: 'Admin Legacy', student_id: 'ADM-002', phone: '+91 99024 29001', college_name: 'Anjuman Institute of Technology & Management', is_active: 1, created_at: now },
        { id: 5, username: 'driver1', password_hash: legacyDriverPass, email: 'driver1@anjuman.edu', role: 'driver', full_name: 'Ramesh Kumar', student_id: 'DRV-101', phone: '+91 98451 12345', college_name: 'Anjuman Institute of Technology & Management', is_active: 1, created_at: now },
        { id: 6, username: 'student1', password_hash: legacyStudentPass, email: 'student1@anjuman.edu', role: 'student', full_name: 'Mohammed Zaid', student_id: '4AI21CS045', phone: '+91 99024 29066', college_name: 'Anjuman Institute of Technology & Management', is_active: 1, created_at: now },
      ],
      drivers: [
        { id: 1, user_id: 2, full_name: 'Ramesh Kumar', phone: '+91 98451 12345', employee_id: 'DRV-101', license_number: 'KA-47-2015-00431', status: 'active', created_at: now },
        { id: 2, user_id: 2, full_name: 'Suresh Naik', phone: '+91 98452 67890', employee_id: 'DRV-102', license_number: 'KA-47-2018-00982', status: 'active', created_at: now },
      ],
      routes: [
        {
          id: 1,
          route_name: 'Murdeshwar to College',
          start_point: 'Murdeshwar Bus Stand',
          destination: 'College Main Gate',
          operating_days: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
          status: 'active',
          total_distance_km: 28.5,
          estimated_duration_mins: 55,
          route_version: 1,
          created_at: now,
        },
        {
          id: 2,
          route_name: 'Kumta to College',
          start_point: 'Kumta Old Bus Stand',
          destination: 'College Main Gate',
          operating_days: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
          status: 'active',
          total_distance_km: 64.0,
          estimated_duration_mins: 75,
          route_version: 1,
          created_at: now,
        },
      ],
      pickup_points: [
        { id: 1, name: 'Murdeshwar Bus Stand', latitude: 14.0940000, longitude: 74.4899000, landmark: 'Near Temple Arch, NH 66', address: 'National Highway 66, Murdeshwar', is_active: 1, created_at: now },
        { id: 2, name: 'Bhatkal Bus Stand', latitude: 13.9875000, longitude: 74.5510000, landmark: 'Main KSRTC Bus Stand', address: 'Near Shamsuddin Circle, Bhatkal', is_active: 1, created_at: now },
        { id: 3, name: 'Shirali Bus Stop', latitude: 14.0321000, longitude: 74.5262000, landmark: 'Near Al-Kausar Hospital', address: 'NH 66, Shirali', is_active: 1, created_at: now },
        { id: 4, name: 'College Main Gate', latitude: 13.9782000, longitude: 74.5750000, landmark: 'Anjuman College Campus Entrance', address: 'Anjumanabad, Bhatkal', is_active: 1, created_at: now },
        { id: 5, name: 'Kumta Old Bus Stand', latitude: 14.4285000, longitude: 74.4215000, landmark: 'Opposite Post Office', address: 'Main Road, Kumta', is_active: 1, created_at: now },
        { id: 6, name: 'Honnavar Circle', latitude: 14.2798000, longitude: 74.4442000, landmark: 'Sharavathi Bridge Junction', address: 'Honnavar Town Circle', is_active: 1, created_at: now },
        { id: 7, name: 'Manki Junction', latitude: 14.1850000, longitude: 74.4680000, landmark: 'Near NH Toll Gate', address: 'NH 66, Manki', is_active: 1, created_at: now },
        { id: 8, name: 'Tengingundi Cross', latitude: 14.0042000, longitude: 74.5428000, landmark: 'Tengingundi Coastal Road Cross', address: 'NH 66 Junction, Bhatkal', is_active: 1, created_at: now },
      ],
      route_stops: [
        // Route 1 (Murdeshwar -> Shirali -> Bhatkal -> College in geographical order along NH 66)
        { id: 1, route_id: 1, pickup_point_id: 1, stop_sequence: 1, scheduled_arrival_time: '07:30:00', scheduled_departure_time: '07:35:00', distance_from_prev_km: 0.0, created_at: now },
        { id: 2, route_id: 1, pickup_point_id: 3, stop_sequence: 2, scheduled_arrival_time: '07:45:00', scheduled_departure_time: '07:50:00', distance_from_prev_km: 8.5, created_at: now },
        { id: 3, route_id: 1, pickup_point_id: 2, stop_sequence: 3, scheduled_arrival_time: '07:55:00', scheduled_departure_time: '08:00:00', distance_from_prev_km: 6.8, created_at: now },
        { id: 4, route_id: 1, pickup_point_id: 4, stop_sequence: 4, scheduled_arrival_time: '08:25:00', scheduled_departure_time: '08:30:00', distance_from_prev_km: 4.5, created_at: now },
        // Route 2
        { id: 5, route_id: 2, pickup_point_id: 5, stop_sequence: 1, scheduled_arrival_time: '07:15:00', scheduled_departure_time: '07:20:00', distance_from_prev_km: 0.0, created_at: now },
        { id: 6, route_id: 2, pickup_point_id: 6, stop_sequence: 2, scheduled_arrival_time: '07:40:00', scheduled_departure_time: '07:45:00', distance_from_prev_km: 18.5, created_at: now },
        { id: 7, route_id: 2, pickup_point_id: 7, stop_sequence: 3, scheduled_arrival_time: '08:00:00', scheduled_departure_time: '08:05:00', distance_from_prev_km: 21.0, created_at: now },
        { id: 8, route_id: 2, pickup_point_id: 4, stop_sequence: 4, scheduled_arrival_time: '08:30:00', scheduled_departure_time: '08:35:00', distance_from_prev_km: 24.5, created_at: now },
      ],
      buses: [
        {
          id: 1,
          bus_number: 'KA-47-A-1234',
          bus_name: 'College Bus 01',
          registration_number: 'KA47A1234',
          capacity: 52,
          assigned_driver_id: 1,
          assigned_route_id: 1,
          status: 'not_started',
          gps_status: 'waiting_signal',
          last_latitude: 14.0940000,
          last_longitude: 74.4899000,
          last_speed: 0.0,
          last_heading: 180.0,
          last_gps_timestamp: null,
          is_active: 1,
          created_at: now,
        },
        {
          id: 2,
          bus_number: 'KA-47-B-5678',
          bus_name: 'College Bus 02',
          registration_number: 'KA47B5678',
          capacity: 52,
          assigned_driver_id: 2,
          assigned_route_id: 2,
          status: 'not_started',
          gps_status: 'waiting_signal',
          last_latitude: 14.4285000,
          last_longitude: 74.4215000,
          last_speed: 0.0,
          last_heading: 165.0,
          last_gps_timestamp: null,
          is_active: 1,
          created_at: now,
        },
      ],
      route_schedules: [
        { id: 1, route_id: 1, day_of_week: 'Monday', departure_time: '07:30:00', arrival_time: '08:25:00', is_active: 1 },
        { id: 2, route_id: 1, day_of_week: 'Tuesday', departure_time: '07:30:00', arrival_time: '08:25:00', is_active: 1 },
        { id: 3, route_id: 1, day_of_week: 'Wednesday', departure_time: '07:30:00', arrival_time: '08:25:00', is_active: 1 },
        { id: 4, route_id: 1, day_of_week: 'Thursday', departure_time: '07:30:00', arrival_time: '08:25:00', is_active: 1 },
        { id: 5, route_id: 1, day_of_week: 'Friday', departure_time: '07:30:00', arrival_time: '08:25:00', is_active: 1 },
        { id: 6, route_id: 1, day_of_week: 'Saturday', departure_time: '07:30:00', arrival_time: '08:25:00', is_active: 1 },
      ],
      student_pickup_preferences: [
        { id: 1, user_id: 4, student_identifier: '4AI21CS045', bus_id: 1, route_id: 1, pickup_point_id: 2, notification_5min_enabled: 1, notification_delay_enabled: 1, notification_trip_start_enabled: 1, created_at: now },
      ],
      notifications: [
        { id: 1, user_id: 4, student_identifier: '4AI21CS045', bus_id: 1, route_id: 1, trip_id: null, pickup_point_id: 2, title: 'Welcome to Smart Bus Tracking', message: 'You have selected Bhatkal Bus Stand as your preferred pickup point for Bus KA-47-A-1234.', category: 'announcement', is_read: 0, metadata: null, created_at: now },
        { id: 2, user_id: 4, student_identifier: '4AI21CS045', bus_id: 1, route_id: 1, trip_id: null, pickup_point_id: 2, title: 'Push Notifications Enabled', message: 'Automatic 5-minute arrival and delay alerts are active for your stop.', category: 'announcement', is_read: 0, metadata: null, created_at: now },
      ],
      push_subscriptions: [],
      complaints: [
        {
          id: 1,
          reference_no: 'CMP-1001',
          user_id: 4,
          student_name: 'Mohammed Zaid',
          student_id: '4AI21CS045',
          phone: '+91 99024 29066',
          email: 'mohammed.student@anjuman.edu',
          bus_number: 'KA-47-A-1234',
          route_name: 'Murdeshwar to College',
          category: 'bus_delay',
          description: 'Bus arrived 12 minutes late due to traffic at Bhatkal circle on Monday.',
          date_of_incident: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
          preferred_contact: 'phone',
          status: 'Resolved',
          resolution_notes: 'Investigated: Highway repair work caused temporary slowdown. Morning departure shifted 5 minutes earlier.',
          resolved_by: 'System Administrator',
          resolved_at: now,
          created_at: now,
        },
      ],
      complaint_updates: [
        { id: 1, complaint_id: 1, old_status: 'New', new_status: 'Under Review', comment: 'Assigned to transport coordinator', updated_by: 'System Administrator', created_at: now },
        { id: 2, complaint_id: 1, old_status: 'Under Review', new_status: 'Resolved', comment: 'Schedule adjusted with driver Ramesh', updated_by: 'System Administrator', created_at: now },
      ],
      trips: [],
      gps_locations: [],
      trip_stop_events: [],
      delay_events: [],
      audit_logs: [],
    };

    // Seed 7-Day Historical Trips with Realistic Stop Records
    this.seedSevenDayTrips();
  }

  public ensureFreshSevenDayTrips(): void {
    const today = new Date();
    const trips = this.getTable<any>('trips');
    const hasRecent = trips.some((t: any) => {
      if (!t.trip_date) return false;
      const diff = (today.getTime() - new Date(t.trip_date).getTime()) / (1000 * 86400);
      return diff >= 1 && diff <= 7;
    });

    if (!hasRecent) {
      if (!this.embeddedData.trips) this.embeddedData.trips = [];
      if (!this.embeddedData.trip_stop_events) this.embeddedData.trip_stop_events = [];
      if (!this.embeddedData.gps_locations) this.embeddedData.gps_locations = [];
      this.embeddedData.trips = this.embeddedData.trips.filter((t: any) => t.id > 7);
      this.embeddedData.trip_stop_events = this.embeddedData.trip_stop_events.filter((e: any) => e.trip_id > 7);
      this.embeddedData.gps_locations = this.embeddedData.gps_locations.filter((g: any) => g.trip_id > 7);
      this.seedSevenDayTrips();
      this.saveEmbeddedData();
    }
  }

  private seedSevenDayTrips(): void {
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Generate past 7 days (skipping Sunday as non-scheduled)
    for (let offset = 7; offset >= 1; offset--) {
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - offset);
      const dayOfWeek = dayNames[pastDate.getDay()];
      const dateStr = pastDate.toISOString().split('T')[0];

      if (dayOfWeek === 'Sunday') continue; // Not scheduled

      const tripId = offset;
      let delayMins = 0;
      let isMissing = false;

      if (dayOfWeek === 'Monday') delayMins = 3;
      else if (dayOfWeek === 'Tuesday') delayMins = 7;
      else if (dayOfWeek === 'Wednesday') delayMins = -1;
      else if (dayOfWeek === 'Thursday') delayMins = 5;
      else if (dayOfWeek === 'Friday') delayMins = 2;
      else if (dayOfWeek === 'Saturday') isMissing = true;

      const startTime = `${dateStr}T07:30:00.000Z`;
      const endTime = `${dateStr}T08:28:00.000Z`;

      this.embeddedData.trips.push({
        id: tripId,
        bus_id: 1,
        driver_id: 1,
        route_id: 1,
        trip_date: dateStr,
        start_time: startTime,
        end_time: endTime,
        status: 'completed',
        start_lat: 14.0940000,
        start_lng: 74.4899000,
        end_lat: 13.9782000,
        end_lng: 74.5750000,
        delay_mins: delayMins,
        delay_reason: delayMins > 0 ? 'Peak morning highway traffic' : null,
        route_snapshot: {
          route_id: 1,
          route_name: 'Murdeshwar to College',
          version: 1,
          stops_count: 4,
        },
        is_demo: 0,
        created_at: startTime,
      });

      // Stop 1: Murdeshwar (Sched 07:30)
      this.embeddedData.trip_stop_events.push({
        id: this.embeddedData.trip_stop_events.length + 1,
        trip_id: tripId,
        route_stop_id: 1,
        pickup_point_id: 1,
        scheduled_time: '07:30:00',
        actual_arrival_time: `${dateStr}T07:30:00.000Z`,
        actual_departure_time: `${dateStr}T07:35:00.000Z`,
        delay_minutes: 0,
        status: 'departed',
        is_uncertain: 0,
        created_at: startTime,
      });

      // Stop 2: Shirali (Sched 07:45)
      this.embeddedData.trip_stop_events.push({
        id: this.embeddedData.trip_stop_events.length + 1,
        trip_id: tripId,
        route_stop_id: 2,
        pickup_point_id: 3,
        scheduled_time: '07:45:00',
        actual_arrival_time: isMissing ? null : (() => { const d = new Date(pastDate); d.setHours(7, 45 + delayMins, 0, 0); return d.toISOString(); })(),
        actual_departure_time: isMissing ? null : (() => { const d = new Date(pastDate); d.setHours(7, 50 + delayMins, 0, 0); return d.toISOString(); })(),
        delay_minutes: isMissing ? 0 : delayMins,
        status: isMissing ? 'skipped' : 'departed',
        is_uncertain: 0,
        created_at: startTime,
      });

      // Stop 3: Bhatkal Bus Stand (Sched 07:55)
      this.embeddedData.trip_stop_events.push({
        id: this.embeddedData.trip_stop_events.length + 1,
        trip_id: tripId,
        route_stop_id: 3,
        pickup_point_id: 2,
        scheduled_time: '07:55:00',
        actual_arrival_time: isMissing ? null : (() => { const d = new Date(pastDate); d.setHours(7, 55 + delayMins, 0, 0); return d.toISOString(); })(),
        actual_departure_time: isMissing ? null : (() => { const d = new Date(pastDate); d.setHours(8, 0, 0, 0); return d.toISOString(); })(),
        delay_minutes: isMissing ? 0 : delayMins,
        status: isMissing ? 'skipped' : 'departed',
        is_uncertain: 0,
        created_at: startTime,
      });

      // Stop 4: College (Sched 08:25)
      this.embeddedData.trip_stop_events.push({
        id: this.embeddedData.trip_stop_events.length + 1,
        trip_id: tripId,
        route_stop_id: 4,
        pickup_point_id: 4,
        scheduled_time: '08:25:00',
        actual_arrival_time: (() => { const d = new Date(pastDate); d.setHours(8, 25 + delayMins, 0, 0); return d.toISOString(); })(),
        actual_departure_time: `${dateStr}T08:30:00.000Z`,
        delay_minutes: delayMins,
        status: 'arrived',
        is_uncertain: 0,
        created_at: startTime,
      });

      // GPS Track breadcrumbs for this historical day
      if (!isMissing) {
        const waypoints = [
          { lat: 14.0940, lng: 74.4899, name: 'Murdeshwar Bus Stand', offsetMin: 0, speed: 0 },
          { lat: 14.0810, lng: 74.4980, name: 'NH 66 Murdeshwar Bypass', offsetMin: 4, speed: 46 },
          { lat: 14.0680, lng: 74.5060, name: 'Bailur Cross', offsetMin: 8, speed: 48 },
          { lat: 14.0500, lng: 74.5150, name: 'Alvekodi Junction', offsetMin: 12, speed: 42 },
          { lat: 14.0321, lng: 74.5262, name: 'Shirali Bus Stop', offsetMin: 15 + delayMins, speed: 0 },
          { lat: 14.0180, lng: 74.5350, name: 'Shirali South Cross', offsetMin: 20 + delayMins, speed: 44 },
          { lat: 14.0042, lng: 74.5428, name: 'Tengingundi Cross', offsetMin: 23 + delayMins, speed: 38 },
          { lat: 13.9875, lng: 74.5510, name: 'Bhatkal Bus Stand', offsetMin: 25 + delayMins, speed: 0 },
          { lat: 13.9840, lng: 74.5580, name: 'Ranginatte Junction', offsetMin: 32 + delayMins, speed: 32 },
          { lat: 13.9810, lng: 74.5660, name: 'Bunder Road Cross', offsetMin: 40 + delayMins, speed: 35 },
          { lat: 13.9790, lng: 74.5710, name: 'Anjumanabad Road', offsetMin: 48 + delayMins, speed: 28 },
          { lat: 13.9782, lng: 74.5750, name: 'College Main Gate', offsetMin: 55 + delayMins, speed: 0 },
        ];

        for (const wp of waypoints) {
          const ptTime = new Date(pastDate);
          ptTime.setHours(7, 30 + wp.offsetMin, 0, 0);
          this.embeddedData.gps_locations.push({
            id: this.embeddedData.gps_locations.length + 1,
            trip_id: tripId,
            bus_id: 1,
            latitude: wp.lat,
            longitude: wp.lng,
            speed: wp.speed,
            heading: 165.0,
            accuracy: 3.5,
            is_valid: 1,
            is_stale: 0,
            timestamp: ptTime.toISOString(),
            stop_name: wp.name,
            created_at: ptTime.toISOString(),
          });
        }
      }
    }
  }

  public saveEmbeddedData(): void {
    try {
      fs.writeFileSync(this.embeddedFilePath, JSON.stringify(this.embeddedData, null, 2), 'utf8');
    } catch (err: any) {
      console.error('[DB] Failed persisting embedded JSON:', err.message);
    }
  }

  public getTable<T = any>(tableName: string): T[] {
    if (!this.embeddedData[tableName]) {
      this.embeddedData[tableName] = [];
    }
    return this.embeddedData[tableName] as T[];
  }

  public insertRecord(tableName: string, record: any): any {
    const table = this.getTable(tableName);
    if (!record.id) {
      const maxId = table.reduce((max, item) => (item.id && Number(item.id) > max ? Number(item.id) : max), 0);
      record.id = maxId + 1;
    }
    if (!record.created_at) {
      record.created_at = new Date().toISOString();
    }
    table.push(record);
    this.saveEmbeddedData();

    // Push live change to Supabase if connected
    this.pushToSupabase(tableName, 'insert', record);
    return record;
  }

  public updateRecord(tableName: string, id: number, updates: any): any {
    const table = this.getTable(tableName);
    const index = table.findIndex((item) => Number(item.id) === Number(id));
    if (index !== -1) {
      updates.updated_at = new Date().toISOString();
      table[index] = { ...table[index], ...updates };
      this.saveEmbeddedData();

      // Push live change to Supabase if connected
      this.pushToSupabase(tableName, 'update', table[index], id);
      return table[index];
    }
    return null;
  }

  public deleteRecord(tableName: string, id: number): boolean {
    const table = this.getTable(tableName);
    const initialLen = table.length;
    this.embeddedData[tableName] = table.filter((item) => Number(item.id) !== Number(id));
    if (this.embeddedData[tableName].length !== initialLen) {
      this.saveEmbeddedData();

      // Push live change to Supabase if connected
      this.pushToSupabase(tableName, 'delete', null, id);
      return true;
    }
    return false;
  }

  /**
   * Universal Query Execution (MySQL pool query or embedded query)
   */
  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.mode === 'mysql' && this.pool) {
      const [rows] = await this.pool.query(sql, params);
      return rows as T[];
    }

    return this.executeEmbeddedQuery<T>(sql, params);
  }

  private executeEmbeddedQuery<T = any>(sql: string, params: any[]): T[] {
    const normalized = sql.trim().toLowerCase();

    for (const tableName of Object.keys(this.embeddedData)) {
      if (normalized.startsWith(`select * from ${tableName}`) || normalized.startsWith(`select * from \`${tableName}\``)) {
        let items = [...this.embeddedData[tableName]];
        if (normalized.includes('where id = ?') && params.length > 0) {
          items = items.filter((item) => Number(item.id) === Number(params[0]));
        }
        return items as T[];
      }
    }

    return [] as T[];
  }

  public getPool(): mysql.Pool | null {
    return this.pool;
  }
}

export const db = new DatabaseManager();
