import { Router, Request, Response } from 'express';
import { ComplaintService } from '../services/complaintService';

const router = Router();

// POST /api/complaints
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      studentName,
      studentId,
      phone,
      email,
      busNumber,
      routeName,
      category,
      description,
      dateOfIncident,
      preferredContact,
      userId,
    } = req.body;

    const complaint = await ComplaintService.submitComplaint({
      studentName,
      studentId,
      phone,
      email,
      busNumber,
      routeName,
      category,
      description,
      dateOfIncident: dateOfIncident || new Date().toISOString().split('T')[0],
      preferredContact,
      userId,
    });

    res.status(201).json({
      success: true,
      message: `Your complaint has been submitted successfully. Reference ID: ${complaint.reference_no}.`,
      complaint,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/complaints
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const complaints = await ComplaintService.getAllComplaints(status);
    res.json({ success: true, count: complaints.length, complaints });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/complaints/ref/:refNo
router.get('/ref/:refNo', async (req: Request, res: Response) => {
  try {
    const refNo = req.params.refNo;
    const complaint = await ComplaintService.getComplaintByReference(refNo);
    if (!complaint) {
      res.status(404).json({ success: false, error: `No complaint found with reference ${refNo}` });
      return;
    }
    res.json({ success: true, complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/complaints/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const complaint = await ComplaintService.getComplaintById(id);
    if (!complaint) {
      res.status(404).json({ success: false, error: 'Complaint not found' });
      return;
    }
    res.json({ success: true, complaint });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/complaints/:id/status (Admin status update)
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, notes, updatedBy } = req.body;

    if (!status) {
      res.status(400).json({ success: false, error: 'New status is required' });
      return;
    }

    const updated = await ComplaintService.updateComplaintStatus(
      id,
      status,
      notes || '',
      updatedBy || 'Administrator'
    );

    if (!updated) {
      res.status(404).json({ success: false, error: 'Complaint not found' });
      return;
    }

    res.json({ success: true, message: 'Complaint updated successfully', complaint: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
