import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  public connect(): Socket {
    if (!this.socket) {
      // Connect to configured production backend or live Render backend
      const DEFAULT_BACKEND_URL = 'https://smart-bus-backend-1mjy.onrender.com';
      const socketTarget = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || DEFAULT_BACKEND_URL) as string;
      const cleanTarget = socketTarget ? socketTarget.replace(/\/+$/, '') : DEFAULT_BACKEND_URL;

      this.socket = io(cleanTarget, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      this.socket.on('connect', () => {
        console.log('[Socket.IO] Connected to real-time server with ID:', this.socket?.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('[Socket.IO] Disconnected:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.warn('[Socket.IO] Connection error:', error.message);
      });
    }

    return this.socket;
  }

  public getSocket(): Socket {
    return this.connect();
  }

  public joinBus(busId: number): void {
    this.connect().emit('join:bus', busId);
  }

  public leaveBus(busId: number): void {
    this.connect().emit('leave:bus', busId);
  }

  public joinStudent(studentId: string): void {
    this.connect().emit('join:student', studentId);
  }

  public onBusLocation(callback: (data: any) => void): () => void {
    const s = this.connect();
    s.on('bus:location', callback);
    return () => s.off('bus:location', callback);
  }

  public onBusStatus(callback: (data: any) => void): () => void {
    const s = this.connect();
    s.on('bus:status', callback);
    return () => s.off('bus:status', callback);
  }

  public onBusEta(callback: (data: any) => void): () => void {
    const s = this.connect();
    s.on('bus:eta', callback);
    return () => s.off('bus:eta', callback);
  }

  public onTripStarted(callback: (trip: any) => void): () => void {
    const s = this.connect();
    s.on('trip:started', callback);
    return () => s.off('trip:started', callback);
  }

  public onTripEnded(callback: (trip: any) => void): () => void {
    const s = this.connect();
    s.on('trip:ended', callback);
    return () => s.off('trip:ended', callback);
  }

  public onNotification(callback: (notification: any) => void): () => void {
    const s = this.connect();
    const handler = (notif: any) => callback(notif);
    s.on('notification:new', handler);
    s.on('notification:global', handler);
    return () => {
      s.off('notification:new', handler);
      s.off('notification:global', handler);
    };
  }

  public onInitialState(callback: (data: any) => void): () => void {
    const s = this.connect();
    s.on('initial:state', callback);
    return () => s.off('initial:state', callback);
  }
}

export const socketService = new SocketService();
