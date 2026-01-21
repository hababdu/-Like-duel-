import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const WEBSOCKET_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:10000';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [pendingMessages, setPendingMessages] = useState([]);
  const navigate = useNavigate();

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  // Send message function
  const sendMessage = useCallback((type, data = {}) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const message = {
        type,
        ...data,
        timestamp: Date.now(),
        clientId: localStorage.getItem('clientId') || generateClientId()
      };
      
      socket.send(JSON.stringify(message));
      return true;
    } else {
      // Queue message for later
      setPendingMessages(prev => [...prev, { type, data }]);
      
      // Try to reconnect if disconnected
      if (!isConnected && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        connect();
      }
      
      return false;
    }
  }, [socket, isConnected, reconnectAttempt]);

  // Generate unique client ID
  const generateClientId = () => {
    const id = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('clientId', id);
    return id;
  };

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setConnectionStatus('connecting');
    
    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      setSocket(ws);

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempt(0);
        
        // Send pending messages
        if (pendingMessages.length > 0) {
          pendingMessages.forEach(msg => {
            sendMessage(msg.type, msg.data);
          });
          setPendingMessages([]);
        }
        
        toast.success('Serverga ulandik!');
        console.log('✅ WebSocket connected');
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        if (!event.wasClean) {
          console.log('❌ WebSocket connection lost');
          toast.error('Server bilan aloqa uzildi');
          
          // Attempt reconnect
          if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttempt);
            console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})`);
            
            setTimeout(() => {
              setReconnectAttempt(prev => prev + 1);
              connect();
            }, delay);
          } else {
            toast.error('Serverga ulanish muvaffaqiyatsiz. Iltimos, sahifani yangilang.');
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Server bilan bog‘lanishda xatolik');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleIncomingMessage(message);
        } catch (error) {
          console.error('Message parsing error:', error);
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('error');
    }
  }, [socket, reconnectAttempt, pendingMessages, sendMessage]);

  // Handle incoming messages
  const handleIncomingMessage = useCallback((message) => {
    switch (message.type) {
      case 'authenticated':
        handleAuthentication(message);
        break;
        
      case 'match_found':
        handleMatchFound(message);
        break;
        
      case 'game_result':
        handleGameResult(message);
        break;
        
      case 'notification':
        handleNotification(message);
        break;
        
      case 'chat_message':
        handleChatMessage(message);
        break;
        
      case 'game_invitation':
        handleGameInvitation(message);
        break;
        
      case 'tournament_started':
        handleTournamentStarted(message);
        break;
        
      case 'error':
        handleError(message);
        break;
        
      default:
        console.log('Unhandled message type:', message.type);
    }
  }, [navigate]);

  // Message handlers
  const handleAuthentication = (message) => {
    localStorage.setItem('userData', JSON.stringify(message.user));
    localStorage.setItem('sessionId', message.sessionId);
    
    toast.success(`Xush kelibsiz, ${message.user.firstName}!`);
    
    // Navigate to home
    navigate('/');
  };

  const handleMatchFound = (message) => {
    const gameData = {
      gameId: message.gameId,
      opponent: message.opponent,
      mode: message.gameMode,
      rounds: message.rounds,
      isRanked: message.isRanked,
      status: 'starting'
    };
    
    localStorage.setItem('currentGame', JSON.stringify(gameData));
    
    // Navigate to game room
    navigate(`/game/${message.gameId}`);
    
    toast.success(`Raqib topildi: ${message.opponent.firstName}`);
  };

  const handleGameResult = (message) => {
    // Update game result
    const gameResult = {
      ...message,
      finishedAt: new Date()
    };
    
    localStorage.setItem('lastGameResult', JSON.stringify(gameResult));
    
    // Show result notification
    if (message.winnerId === parseInt(localStorage.getItem('userId'))) {
      toast.success('🎉 Tabriklaymiz! Siz yutdingiz!');
    } else if (message.result === 'draw') {
      toast('🤝 Durang!');
    } else {
      toast.error('😔 Mag‘lub bo‘ldingiz. Keyingi safar omad!');
    }
    
    // Navigate back to home
    navigate('/');
  };

  const handleNotification = (message) => {
    const notification = message.notification;
    
    toast(notification.message, {
      duration: 5000,
      icon: getNotificationIcon(notification.type),
      style: {
        background: getNotificationColor(notification.type),
        color: 'white'
      }
    });
    
    // Store notification
    const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    notifications.unshift(notification);
    localStorage.setItem('notifications', JSON.stringify(notifications.slice(0, 50)));
  };

  const handleChatMessage = (message) => {
    // Update chat room
    const roomMessages = JSON.parse(localStorage.getItem(`chat_${message.roomId}`) || '[]');
    roomMessages.push(message.message);
    localStorage.setItem(`chat_${message.roomId}`, JSON.stringify(roomMessages.slice(-100)));
    
    // Show notification if not in chat room
    if (!window.location.pathname.includes('/chat/')) {
      toast(`${message.message.senderName}: ${message.message.text}`, {
        duration: 3000,
        icon: '💬'
      });
    }
  };

  const handleGameInvitation = (message) => {
    // Store invitation
    const invitations = JSON.parse(localStorage.getItem('invitations') || '[]');
    invitations.push({
      ...message,
      receivedAt: new Date()
    });
    localStorage.setItem('invitations', JSON.stringify(invitations.slice(0, 20)));
    
    // Show invitation toast
    toast.custom((t) => (
      <div className="invitation-toast">
        <h4>🎮 O'yin taklifi</h4>
        <p>{message.inviter.firstName} sizni o'yinga taklif qildi</p>
        <div className="toast-actions">
          <button onClick={() => {
            sendMessage('respond_invitation', {
              invitationId: message.invitationId,
              response: 'accept'
            });
            toast.dismiss(t.id);
          }}>
            Qabul qilish
          </button>
          <button onClick={() => {
            sendMessage('respond_invitation', {
              invitationId: message.invitationId,
              response: 'reject'
            });
            toast.dismiss(t.id);
          }}>
            Rad etish
          </button>
        </div>
      </div>
    ), {
      duration: 60000,
    });
  };

  const handleTournamentStarted = (message) => {
    navigate(`/tournament/${message.tournamentId}`);
    toast.success(`Turnir boshladi: ${message.tournamentName}`);
  };

  const handleError = (message) => {
    toast.error(message.message || 'Xatolik yuz berdi');
    console.error('Server error:', message);
  };

  // Helper functions
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'game_invite': return '🎮';
      case 'tournament_invite': return '🏆';
      case 'friend_request': return '👥';
      case 'achievement': return '🏅';
      default: return '📢';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'game_invite': return '#3b82f6';
      case 'tournament_invite': return '#f59e0b';
      case 'friend_request': return '#10b981';
      case 'achievement': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  // Authentication function
  const authenticate = (initData, deviceInfo) => {
    sendMessage('authenticate', { initData, deviceInfo });
  };

  // Connect on mount
  useEffect(() => {
    connect();
    
    // Heartbeat interval
    const heartbeatInterval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        sendMessage('heartbeat');
      }
    }, 30000);
    
    // Cleanup
    return () => {
      clearInterval(heartbeatInterval);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  // Context value
  const contextValue = {
    socket,
    isConnected,
    connectionStatus,
    sendMessage,
    authenticate,
    reconnect: connect
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};