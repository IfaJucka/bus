import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'smart_bus_tracking',
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },

  jwtSecret: process.env.JWT_SECRET || 'smart_bus_jwt_super_secure_secret_key_2026_x98',
  sessionSecret: process.env.SESSION_SECRET || 'smart_bus_session_key_99024',

  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'BM_l6FZ9X7AXHfMyz5IHbz8PzlvssEtlAqWOCLitPV-dv4lDSGWZcM_pMb7PxNl3MdakifE2zxTPWEu4OmYoakw',
    privateKey: process.env.VAPID_PRIVATE_KEY || 'Okh52QW5Ey7G0rCVNy053ermrM8e8Zp_hRszg-P6Uhc',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@anjuman.edu',
  },

  routingApiKey: process.env.ROUTING_API_KEY || '',
  smsApiKey: process.env.SMS_API_KEY || '',
};
