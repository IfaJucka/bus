import { Server as SocketIOServer, Socket } from 'socket.io';
import { BusService } from '../services/busService';

export class SocketHandler {
  private static io: SocketIOServer | null = null;

  public static initialize(io: SocketIOServer): void {
    this.io = io;

    io.on('connection', async (socket: Socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);

      // Send immediate snapshot of all active buses upon connection
      try {
        const buses = await BusService.getAllBuses();
        socket.emit('initial:state', { buses });
      } catch (e: any) {
        console.error('[Socket] Failed to send initial state:', e.message);
      }

      // Room management
      socket.on('join:bus', (busId: number | string) => {
        const room = `bus:${busId}`;
        socket.join(room);
        console.log(`[Socket] ${socket.id} joined ${room}`);
      });

      socket.on('leave:bus', (busId: number | string) => {
        const room = `bus:${busId}`;
        socket.leave(room);
      });

      socket.on('join:student', (studentIdentifier: string) => {
        const room = `student:${studentIdentifier}`;
        socket.join(room);
        console.log(`[Socket] ${socket.id} joined ${room}`);
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });
  }

  public static broadcastBusLocation(data: {
    busId: number;
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    status: string;
    gpsStatus: string;
    timestamp: string;
    etaMinutes?: number;
    nextStopName?: string;
    distanceRemainingKm?: number;
    delayMinutes?: number;
  }): void {
    if (!this.io) return;
    this.io.emit('bus:location', data);
    this.io.to(`bus:${data.busId}`).emit('bus:eta', {
      busId: data.busId,
      etaMinutes: data.etaMinutes,
      nextStopName: data.nextStopName,
      distanceRemainingKm: data.distanceRemainingKm,
      delayMinutes: data.delayMinutes,
    });
  }

  public static broadcastBusStatus(busId: number, status: string, gpsStatus: string): void {
    if (!this.io) return;
    this.io.emit('bus:status', { busId, status, gpsStatus });
  }

  public static broadcastTripStarted(trip: any): void {
    if (!this.io) return;
    this.io.emit('trip:started', trip);
  }

  public static broadcastTripEnded(trip: any): void {
    if (!this.io) return;
    this.io.emit('trip:ended', trip);
  }

  public static broadcastNotification(studentIdentifier: string, notification: any): void {
    if (!this.io) return;
    this.io.to(`student:${studentIdentifier}`).emit('notification:new', notification);
    this.io.emit('notification:global', notification);
  }
}
