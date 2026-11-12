import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { config } from './config/env';
import { db } from './database';
import { SocketHandler } from './sockets/socketHandler';
import { MonitoringWorker } from './jobs/monitoringWorker';

async function bootstrap() {
  console.log('------------------------------------------------------------');
  console.log('🚀 Starting Smart College Bus Transportation System Backend');
  console.log('------------------------------------------------------------');

  // Initialize Database
  await db.initDatabase();

  // Create HTTP & Socket.IO server
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  // Setup Real-time Sockets
  SocketHandler.initialize(io);

  // Start Background Monitoring Worker
  MonitoringWorker.start(4000);

  // Start Listening
  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`[HTTP] REST API Server listening on http://0.0.0.0:${config.port}`);
    console.log(`[Socket] Socket.IO real-time engine ready on port ${config.port}`);
    console.log(`[PWA] Web Push VAPID Public Key: ${config.vapid.publicKey.slice(0, 16)}...`);
    console.log(`[Database] Database engine active in [${db.mode.toUpperCase()}] mode`);
    console.log('------------------------------------------------------------');
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Shutting down gracefully...');
    MonitoringWorker.stop();
    httpServer.close(() => {
      console.log('[Server] HTTP and Socket server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('FATAL Server initialization failure:', err);
  process.exit(1);
});
