// src/utils/gameWebSocket.js
export class GameWebSocket {
    constructor(url, handlers) {
      this.url = url;
      this.handlers = handlers;
      this.socket = null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 3000;
      this.messageQueue = [];
      this.isConnected = false;
    }
  
    connect() {
      return new Promise((resolve, reject) => {
        try {
          this.socket = new WebSocket(this.url);
  
          this.socket.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.flushMessageQueue();
            
            if (this.handlers.onOpen) {
              this.handlers.onOpen();
            }
            resolve();
          };
  
          this.socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              this.handleMessage(data);
            } catch (error) {
              console.error('Message parse error:', error);
            }
          };
  
          this.socket.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.isConnected = false;
            
            if (this.handlers.onClose) {
              this.handlers.onClose(event);
            }
            
            this.attemptReconnect();
          };
  
          this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.isConnected = false;
            
            if (this.handlers.onError) {
              this.handlers.onError(error);
            }
          };
        } catch (error) {
          reject(error);
        }
      });
    }
  
    handleMessage(data) {
      console.log('Received:', data);
      
      // Global message handlers
      switch (data.type) {
        case 'authenticated':
          localStorage.setItem('sessionId', data.sessionId);
          break;
        case 'error':
          console.error('Server error:', data);
          break;
      }
      
      // Custom handler
      if (this.handlers.onMessage) {
        this.handlers.onMessage(data);
      }
    }
  
    send(data) {
      if (!this.isConnected || !this.socket) {
        this.messageQueue.push(data);
        return false;
      }
  
      try {
        const jsonData = JSON.stringify(data);
        this.socket.send(jsonData);
        return true;
      } catch (error) {
        console.error('Send error:', error);
        this.messageQueue.push(data);
        return false;
      }
    }
  
    flushMessageQueue() {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.send(message);
      }
    }
  
    attemptReconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        return;
      }
  
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
  
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnect failed:', error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  
    close() {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      this.isConnected = false;
    }
  }
  
  // Singleton instance
  let gameSocketInstance = null;
  
  export const connectToGameServer = (userData, handlers) => {
    if (gameSocketInstance) {
      gameSocketInstance.close();
    }
  
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:10000';
    gameSocketInstance = new GameWebSocket(wsUrl, handlers);
  
    gameSocketInstance.connect().then(() => {
      // Authenticate with server
      gameSocketInstance.send({
        type: 'authenticate',
        initData: userData.initData,
        deviceInfo: {
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          screen: {
            width: window.screen.width,
            height: window.screen.height
          }
        }
      });
    });
  
    return gameSocketInstance;
  };
  
  export const sendMessage = (data) => {
    if (!gameSocketInstance || !gameSocketInstance.isConnected) {
      throw new Error('Socket not connected');
    }
    return gameSocketInstance.send(data);
  };
  
  export const subscribeToMessages = (callback) => {
    if (!gameSocketInstance) return () => {};
    
    const originalHandler = gameSocketInstance.handlers.onMessage;
    
    gameSocketInstance.handlers.onMessage = (data) => {
      if (originalHandler) {
        originalHandler(data);
      }
      callback(data);
    };
    
    return () => {
      gameSocketInstance.handlers.onMessage = originalHandler;
    };
  };