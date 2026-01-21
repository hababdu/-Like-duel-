import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useGame } from '../contexts/GameContext';
import toast from 'react-hot-toast';

// Components
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatRoom from '../components/chat/ChatRoom';
import CreateChatModal from '../components/chat/CreateChatModal';
import InviteToChatModal from '../components/chat/InviteToChatModal';

// Icons
import {
  FaComments,
  FaUsers,
  FaPlus,
  FaSearch,
  FaGamepad,
  FaUserFriends,
  FaHashtag,
  FaCog,
  FaBell,
  FaBellSlash
} from 'react-icons/fa';

const ChatPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { sendChatMessage, addFriend } = useGame();
  const { isConnected } = useSocket();
  
  const [activeRoom, setActiveRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Load chat data
  useEffect(() => {
    const loadChatData = () => {
      if (!isAuthenticated) return;
      
      try {
        // Load rooms from localStorage
        const savedRooms = JSON.parse(localStorage.getItem('chatRooms') || '[]');
        setRooms(savedRooms);
        
        // Load friends
        const savedFriends = JSON.parse(localStorage.getItem('friends') || '[]');
        setFriends(savedFriends);
        
        // Set first room as active
        if (savedRooms.length > 0 && !activeRoom) {
          setActiveRoom(savedRooms[0]);
        }
        
        // Load notifications setting
        const notifications = localStorage.getItem('chatNotifications') !== 'false';
        setNotificationsEnabled(notifications);
        
      } catch (error) {
        console.error('Chat data loading error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadChatData();
    
    // Poll for updates
    const interval = setInterval(loadChatData, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, activeRoom]);

  // Handle room selection
  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    
    // Mark as read
    if (room.unreadCount > 0) {
      const updatedRooms = rooms.map(r => 
        r.id === room.id ? { ...r, unreadCount: 0 } : r
      );
      setRooms(updatedRooms);
      localStorage.setItem('chatRooms', JSON.stringify(updatedRooms));
    }
  };

  // Handle send message
  const handleSendMessage = async (text, type = 'text') => {
    if (!activeRoom || !text.trim() || !isConnected) return;
    
    try {
      await sendChatMessage(activeRoom.id, text, type);
      
      // Update room last message
      const updatedRooms = rooms.map(room => {
        if (room.id === activeRoom.id) {
          return {
            ...room,
            lastMessage: {
              text,
              sender: user.firstName,
              timestamp: new Date()
            },
            unreadCount: 0
          };
        }
        return room;
      });
      
      setRooms(updatedRooms);
      localStorage.setItem('chatRooms', JSON.stringify(updatedRooms));
      
    } catch (error) {
      toast.error('Xabar yuborishda xatolik');
    }
  };

  // Handle create room
  const handleCreateRoom = (roomData) => {
    const newRoom = {
      id: `room_${Date.now()}`,
      name: roomData.name,
      type: roomData.type,
      description: roomData.description,
      participants: roomData.participants || [],
      lastMessage: null,
      unreadCount: 0,
      createdAt: new Date(),
      createdBy: user.id
    };
    
    const updatedRooms = [newRoom, ...rooms];
    setRooms(updatedRooms);
    setActiveRoom(newRoom);
    localStorage.setItem('chatRooms', JSON.stringify(updatedRooms));
    
    toast.success('Chat yaratildi');
  };

  // Handle invite to chat
  const handleInviteToChat = async (friendIds) => {
    if (!activeRoom) return;
    
    try {
      // Add participants to room
      const updatedRoom = {
        ...activeRoom,
        participants: [...activeRoom.participants, ...friendIds]
      };
      
      const updatedRooms = rooms.map(room => 
        room.id === activeRoom.id ? updatedRoom : room
      );
      
      setRooms(updatedRooms);
      setActiveRoom(updatedRoom);
      localStorage.setItem('chatRooms', JSON.stringify(updatedRooms));
      
      toast.success('Dostlar chatga taklif qilindi');
    } catch (error) {
      toast.error('Taklif yuborishda xatolik');
    }
  };

  // Handle add friend
  const handleAddFriend = async (friendId) => {
    try {
      await addFriend(friendId, 'add');
      toast.success('Dostlik sorovi yuborildi');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  // Toggle notifications
  const toggleNotifications = () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    localStorage.setItem('chatNotifications', newValue.toString());
    
    toast(newValue ? 'Chat bildirishnomalari yoqildi' : 'Chat bildirishnomalari ochirildi');
  };

  // Filter rooms based on search
  const filteredRooms = rooms.filter(room => {
    if (!searchQuery) return true;
    
    return (
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (!isAuthenticated) {
    return (
      <div className="chat-not-authenticated">
        <div className="auth-prompt">
          <FaComments size={64} />
          <h2>Chat uchun kiring</h2>
          <p>Do'stlaringiz bilan suhbatlashish uchun tizimga kiring</p>
          <button 
            className="btn-primary"
            onClick={() => navigate('/')}
          >
            Kirish
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chat-loading">
        <div className="loading-spinner" />
        <p>Chat yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="chat-page"
    >
      <div className="chat-container">
        {/* Chat sidebar */}
        <ChatSidebar
          rooms={filteredRooms}
          friends={friends}
          activeRoom={activeRoom}
          onSelectRoom={handleSelectRoom}
          onAddFriend={handleAddFriend}
          onSearch={handleSearch}
          onToggleNotifications={toggleNotifications}
          notificationsEnabled={notificationsEnabled}
          onCreateRoom={() => setShowCreateModal(true)}
          onInviteToChat={() => setShowInviteModal(true)}
          searchQuery={searchQuery}
        />

        {/* Chat main area */}
        <div className="chat-main">
          {activeRoom ? (
            <ChatRoom
              room={activeRoom}
              user={user}
              onSendMessage={handleSendMessage}
              onInvite={() => setShowInviteModal(true)}
              disabled={!isConnected}
            />
          ) : (
            <div className="chat-welcome">
              <div className="welcome-content">
                <FaComments size={48} />
                <h2>Chatga xush kelibsiz!</h2>
                <p>Chat qilishni boshlash uchun chapdagi chatni tanlang yoki yangi chat yarating</p>
                
                <div className="welcome-actions">
                  <button
                    className="btn-primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <FaPlus /> Yangi chat
                  </button>
                  
                  <button
                    className="btn-secondary"
                    onClick={() => navigate('/friends')}
                  >
                    <FaUserFriends /> Do'st qo'shish
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateChatModal
            friends={friends}
            onCreate={handleCreateRoom}
            onClose={() => setShowCreateModal(false)}
          />
        )}
        
        {showInviteModal && activeRoom && (
          <InviteToChatModal
            room={activeRoom}
            friends={friends}
            onInvite={handleInviteToChat}
            onClose={() => setShowInviteModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChatPage;