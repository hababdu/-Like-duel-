import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../utils/socket';

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
    <div className="min-h-screen bg-gradient-to-b from-telegram-brand/10 via-white to-purple-50/50 p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Finding Opponent ⏳</h1>
        <p className="text-gray-600">Please wait while we match you...</p>
      </div>

      {/* Animation */}
      <div className="relative flex items-center justify-center mb-10">
        <div className="absolute w-48 h-48 border-4 border-blue-300 rounded-full animate-pulse-ring"></div>
        <div className="absolute w-48 h-48 border-4 border-blue-300 rounded-full animate-pulse-ring animation-delay-1000"></div>
        <div className="absolute w-48 h-48 border-4 border-blue-300 rounded-full animate-pulse-ring animation-delay-2000"></div>
        <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-3xl">
          🔍
        </div>
      </div>

      {/* Queue Info */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-200">
        <div className="text-center mb-6">
          <div className="text-5xl font-bold text-blue-600 mb-2">#{position}</div>
          <div className="text-gray-600">Position in queue</div>
        </div>
        
        <div className="flex justify-between">
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Wait Time</div>
            <div className="text-2xl font-bold text-gray-800">{formatTime(waitTime)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-1">Estimated</div>
            <div className="text-2xl font-bold text-gray-800">{estimatedTime}s</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl mb-2">👥</div>
          <div className="text-lg font-bold text-gray-800">{playersOnline}+</div>
          <div className="text-xs text-gray-600">Players Online</div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-lg font-bold text-gray-800">{queueStats.averageWait}s</div>
          <div className="text-xs text-gray-600">Avg Wait Time</div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl mb-2">🏆</div>
          <div className="text-lg font-bold text-gray-800">{queueStats.matchesToday}</div>
          <div className="text-xs text-gray-600">Matches Today</div>
        </div>
      </div>

      {/* Queue Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5 mb-6 border border-blue-100">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
          <span className="text-2xl mr-2">💡</span>
          Quick Tips
        </h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-center">
            <span className="mr-2">•</span>
            Match usually found in 10-30 seconds
          </li>
          <li className="flex items-center">
            <span className="mr-2">•</span>
            Higher rating = slightly longer waits
          </li>
          <li className="flex items-center">
            <span className="mr-2">•</span>
            Peak hours: 6PM - 11PM
          </li>
          <li className="flex items-center">
            <span className="mr-2">•</span>
            Stay online for faster matches
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col space-y-3">
        <button 
          className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
          onClick={handleLeaveQueue}
        >
          ← Leave Queue
        </button>
        
        <button 
          className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:opacity-90 transition"
          onClick={() => navigate('/practice')}
        >
          🎯 Practice Mode
        </button>
      </div>

      {/* Live Queue Updates */}
      <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
        <div className="flex items-center">
          <span className="text-2xl mr-3">🔔</span>
          <span className="text-gray-700">
            {position > 1 
              ? `Moving up! ${position-1} players ahead of you` 
              : 'You\'re next!'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default QueueScreen;