import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../utils/socket';
import { TELEGRAM } from '../utils/constants';

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

  useEffect(() => {
    // Join queue when component mounts
    socketService.getSocket()?.emit('join_queue');
    
    // Update wait time every second
    const timeInterval = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);

    // Socket listeners
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('queue_position', (data: { position: number }) => {
        setPosition(data.position);
        setEstimatedTime(Math.max(5, data.position * 2)); // Estimate 2 seconds per position
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

  return (
    <div className="telegram-screen queue-screen">
      {/* Header */}
      <div className="queue-header">
        <h1 className="queue-title">Finding Opponent ⏳</h1>
        <p className="queue-subtitle">Please wait while we match you...</p>
      </div>

      {/* Animation */}
      <div className="queue-animation">
        <div className="pulse-ring"></div>
        <div className="pulse-ring delay-1"></div>
        <div className="pulse-ring delay-2"></div>
        <div className="search-icon">🔍</div>
      </div>

      {/* Queue Info */}
      <div className="queue-info-card">
        <div className="position-display">
          <div className="position-number">#{position}</div>
          <div className="position-label">Position in queue</div>
        </div>
        
        <div className="wait-time-display">
          <div className="time-elapsed">
            <div className="time-label">Wait Time</div>
            <div className="time-value">{formatTime(waitTime)}</div>
          </div>
          <div className="estimated-time">
            <div className="time-label">Estimated</div>
            <div className="time-value">{estimatedTime}s</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="queue-stats">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{playersOnline}+</div>
            <div className="stat-label">Players Online</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-value">{queueStats.averageWait}s</div>
            <div className="stat-label">Avg Wait Time</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <div className="stat-value">{queueStats.matchesToday}</div>
            <div className="stat-label">Matches Today</div>
          </div>
        </div>
      </div>

      {/* Queue Tips */}
      <div className="queue-tips">
        <h3 className="tips-title">💡 Quick Tips</h3>
        <ul className="tips-list">
          <li>• Match usually found in 10-30 seconds</li>
          <li>• Higher rating = slightly longer waits</li>
          <li>• Peak hours: 6PM - 11PM</li>
          <li>• Stay online for faster matches</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="queue-actions">
        <button 
          className="leave-button"
          onClick={handleLeaveQueue}
        >
          ← Leave Queue
        </button>
        
        <button 
          className="practice-button"
          onClick={() => navigate('/practice')}
          style={{ background: TELEGRAM.BG_TERTIARY }}
        >
          🎯 Practice Mode
        </button>
      </div>

      {/* Live Queue Updates */}
      <div className="live-updates">
        <div className="update-item">
          <span className="update-icon">🔔</span>
          <span className="update-text">
            {position > 1 ? `Moving up! ${position-1} players ahead of you` : 'You\'re next!'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default QueueScreen;