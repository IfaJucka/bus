import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import busRoutes from './routes/buses';
import driverRoutes from './routes/drivers';
import routeRoutes from './routes/routes';
import pickupPointRoutes from './routes/pickupPoints';
import trackingRoutes from './routes/tracking';
import tripRoutes from './routes/trips';
import etaRoutes from './routes/eta';
import historyRoutes from './routes/history';
import notificationRoutes from './routes/notifications';
import complaintRoutes from './routes/complaints';
import pushRoutes from './routes/push';
import adminRoutes from './routes/admin';
import { db } from './database';

const app = express();

// CORS configuration
const allowedOrigins = [
  "https://bus-nine-ashen.vercel.app",
  "https://bus-3ul2vc9fk-elfajuckaa-6777.vercel.app",
  "http://localhost:5173"
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Root and Health Check Endpoints
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Smart Bus API running' });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Smart Bus API running' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    appName: 'Smart College Bus Transportation System',
    dbMode: db.mode,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/pickup-points', pickupPointRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/eta', etaRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/admin', adminRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

export default app;
