import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Confetti from 'react-confetti';
import toast from 'react-hot-toast';

// Components
import StatsOverview from '../components/home/StatsOverview';
import QuickPlayButtons from '../components/home/QuickPlayButtons';
import RecentActivity from '../components/home/RecentActivity';
import FeaturedTournament from '../components/home/FeaturedTournament';
import LeaderboardPreview from '../components/home/LeaderboardPreview';
import WelcomeModal from '../components/home/WelcomeModal';

// Icons
import {
  FaGamepad,
  FaTrophy,
  FaUsers,
  FaBolt,
  FaRobot,
  FaCrown,
  FaChartLine,
  FaFire,
  FaGift,
  FaMedal
} from 'react-icons/fa';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { stats, loadGameHistory } = useGame();
  const { isConnected } = useSocket();
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [dailyReward, setDailyReward] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [activeGames, setActiveGames] = useState(0);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load game history
        const games = await loadGameHistory();
        setRecentGames(games.slice(0, 5));
        
        // Check for daily reward
        checkDailyReward();
        
        // Check if first visit
        const firstVisit = !localStorage.getItem('hasVisited');
        if (firstVisit && isAuthenticated) {
          setShowWelcome(true);
          localStorage.setItem('hasVisited', 'true');
        }
        
        // Fetch online stats (mock for now)
        setOnlinePlayers(Math.floor(Math.random() * 1000) + 500);
        setActiveGames(Math.floor(Math.random() * 100) + 50);
        
      } catch (error) {
        console.error('Home page data loading error:', error);
      }
    };
    
    loadData();
    
    // Poll for updates
    const interval = setInterval(() => {
      setOnlinePlayers(prev => prev + Math.floor(Math.random() * 10) - 5);
      setActiveGames(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadGameHistory, isAuthenticated]);

  // Check daily reward
  const checkDailyReward = () => {
    const lastReward = localStorage.getItem('lastDailyReward');
    const today = new Date().toDateString();
    
    if (!lastReward || lastReward !== today) {
      setDailyReward({
        available: true,
        coins: 100,
        streak: parseInt(localStorage.getItem('dailyStreak') || '0') + 1
      });
    } else {
      setDailyReward({ available: false, streak: parseInt(localStorage.getItem('dailyStreak') || '0') });
    }
  };

  // Claim daily reward
  const claimDailyReward = () => {
    if (!dailyReward?.available) return;
    
    const coins = dailyReward.coins;
    const streak = dailyReward.streak;
    
    // Update coins in localStorage
    const currentCoins = parseInt(localStorage.getItem('coins') || '1500');
    localStorage.setItem('coins', (currentCoins + coins).toString());
    
    // Update streak
    localStorage.setItem('dailyStreak', streak.toString());
    localStorage.setItem('lastDailyReward', new Date().toDateString());
    
    // Show confetti
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
    
    // Show success message
    toast.success(
      <div>
        <div style={{ fontSize: '1.2em', marginBottom: '4px' }}>
          🎉 Kundalik sovrin: {coins} coins
        </div>
        <div style={{ fontSize: '0.9em', opacity: 0.8 }}>
          Ketma-ketlik: {streak} kun
        </div>
      </div>,
      { duration: 5000 }
    );
    
    // Update state
    setDailyReward({ ...dailyReward, available: false });
  };

  // Quick play actions
  const handleQuickPlay = (mode) => {
    if (!isConnected) {
      toast.error('Serverga ulanmagan');
      return;
    }
    
    switch (mode) {
      case 'quick':
        navigate('/play');
        break;
      case 'bot':
        navigate('/bot');
        break;
      case 'tournament':
        navigate('/tournaments');
        break;
      case 'friends':
        navigate('/friends');
        break;
    }
  };

  // Get user rank
  const getUserRank = () => {
    const elo = stats.elo || 1000;
    if (elo >= 2000) return { name: 'Grandmaster', icon: '👑' };
    if (elo >= 1800) return { name: 'Master', icon: '⭐' };
    if (elo >= 1600) return { name: 'Diamond', icon: '💎' };
    if (elo >= 1400) return { name: 'Platinum', icon: '⚪' };
    if (elo >= 1200) return { name: 'Gold', icon: '🥇' };
    if (elo >= 1000) return { name: 'Silver', icon: '🥈' };
    return { name: 'Bronze', icon: '🥉' };
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="home-page"
    >
      {/* Confetti for rewards */}
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          gravity={0.1}
        />
      )}

      {/* Welcome modal */}
      {showWelcome && user && (
        <WelcomeModal
          user={user}
          onClose={() => setShowWelcome(false)}
        />
      )}

      {/* Daily reward banner */}
      {dailyReward?.available && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="daily-reward-banner"
        >
          <div className="reward-content">
            <FaGift size={24} />
            <div className="reward-details">
              <h4>Kundalik sovrin {dailyReward.streak}. kun</h4>
              <p>{dailyReward.coins} coins kutmoqda!</p>
            </div>
            <button 
              className="btn-primary"
              onClick={claimDailyReward}
            >
              Olib olish
            </button>
          </div>
        </motion.div>
      )}

      <div className="home-container">
        {/* Hero section */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="hero-section"
        >
          <motion.div variants={itemVariants} className="hero-content">
            <h1 className="hero-title">
              Tosh-Qaychi-Qogʻoz
              <span className="hero-subtitle">Multiplayer</span>
            </h1>
            
            <p className="hero-description">
              Dunyoning har bir burchagidan raqiblar bilan bellashing. 
              Reyting koʻtaring, turnirlarda gʻalaba qozoning va doʻstlaringizni magʻlub eting!
            </p>
            
            <div className="hero-stats">
              <div className="stat-item">
                <FaUsers />
                <div>
                  <div className="stat-value">{onlinePlayers.toLocaleString()}</div>
                  <div className="stat-label">Online o'yinchilar</div>
                </div>
              </div>
              
              <div className="stat-item">
                <FaGamepad />
                <div>
                  <div className="stat-value">{activeGames}</div>
                  <div className="stat-label">Faol o'yinlar</div>
                </div>
              </div>
              
              <div className="stat-item">
                <FaTrophy />
                <div>
                  <div className="stat-value">24/7</div>
                  <div className="stat-label">Doimiy turnirlar</div>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div variants={itemVariants} className="hero-actions">
            <QuickPlayButtons
              onQuickPlay={() => handleQuickPlay('quick')}
              onBotGame={() => handleQuickPlay('bot')}
              onTournament={() => handleQuickPlay('tournament')}
              onFriends={() => handleQuickPlay('friends')}
              disabled={!isConnected}
            />
          </motion.div>
        </motion.section>

        {/* User stats section */}
        {isAuthenticated && (
          <motion.section
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="user-stats-section"
          >
            <div className="section-header">
              <h2>
                <FaChartLine /> Sizning statistikangiz
              </h2>
              <div className="user-rank">
                <span className="rank-icon">{getUserRank().icon}</span>
                <span className="rank-name">{getUserRank().name}</span>
              </div>
            </div>
            
            <StatsOverview
              stats={stats}
              user={user}
              dailyStreak={dailyReward?.streak || 0}
            />
          </motion.section>
        )}

        {/* Quick features grid */}
        <motion.section
          variants={containerVariants}
          className="features-section"
        >
          <div className="section-header">
            <h2>
              <FaBolt /> Tezkor kirish
            </h2>
          </div>
          
          <div className="features-grid">
            <motion.div variants={itemVariants} className="feature-card">
              <div className="feature-icon ranked">
                <FaCrown />
              </div>
              <h3>Reytingli o'yin</h3>
              <p>ELO reytingingizni oshiring va yuqori darajalarga erishing</p>
              <button 
                className="btn-outline"
                onClick={() => handleQuickPlay('quick')}
              >
                O'ynash
              </button>
            </motion.div>
            
            <motion.div variants={itemVariants} className="feature-card">
              <div className="feature-icon tournament">
                <FaTrophy />
              </div>
              <h3>Turnirlar</h3>
              <p>Katta sovrinlar uchun boshqa o'yinchilar bilan bellashing</p>
              <button 
                className="btn-outline"
                onClick={() => handleQuickPlay('tournament')}
              >
                Qatnashish
              </button>
            </motion.div>
            
            <motion.div variants={itemVariants} className="feature-card">
              <div className="feature-icon practice">
                <FaRobot />
              </div>
              <h3>Mashq qilish</h3>
              <p>Botlar bilan mashq qiling va strategiyalaringizni takomillashtiring</p>
              <button 
                className="btn-outline"
                onClick={() => handleQuickPlay('bot')}
              >
                Mashq qilish
              </button>
            </motion.div>
            
            <motion.div variants={itemVariants} className="feature-card">
              <div className="feature-icon social">
                <FaUsers />
              </div>
              <h3>Do'stlar bilan</h3>
              <p>Do'stlaringizni taklif qiling va birga o'ynang</p>
              <button 
                className="btn-outline"
                onClick={() => handleQuickPlay('friends')}
              >
                Do'st qo'shish
              </button>
            </motion.div>
          </div>
        </motion.section>

        {/* Recent activity and leaderboard */}
        <div className="bottom-section">
          <motion.div variants={itemVariants} className="recent-activity">
            <div className="section-header">
              <h2>
                <FaFire /> Oxirgi faollik
              </h2>
            </div>
            
            <RecentActivity
              games={recentGames}
              onViewAll={() => navigate('/profile?tab=history')}
            />
          </motion.div>
          
          <motion.div variants={itemVariants} className="leaderboard-preview">
            <div className="section-header">
              <h2>
                <FaMedal /> Reyting jadvali
              </h2>
            </div>
            
            <LeaderboardPreview
              onViewAll={() => navigate('/leaderboard')}
            />
          </motion.div>
        </div>

        {/* Featured tournament */}
        <motion.section variants={itemVariants} className="featured-section">
          <div className="section-header">
            <h2>
              <FaTrophy /> Taniqli turnir
            </h2>
          </div>
          
          <FeaturedTournament
            onJoin={() => handleQuickPlay('tournament')}
          />
        </motion.section>
      </div>
    </motion.div>
  );
};

export default HomePage;