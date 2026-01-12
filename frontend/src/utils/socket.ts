import { io, Socket } from 'socket.io-client';

// Environment variables
const SOCKET_URL = 'http://localhost:3001';

// ==============================
// 1. FUNCTION-BASED APPROACH
// ==============================

let socketInstance: Socket | null = null;

/**
 * Socket'ni ishga tushirish (function-based)
 */
export const initSocket = (userId?: string): Socket => {
  // Agar allaqachon ulangan bo'lsa
  if (socketInstance?.connected) {
    console.log('⚠️ Socket already connected, returning existing instance');
    return socketInstance;
  }
  
  // Agar disconnected bo'lsa, reconnect
  if (socketInstance && !socketInstance.connected) {
    console.log('🔌 Reconnecting existing socket...');
    socketInstance.connect();
    return socketInstance;
  }
  
  console.log('🚀 Initializing new socket connection to:', SOCKET_URL);
  
  // Yangi socket yaratish
  socketInstance = io(SOCKET_URL, {
    auth: userId ? { userId } : undefined,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    forceNew: false,
    query: {
      platform: 'web',
      version: '1.0.0',
      timestamp: Date.now(),
    },
  });

  // Event handlers
  socketInstance.on('connect', () => {
    console.log('✅ Socket connected! ID:', socketInstance?.id);
    console.log('🔗 Connected to:', SOCKET_URL);
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected. Reason:', reason);
  });

  socketInstance.on('connect_error', (error) => {
    console.error('🔴 Connection error:', error.message);
  });

  socketInstance.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
  });

  socketInstance.on('reconnect_failed', () => {
    console.error('🔴 Failed to reconnect after all attempts');
  });

  // Game-specific default listeners
  socketInstance.on('welcome', (data) => {
    console.log('👋 Server:', data.message);
  });

  socketInstance.on('online_count', (count) => {
    console.log('👥 Online players:', count);
  });

  return socketInstance;
};

/**
 * Mavjud socket'ni olish
 */
export const getSocket = (): Socket | null => {
  return socketInstance;
};

/**
 * Socket'ni ulash (agar ulanmagan bo'lsa)
 */
export const connectSocket = (userId?: string): Socket => {
  if (!socketInstance || !socketInstance.connected) {
    return initSocket(userId);
  }
  return socketInstance;
};

/**
 * Socket'ni uzish
 */
export const disconnectSocket = (): void => {
  if (socketInstance) {
    console.log('👋 Disconnecting socket...');
    socketInstance.disconnect();
    socketInstance = null;
  }
};

/**
 * Event yuborish
 */
export const emitEvent = (event: string, data: any): boolean => {
  if (socketInstance?.connected) {
    console.log(`📤 Emitting: ${event}`, data);
    socketInstance.emit(event, data);
    return true;
  }
  console.error(`🔴 Cannot emit ${event}: Socket not connected`);
  return false;
};

/**
 * Event listener qo'shish
 */
export const onEvent = (event: string, callback: (...args: any[]) => void): void => {
  if (socketInstance) {
    console.log(`👂 Listening for: ${event}`);
    socketInstance.on(event, callback);
  }
};

/**
 * Event listener'ni olib tashlash
 */
export const offEvent = (event: string, callback?: (...args: any[]) => void): void => {
  if (socketInstance) {
    if (callback) {
      socketInstance.off(event, callback);
    } else {
      socketInstance.off(event);
    }
    console.log(`❌ Stopped listening for: ${event}`);
  }
};

/**
 * Barcha event listener'larni olib tashlash
 */
export const removeAllListeners = (): void => {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    console.log('🗑️ Removed all listeners');
  }
};

/**
 * Connection holatini tekshirish
 */
export const isConnected = (): boolean => {
  return socketInstance?.connected || false;
};

/**
 * Socket ma'lumotlarini olish
 */
export const getSocketInfo = () => {
  if (!socketInstance) return { connected: false };
  
  return {
    connected: socketInstance.connected,
    id: socketInstance.id,
    disconnected: socketInstance.disconnected,
    url: SOCKET_URL,
    timestamp: Date.now(),
  };
};

// ==============================
// 2. CLASS-BASED APPROACH (SocketService)
// ==============================

export interface SocketEventCallbacks {
  [key: string]: (...args: any[]) => void;
}

export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private eventCallbacks: SocketEventCallbacks = {};
  private userId: string | null = null;
  
  private constructor() {}
  
  /**
   * Singleton instance olish
   */
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }
  
  /**
   * Socket'ni ishga tushirish
   */
  public initialize(userId?: string): Socket {
    this.userId = userId || null;
    
    // Agar allaqachon ulangan bo'lsa
    if (this.socket?.connected) {
      console.log('⚠️ SocketService: Already connected');
      return this.socket;
    }
    
    console.log('🚀 SocketService: Initializing connection to:', SOCKET_URL);
    
    this.socket = io(SOCKET_URL, {
      auth: userId ? { userId } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 15000,
      query: {
        platform: 'web',
        client: 'like-duel',
        userId: userId || 'anonymous',
      },
    });
    
    this.setupEventHandlers();
    return this.socket;
  }
  
  /**
   * Event handler'larni sozlash
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ SocketService: Connected! ID:', this.socket?.id);
      this.emit('user_connected', { 
        userId: this.userId,
        timestamp: Date.now() 
      });
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('❌ SocketService: Disconnected. Reason:', reason);
      this.emit('user_disconnected', { 
        userId: this.userId,
        reason,
        timestamp: Date.now() 
      });
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('🔴 SocketService: Connection error:', error.message);
    });
    
    // Reconnection events
    this.socket.on('reconnecting', (attemptNumber) => {
      console.log(`🔄 SocketService: Reconnecting (attempt ${attemptNumber})`);
    });
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ SocketService: Reconnected after ${attemptNumber} attempts`);
    });
    
    // Game events (default)
    this.socket.on('welcome', (data) => {
      console.log('👋 SocketService: Welcome message:', data.message);
    });
    
    this.socket.on('online_count', (count) => {
      console.log('👥 SocketService: Online players:', count);
    });
    
    this.socket.on('match_found', (matchData) => {
      console.log('🎮 SocketService: Match found!', matchData);
    });
  }
  
  /**
   * Socket'ni olish
   */
  public getSocket(): Socket | null {
    return this.socket;
  }
  
  /**
   * Event yuborish
   */
  public emit(event: string, data: any): boolean {
    if (this.socket?.connected) {
      console.log(`📤 SocketService: Emitting ${event}`, data);
      this.socket.emit(event, data);
      return true;
    }
    console.warn(`⚠️ SocketService: Cannot emit ${event} - Socket not connected`);
    return false;
  }
  
  /**
   * Event listener qo'shish
   */
  public on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      console.log(`👂 SocketService: Listening for ${event}`);
      this.socket.on(event, callback);
      
      // Store callback for cleanup
      this.eventCallbacks[event] = callback;
    }
  }
  
  /**
   * Event listener'ni olib tashlash
   */
  public off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
      delete this.eventCallbacks[event];
      console.log(`❌ SocketService: Stopped listening for ${event}`);
    }
  }
  
  /**
   * Ma'lum bir event uchun barcha listener'larni olib tashlash
   */
  public offAll(event: string): void {
    if (this.socket) {
      this.socket.removeAllListeners(event);
      Object.keys(this.eventCallbacks)
        .filter(key => key.startsWith(event))
        .forEach(key => delete this.eventCallbacks[key]);
    }
  }
  
  /**
   * Barcha event listener'larni olib tashlash
   */
  public removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.eventCallbacks = {};
      console.log('🗑️ SocketService: Removed all listeners');
    }
  }
  
  /**
   * Socket'ni uzish
   */
  public disconnect(): void {
    if (this.socket) {
      console.log('👋 SocketService: Disconnecting...');
      this.emit('user_leaving', { 
        userId: this.userId,
        timestamp: Date.now() 
      });
      this.socket.disconnect();
      this.socket = null;
      this.eventCallbacks = {};
    }
  }
  
  /**
   * Connection holatini tekshirish
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  /**
   * User ID ni o'rnatish
   */
  public setUserId(userId: string): void {
    this.userId = userId;
    if (this.socket) {
      this.socket.auth = { userId };
    }
  }
  
  /**
   * Socket ma'lumotlarini olish
   */
  public getInfo() {
    if (!this.socket) return { connected: false };
    
    return {
      connected: this.socket.connected,
      id: this.socket.id,
      userId: this.userId,
      url: SOCKET_URL,
      eventCount: Object.keys(this.eventCallbacks).length,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Queue bilan ishlash
   */
  public joinQueue(rating?: number): boolean {
    return this.emit('join_queue', {
      userId: this.userId,
      rating: rating || 1500,
      timestamp: Date.now(),
    });
  }
  
  public leaveQueue(): boolean {
    return this.emit('leave_queue', {
      userId: this.userId,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Duel voting
   */
  public sendVote(choice: 'like' | 'super_like' | 'skip', matchId?: string): boolean {
    return this.emit('player_vote', {
      userId: this.userId,
      choice,
      matchId,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Reconnect qilish
   */
  public reconnect(): Socket | null {
    if (this.socket) {
      console.log('🔄 SocketService: Manual reconnect');
      this.socket.connect();
      return this.socket;
    }
    return null;
  }
  
  /**
   * Connection test qilish
   */
  public async testConnection(timeout: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(false);
        return;
      }
      
      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);
      
      if (this.socket.connected) {
        clearTimeout(timer);
        resolve(true);
      } else {
        this.socket.once('connect', () => {
          clearTimeout(timer);
          resolve(true);
        });
        
        this.socket.once('connect_error', () => {
          clearTimeout(timer);
          resolve(false);
        });
      }
    });
  }
}

// ==============================
// 3. EXPORT HELPER FUNCTIONS
// ==============================

// Function-based exports
export {
  initSocket as initSocketFunction,
  getSocket as getSocketFunction,
  connectSocket as connectSocketFunction,
  disconnectSocket as disconnectSocketFunction,
  emitEvent as emitSocketEvent,
  onEvent as onSocketEvent,
  offEvent as offSocketEvent,
  isConnected as isSocketConnected,
};

// Class instance export
export const socketService = SocketService.getInstance();

// Default export (function-based)
export default {
  // Function-based
  init: initSocket,
  get: getSocket,
  connect: connectSocket,
  disconnect: disconnectSocket,
  emit: emitEvent,
  on: onEvent,
  off: offEvent,
  isConnected: isConnected,
  getInfo: getSocketInfo,
  
  // Class-based
  service: socketService,
  SocketService,
};