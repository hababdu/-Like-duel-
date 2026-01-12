import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../utils/socket';
import './QueueScreen.css';

const QueueScreen = () => {
  const navigate = useNavigate();
  
  // State
  const [position, setPosition] = useState<number>(1);
  const [waitTime, setWaitTime] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(15);
  const [playersOnline, setPlayersOnline] = useState<number>(245);
  const [queueStats, setQueueStats] = useState({
    averageWait: 12,
    matchesToday: 1542,
  });
  const [searchingAnimation, setSearchingAnimation] = useState<number>(0);

  useEffect(() => {
    // Join queue when component mounts
    socketService.getSocket()?.emit('join_queue');
    
    // Update wait time every second
    const timeInterval = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);

    // Searching animation
    const animationInterval = setInterval(() => {
      setSearchingAnimation(prev => (prev + 1) % 4);
    }, 300);

    // Socket listeners
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('queue_position', (data: { position: number }) => {
        setPosition(data.position);
        setEstimatedTime(Math.max(5, data.position * 2));
      });

      socket.on('online_count', (count: number) => {
        setPlayersOnline(count);
      });

      socket.on('duel_found', (data: any) => {
        navigate('/duel', { state: { opponent: data.opponent } });
      });

      socket.on('queue_stats', (stats: any) => {
        setQueueStats(stats);
      });
    }

    // Cleanup on unmount
    return () => {
      clearInterval(timeInterval);
      clearInterval(animationInterval);
      socketService.getSocket()?.emit('leave_queue');
    };
  }, [navigate]);

  const handleLeaveQueue = () => {
    socketService.getSocket()?.emit('leave_queue');
    navigate('/');
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const searchingTexts = [
    'Searching for opponent...',
    'Checking nearby players...',
    'Analyzing skill level...',
    'Finding perfect match...'
  ];

  const getQueueStatus = () => {
    if (position === 1) return 'You\'re next!';
    if (position <= 3) return `Moving up! ${position-1} player${position > 2 ? 's' : ''} ahead`;
    if (position <= 10) return `Position ${position} in queue`;
    return `In queue... Position ${position}`;
  };

  return (
    <div className="queue-screen">
      {/* Header */}
      <div className="queue-header">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          <span className="back-icon">←</span>
          <span className="back-text">Back</span>
        </button>
        <h1 className="queue-title">
          <span className="title-icon">⚔️</span>
          Find Match
        </h1>
        <div className="header-right"></div>
      </div>

      {/* Main Content */}
      <div className="queue-content">
        {/* Searching Animation */}
        <div className="searching-section">
          <div className="searching-animation">
            <div className="pulse-ring ring-1"></div>
            <div className="pulse-ring ring-2"></div>
            <div className="pulse-ring ring-3"></div>
            <div className="search-icon">
              <span className="search-emoji">🔍</span>
            </div>
          </div>
          <h2 className="searching-title">Finding Opponent</h2>
          <p className="searching-subtitle">
            <span className="searching-text">{searchingTexts[searchingAnimation]}</span>
            <span className="searching-dots">...</span>
          </p>
        </div>

        {/* Queue Position Card */}
        <div className="position-card">
          <div className="position-number">#{position}</div>
          <div className="position-label">Position in Queue</div>
          <div className="position-status">{getQueueStatus()}</div>
        </div>

        {/* Time Stats */}
        <div className="time-stats">
          <div className="time-stat">
            <div className="time-icon">⏱️</div>
            <div className="time-content">
              <div className="time-value">{formatTime(waitTime)}</div>
              <div className="time-label">Wait Time</div>
            </div>
          </div>
          <div className="time-divider"></div>
          <div className="time-stat">
            <div className="time-icon">🎯</div>
            <div className="time-content">
              <div className="time-value">{estimatedTime}s</div>
              <div className="time-label">Estimated</div>
            </div>
          </div>
        </div>

        {/* Queue Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{playersOnline}+</div>
              <div className="stat-label">Online Players</div>
            </div>
            <div className="stat-trend up">↑</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-content">
              <div className="stat-value">{queueStats.averageWait}s</div>
              <div className="stat-label">Avg Wait Time</div>
            </div>
            <div className="stat-trend down">↓</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-content">
              <div className="stat-value">{queueStats.matchesToday}</div>
              <div className="stat-label">Matches Today</div>
            </div>
            <div className="stat-trend up">↑</div>
          </div>
        </div>

        {/* Tips Card */}
        <div className="tips-card">
          <div className="tips-header">
            <span className="tips-icon">💡</span>
            <h3 className="tips-title">Quick Tips</h3>
          </div>
          <ul className="tips-list">
            <li className="tip-item">
              <span className="tip-bullet">✓</span>
              <span className="tip-text">Match usually found in 10-30 seconds</span>
            </li>
            <li className="tip-item">
              <span className="tip-bullet">✓</span>
              <span className="tip-text">Higher rating = slightly longer waits</span>
            </li>
            <li className="tip-item">
              <span className="tip-bullet">✓</span>
              <span className="tip-text">Peak hours: 6PM - 11PM</span>
            </li>
            <li className="tip-item">
              <span className="tip-bullet">✓</span>
              <span className="tip-text">Stay online for faster matches</span>
            </li>
          </ul>
        </div>

        {/* Live Queue Updates */}
        <div className="live-updates">
          <div className="update-header">
            <span className="update-icon">📡</span>
            <span className="update-title">Live Updates</span>
          </div>
          <div className="update-message">
            <span className="message-icon">🎯</span>
            <span className="message-text">
              {position > 1 
                ? `Found ${Math.floor(Math.random() * 3) + 1} possible opponents`
                : 'Perfect match found!'}
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${Math.min(100, (position / 10) * 100)}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className="action-button leave-button"
            onClick={handleLeaveQueue}
          >
            <span className="button-icon">←</span>
            <span className="button-text">Leave Queue</span>
          </button>
          
          <button 
            className="action-button practice-button"
            onClick={() => navigate('/practice')}
          >
            <span className="button-icon">🎯</span>
            <span className="button-text">Practice Mode</span>
          </button>
        </div>

        {/* Queue Stats Summary */}
        <div className="queue-summary">
          <div className="summary-item">
            <span className="summary-icon">📊</span>
            <span className="summary-text">
              <span className="summary-value">{Math.floor(playersOnline / 2)}</span>
              <span className="summary-label"> active duels</span>
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-icon">⚡</span>
            <span className="summary-text">
              <span className="summary-value">96%</span>
              <span className="summary-label"> match rate</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueScreen;