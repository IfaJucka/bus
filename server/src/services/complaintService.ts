import { db } from '../database';

export interface ComplaintData {
  id: number;
  reference_no: string;
  user_id: number | null;
  student_name: string;
  student_id: string;
  phone: string;
  email: string;
  bus_number: string;
  route_name: string;
  category: 'bus_delay' | 'driver_related' | 'missed_pickup' | 'incorrect_eta' | 'gps_issue' | 'route_problem' | 'vehicle_condition' | 'other';
  description: string;
  date_of_incident: string;
  preferred_contact: string;
  status: 'New' | 'Under Review' | 'In Progress' | 'Resolved' | 'Rejected';
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export class ComplaintService {
  /**
   * Submit student complaint with auto-generated reference ID
   */
  public static async submitComplaint(data: {
    studentName: string;
    studentId?: string;
    phone?: string;
    email?: string;
    busNumber: string;
    routeName: string;
    category: ComplaintData['category'];
    description: string;
    dateOfIncident: string;
    preferredContact?: string;
    userId?: number | null;
  }): Promise<ComplaintData> {
    if (!data.studentName || !data.busNumber || !data.category || !data.description) {
      throw new Error('Please fill in all required complaint fields.');
    }

    // Generate unique sequential reference number: CMP-1000 + count
    const count = await this.getComplaintCount();
    const referenceNo = `CMP-${1001 + count}`;
    const now = new Date().toISOString();

    const record = {
      reference_no: referenceNo,
      user_id: data.userId || null,
      student_name: data.studentName.trim(),
      student_id: (data.studentId || '').trim(),
      phone: (data.phone || '').trim(),
      email: (data.email || '').trim(),
      bus_number: data.busNumber.trim(),
      route_name: data.routeName.trim(),
      category: data.category,
      description: data.description.trim(),
      date_of_incident: data.dateOfIncident,
      preferred_contact: data.preferredContact || 'phone',
      status: 'New' as const,
      resolution_notes: null,
      resolved_by: null,
      resolved_at: null,
      created_at: now,
      updated_at: now,
    };

    let newId: number;

    if (db.mode === 'mysql' && db.getPool()) {
      const res: any = await db.query(
        `INSERT INTO complaints (
          reference_no, user_id, student_name, student_id, phone, email,
          bus_number, route_name, category, description, date_of_incident,
          preferred_contact, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New')`,
        [
          record.reference_no,
          record.user_id,
          record.student_name,
          record.student_id,
          record.phone,
          record.email,
          record.bus_number,
          record.route_name,
          record.category,
          record.description,
          record.date_of_incident,
          record.preferred_contact,
        ]
      );
      newId = res.insertId;

      await db.query(
        'INSERT INTO complaint_updates (complaint_id, old_status, new_status, comment, updated_by) VALUES (?, "", "New", "Complaint received by system", "System")',
        [newId]
      );
    } else {
      const saved = db.insertRecord('complaints', record);
      newId = saved.id;

      db.insertRecord('complaint_updates', {
        complaint_id: newId,
        old_status: '',
        new_status: 'New',
        comment: 'Complaint received by system',
        updated_by: 'System',
      });
    }

    return (await this.getComplaintById(newId))!;
  }

  public static async getAllComplaints(statusFilter?: string): Promise<ComplaintData[]> {
    if (db.mode === 'mysql' && db.getPool()) {
      if (statusFilter && statusFilter !== 'All') {
        return db.query('SELECT * FROM complaints WHERE status = ? ORDER BY id DESC', [statusFilter]);
      }
      return db.query('SELECT * FROM complaints ORDER BY id DESC');
    }

    const table = db.getTable<ComplaintData>('complaints');
    if (statusFilter && statusFilter !== 'All') {
      return table.filter((c) => c.status === statusFilter).sort((a, b) => b.id - a.id);
    }
    return [...table].sort((a, b) => b.id - a.id);
  }

  public static async getComplaintById(id: number): Promise<ComplaintData | null> {
    if (db.mode === 'mysql' && db.getPool()) {
      const rows: any = await db.query('SELECT * FROM complaints WHERE id = ?', [id]);
      return rows[0] || null;
    }
    const table = db.getTable<ComplaintData>('complaints');
    return table.find((c) => c.id === id) || null;
  }

  public static async getComplaintByReference(refNo: string): Promise<ComplaintData | null> {
    if (db.mode === 'mysql' && db.getPool()) {
      const rows: any = await db.query('SELECT * FROM complaints WHERE reference_no = ?', [refNo]);
      return rows[0] || null;
    }
    const table = db.getTable<ComplaintData>('complaints');
    return table.find((c) => c.reference_no.toUpperCase() === refNo.toUpperCase()) || null;
  }

  public static async updateComplaintStatus(
    id: number,
    newStatus: ComplaintData['status'],
    notes: string,
    updatedBy: string
  ): Promise<ComplaintData | null> {
    const existing = await this.getComplaintById(id);
    if (!existing) return null;

    const oldStatus = existing.status;
    const now = new Date().toISOString();

    if (db.mode === 'mysql' && db.getPool()) {
      await db.query(
        `UPDATE complaints 
         SET status = ?, resolution_notes = ?, resolved_by = ?, resolved_at = ?
         WHERE id = ?`,
        [newStatus, notes, updatedBy, newStatus === 'Resolved' ? new Date() : null, id]
      );

      await db.query(
        'INSERT INTO complaint_updates (complaint_id, old_status, new_status, comment, updated_by) VALUES (?, ?, ?, ?, ?)',
        [id, oldStatus, newStatus, notes, updatedBy]
      );
    } else {
      db.updateRecord('complaints', id, {
        status: newStatus,
        resolution_notes: notes,
        resolved_by: updatedBy,
        resolved_at: newStatus === 'Resolved' ? now : null,
      });

      db.insertRecord('complaint_updates', {
        complaint_id: id,
        old_status: oldStatus,
        new_status: newStatus,
        comment: notes,
        updated_by: updatedBy,
      });
    }

    return this.getComplaintById(id);
  }

  private static async getComplaintCount(): Promise<number> {
    if (db.mode === 'mysql' && db.getPool()) {
      const rows: any = await db.query('SELECT COUNT(*) as count FROM complaints');
      return rows[0]?.count || 0;
    }
    return db.getTable('complaints').length;
  }
}
