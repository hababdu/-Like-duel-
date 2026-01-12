// utils/socket.ts - TO'LIQ YANGI VERSIYA
import { io, Socket } from 'socket.io-client';

// Mock socket events for development
const MOCK_EVENTS = {
  'connect': () => {
    console.log('✅ Mock: Socket connected');
    return { id: 'mock-socket-' + Date.now() };
  },
  'queue_position': () => {
    return { position: Math.floor(Math.random() * 5) + 1 };
  },
  'duel_found': () => {
    return {
      opponent: {
        id: 'opponent-' + Date.now(),
        name: ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey'][Math.floor(Math.random() * 5)],
        rating: 1500 + Math.floor(Math.random() * 500),
        level: Math.floor(Math.random() * 10) + 1,
        avatar: ['👨', '👩', '🧑', '👦', '👧'][Math.floor(Math.random() * 5)],
        wins: Math.floor(Math.random() * 20),
        losses: Math.floor(Math.random() * 10),
        online: true
      }
    };
  },
  'online_count': () => {
    return Math.floor(Math.random() * 100) + 150;
  },
  'queue_stats': () => {
    return {
      averageWait: 10 + Math.floor(Math.random() * 10),
      matchesToday: 1000 + Math.floor(Math.random() * 500)
    };
  },
  'opponent_vote': () => {
    const choices = ['like', 'super_like', 'skip'];
    return { choice: choices[Math.floor(Math.random() * 3)] };
  }
};

class SocketService {
  private socket: Socket | null = null;
  private mockMode = false;
  private mockListeners: Map<string, Function[]> = new Map();
  private isConnected = false;
  private mockInterval: NodeJS.Timeout | null = null;

  initSocket(token?: string) {
    try {
      // Check if we should use mock mode
      const useMock = process.env.NODE_ENV === 'development' || 
                     !process.env.REACT_APP_SOCKET_URL ||
                     process.env.REACT_APP_USE_MOCK_SOCKET === 'true';

      if (useMock) {
        console.log('🔧 Using mock socket mode');
        this.mockMode = true;
        this.initMockSocket();
        return;
      }

      // Real socket connection
      const serverUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
      
      console.log(`🔗 Connecting to socket server: ${serverUrl}`);

      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 5000,
        auth: token ? { token } : undefined,
      });

      this.setupEventListeners();

    } catch (error) {
      console.error('❌ Socket init error, falling back to mock mode:', error);
      this.mockMode = true;
      this.initMockSocket();
    }
  }

  private initMockSocket() {
    console.log('🎮 Initializing mock socket...');
    
    // Simulate connection after delay
    setTimeout(() => {
      this.isConnected = true;
      this.triggerMockEvent('connect', { id: 'mock-socket-' + Date.now() });
      console.log('✅ Mock socket connected');
      
      // Start sending periodic mock events
      this.startMockEvents();
      
    }, 1000);
  }

  private startMockEvents() {
    if (this.mockInterval) clearInterval(this.mockInterval);
    
    this.mockInterval = setInterval(() => {
      if (!this.isConnected) return;
      
      // Random events
      const random = Math.random();
      if (random < 0.3) {
        this.triggerMockEvent('online_count', Math.floor(Math.random() * 100) + 200);
      }
      
    }, 5000);
  }

  private setupEventListeners() {
    if (!this.socket || this.mockMode) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.isConnected = true;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      
      // Fallback to mock mode
      if (!this.mockMode) {
        console.log('🔄 Falling back to mock mode');
        this.mockMode = true;
        this.initMockSocket();
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      this.isConnected = false;
    });
  }

  // Mock event handling
  private triggerMockEvent(event: string, data?: any) {
    const listeners = this.mockListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in mock listener for ${event}:`, error);
        }
      });
    }
  }

  // Public methods
  getSocket(): Socket | null {
    if (this.mockMode) {
      // Return mock socket object
      return {
        connected: this.isConnected,
        id: 'mock-socket',
        emit: (event: string, data?: any) => {
          console.log(`📤 Mock emit: ${event}`, data);
          
          // Handle specific emits with mock responses
          if (event === 'join_queue') {
            setTimeout(() => {
              this.triggerMockEvent('queue_position', { position: Math.floor(Math.random() * 5) + 1 });
              
              // Simulate finding opponent after random delay
              setTimeout(() => {
                this.triggerMockEvent('duel_found', MOCK_EVENTS['duel_found']());
              }, 2000 + Math.random() * 3000);
            }, 500);
          }
          
          if (event === 'player_vote') {
            setTimeout(() => {
              this.triggerMockEvent('opponent_vote', MOCK_EVENTS['opponent_vote']());
              
              // Simulate match result after delay
              setTimeout(() => {
                const results = ['match', 'no_match', 'timeout'];
                const resultType = results[Math.floor(Math.random() * 3)];
                let message = '';
                let reward = 0;
                
                if (resultType === 'match') {
                  message = 'Match! +50 coins';
                  reward = 50;
                } else if (resultType === 'no_match') {
                  message = 'No match - Different choices';
                  reward = 0;
                } else {
                  message = "Time's up! No choice made";
                  reward = 0;
                }
                
                this.triggerMockEvent('duel_result', {
                  type: resultType,
                  message,
                  reward
                });
              }, 1500);
            }, 1000);
          }
          
          if (event === 'leave_queue') {
            console.log('👋 Left queue (mock)');
          }
        },
        on: (event: string, callback: Function) => {
          if (!this.mockListeners.has(event)) {
            this.mockListeners.set(event, []);
          }
          this.mockListeners.get(event)?.push(callback);
        },
        off: (event: string) => {
          this.mockListeners.delete(event);
        },
        disconnect: () => {
          this.isConnected = false;
          if (this.mockInterval) clearInterval(this.mockInterval);
          console.log('🔌 Mock socket disconnected');
        },
        // Add other socket.io methods as needed
        close: () => {},
        io: {
          opts: {},
          engine: {},
          _callbacks: {}
        } as any
      } as any;
    }
    
    return this.socket;
  }

  disconnect() {
    if (this.mockMode) {
      this.isConnected = false;
      if (this.mockInterval) clearInterval(this.mockInterval);
      this.mockListeners.clear();
      console.log('🔌 Mock socket disconnected');
    } else if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Helper method to check connection
  isConnectedToServer(): boolean {
    if (this.mockMode) return this.isConnected;
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();