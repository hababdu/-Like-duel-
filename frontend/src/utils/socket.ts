import { io, Socket } from 'socket.io-client';

const SOCKET_URL =  'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;
  private listeners = new Map<string, (...args: any[]) => void>();

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      // Agar allaqachon ulangan bo'lsa, disconnect qilish
      if (this.socket?.connected) {
        this.socket.disconnect();
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket connected:', this.socket?.id);
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('⚠️ Socket disconnected:', reason);
      });

      this.socket.on('error', (error) => {
        console.error('🔥 Socket error:', error);
      });
    });
  }

  // Old version compatibility
  init(userId: string): Socket {
    console.log('🔌 Initializing socket for user:', userId);
    
    // Eski version uchun - token o'rniga userId yuboriladi
    this.connect(userId).catch(error => {
      console.error('Socket connection failed:', error);
    });
    
    return this.socket!;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
      console.log('🔌 Socket disconnected');
    }
  }

  // Connection info olish
  getSocketInfo(): {
    connected: boolean;
    id: string | undefined;
    hasListeners: number;
  } {
    return {
      connected: this.socket?.connected || false,
      id: this.socket?.id,
      hasListeners: this.listeners.size
    };
  }

  // Event listeners qo'shish
  on(event: string, callback: (data: any) => void): void {
    this.socket?.on(event, callback);
    this.listeners.set(event, callback);
  }

  off(event: string, callback?: (data: any) => void): void {
    this.socket?.off(event, callback);
    this.listeners.delete(event);
  }

  once(event: string, callback: (data: any) => void): void {
    this.socket?.once(event, callback);
  }

  // Emit events
  emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  // Navbatga qo'shilish
  joinQueue(): void {
    this.emit('join_queue');
  }

  // Navbatni tark etish
  leaveQueue(): void {
    this.emit('leave_queue');
  }

  // Ovoz berish
  sendVote(choice: 'like' | 'super_like' | 'skip', duelId: string): void {
    this.emit('player_vote', { choice, duelId });
  }

  // Rematch so'rash
  requestRematch(opponentId: string): void {
    this.emit('request_rematch', { opponentId });
  }

  // Online count so'rash
  getOnlineCount(): void {
    this.emit('get_online_count');
  }

  // Live matches so'rash
  getLiveMatches(): void {
    this.emit('get_live_matches');
  }

  // Debug information so'rash
  getDebugInfo(): void {
    this.emit('get_debug_info');
  }

  // Connection holati
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // Clean up all listeners
  cleanup(): void {
    if (this.socket) {
      this.listeners.forEach((callback, event) => {
        this.socket?.off(event, callback);
      });
      this.listeners.clear();
    }
  }
}

// Singleton instance
const socketService = SocketService.getInstance();

// Export functions for App.tsx
export const initSocket = (userId: string) => socketService.init(userId);
export const getSocketInfo = () => socketService.getSocketInfo();
export const disconnectSocket = () => socketService.disconnect();
export const getSocket = () => socketService.getSocket();

// Alias functions for backward compatibility
export const connectSocket = (token: string) => socketService.connect(token);

// Export service for other components
export { socketService };

// Socket events constants
export const socketEvents = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  ERROR: 'error',
  
  // Game events
  WELCOME: 'welcome',
  DUEL_FOUND: 'duel_found',
  OPPONENT_VOTE: 'opponent_vote',
  DUEL_RESULT: 'duel_result',
  QUEUE_POSITION: 'queue_position',
  ONLINE_COUNT: 'online_count',
  LIVE_MATCHES: 'live_matches',
  REMATCH_REQUEST: 'rematch_request',
  DEBUG_INFO: 'debug_info',
  
  // User events
  USER_CONNECTED: 'user_connected',
  USER_DISCONNECTED: 'user_disconnected'
};

// Default export
export default socketService;