import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

// Components
import FriendsList from '../components/friends/FriendsList';
import FriendRequests from '../components/friends/FriendRequests';
import FindFriends from '../components/friends/FindFriends';
import FriendStats from '../components/friends/FriendStats';

// Icons
import {
  FaUsers,
  FaUserPlus,
  FaSearch,
  FaEnvelope,
  FaGamepad,
  FaComment,
  FaUserTimes,
  FaCheck,
  FaTimes,
  FaOnline,
  FaOffline
} from 'react-icons/fa';

const FriendsPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { addFriend, sendGameInvite } = useGame();
  const { isConnected } = useSocket();
  
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load friends data
  useEffect(() => {
    const loadFriendsData = () => {
      if (!isAuthenticated) return;
      
      try {
        // Load friends from localStorage
        const savedFriends = JSON.parse(localStorage.getItem('friends') || '[]');
        setFriends(savedFriends);
        
        // Load friend requests
        const savedRequests = JSON.parse(localStorage.getItem('friendRequests') || '[]');
        setRequests(savedRequests);
        
      } catch (error) {
        console.error('Friends data loading error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFriendsData();
    
    // Poll for updates
    const interval = setInterval(loadFriendsData, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Handle search friends
  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      // Mock search - in real app, call API
      const mockResults = [
        {
          id: 123456789,
          firstName: 'Foydalanuvchi',
          username: 'user_' + query,
          isOnline: Math.random() > 0.5,
          elo: Math.floor(Math.random() * 500) + 1000,
          isFriend: false
        }
      ];
      
      setSearchResults(mockResults);
    } catch (error) {
      toast.error('Qidiruvda xatolik');
    }
  };

  // Handle send friend request
  const handleSendRequest = async (userId) => {
    if (!isConnected) {
      toast.error('Serverga ulanmagan');
      return;
    }
    
    try {
      await addFriend(userId, 'add');
      toast.success('Dostlik sorovi yuborildi');
      
      // Update search results
      setSearchResults(prev => 
        prev.map(user => 
          user.id === userId ? { ...user, requestSent: true } : user
        )
      );
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Handle accept/decline request
  const handleRespondToRequest = async (requestId, accept) => {
    try {
      // Update request status locally
      const updatedRequests = requests.filter(req => req.id !== requestId);
      setRequests(updatedRequests);
      localStorage.setItem('friendRequests', JSON.stringify(updatedRequests));
      
      if (accept) {
        // Add to friends list
        const request = requests.find(req => req.id === requestId);
        if (request) {
          const newFriend = {
            id: request.from.id,
            firstName: request.from.firstName,
            username: request.from.username,
            addedAt: new Date()
          };
          
          const updatedFriends = [...friends, newFriend];
          setFriends(updatedFriends);
          localStorage.setItem('friends', JSON.stringify(updatedFriends));
          
          toast.success(`${request.from.firstName} do'stingiz bo'ldi`);
        }
      } else {
        toast('Dostlik sorovi rad etildi');
      }
    } catch (error) {
      toast.error('Amalni bajarishda xatolik');
    }
  };

  // Handle remove friend
  const handleRemoveFriend = async (friendId) => {
    if (window.confirm('Rostan ham bu dostni ochirmoqchimisiz?')) {
      try {
        await addFriend(friendId, 'remove');
        
        const updatedFriends = friends.filter(f => f.id !== friendId);
        setFriends(updatedFriends);
        localStorage.setItem('friends', JSON.stringify(updatedFriends));
        
        toast.success('Dost ochirildi');
      } catch (error) {
        toast.error('Dostni ochirishda xatolik');
      }
    }
  };

  // Handle invite to game
  const handleInviteToGame = async (friendId) => {
    try {
      await sendGameInvite(friendId, 'casual', 3);
      toast.success('Oyin taklifi yuborildi');
    } catch (error) {
      toast.error('Taklif yuborishda xatolik');
    }
  };

  // Handle start chat
  const handleStartChat = (friendId) => {
    // Navigate to chat with friend
    navigate(`/chat?friend=${friendId}`);
  };

  // Tab definitions
  const tabs = [
    { id: 'friends', label: 'Dostlar', icon: <FaUsers /> },
    { id: 'requests', label: 'Sorovlar', icon: <FaEnvelope /> },
    { id: 'find', label: 'Dost qidirish', icon: <FaSearch /> }
  ];

  // Calculate stats
  const friendStats = {
    total: friends.length,
    online: friends.filter(f => f.isOnline).length,
    inGame: friends.filter(f => f.inGame).length,
    requests: requests.length
  };

  if (!isAuthenticated) {
    return (
      <div className="friends-not-authenticated">
        <div className="auth-prompt">
          <FaUsers size={64} />
          <h2>Do'stlar uchun kiring</h2>
          <p>Do'stlaringizni qo'shish va ular bilan o'ynash uchun tizimga kiring</p>
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

  if (isLoading) {
    return (
      <div className="friends-loading">
        <div className="loading-spinner" />
        <p>Do'stlar yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="friends-page"
    >
      <div className="page-header">
        <button 
          className="btn-back"
          onClick={() => navigate('/')}
        >
          ← Ortga
        </button>
        <h1 className="page-title">
          <FaUsers /> Do'stlar
        </h1>
        <FriendStats stats={friendStats} />
      </div>

      <div className="friends-container">
        {/* Tab navigation */}
        <div className="friends-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              {tab.id === 'requests' && friendStats.requests > 0 && (
                <span className="badge">{friendStats.requests}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="friends-content">
          {activeTab === 'friends' && (
            <FriendsList
              friends={friends}
              onRemove={handleRemoveFriend}
              onInvite={handleInviteToGame}
              onChat={handleStartChat}
              onPlay={() => navigate('/play')}
            />
          )}
          
          {activeTab === 'requests' && (
            <FriendRequests
              requests={requests}
              onAccept={(id) => handleRespondToRequest(id, true)}
              onDecline={(id) => handleRespondToRequest(id, false)}
            />
          )}
          
          {activeTab === 'find' && (
            <FindFriends
              searchResults={searchResults}
              onSearch={handleSearch}
              onSendRequest={handleSendRequest}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}
        </div>

        {/* Quick actions */}
        <div className="friends-actions">
          <button
            className="btn-primary"
            onClick={() => setActiveTab('find')}
          >
            <FaUserPlus /> Yangi do'st
          </button>
          
          <button
            className="btn-secondary"
            onClick={() => navigate('/chat')}
          >
            <FaComment /> Chat
          </button>
          
          <button
            className="btn-outline"
            onClick={() => navigate('/play')}
          >
            <FaGamepad /> O'ynash
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default FriendsPage;