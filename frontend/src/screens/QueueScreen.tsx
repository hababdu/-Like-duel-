// frontend/src/screens/QueueScreen.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../utils/socket';

const QueueScreen = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState(1);
  const [waitTime, setWaitTime] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    
    // Queue statusini yangilash
    const interval = setInterval(() => {
      setWaitTime(prev => prev + 1);
      // Random position update (test uchun)
      if (Math.random() > 0.7) {
        setPosition(prev => Math.max(1, prev - 1));
      }
    }, 1000);
    
    // Socket eventlar
    if (socket) {
      socket.on('duel_started', (data) => {
        console.log('Duel started!', data);
        navigate('/duel', { state: data });
      });
      
      socket.on('queue_update', (data) => {
        setPosition(data.position);
      });
    }
    
    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('duel_started');
        socket.off('queue_update');
      }
    };
  }, [navigate]);

  const handleLeaveQueue = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('leave_queue');
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-emerald-50 p-4">
      <div className="max-w-md mx-auto py-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800 mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Finding Opponent
          </h1>
          <p className="text-gray-600 font-medium">Please wait while we match you</p>
        </header>

        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-6 border border-white/20">
          {/* Enhanced Animation */}
          <div className="flex justify-center mb-10">
            <div className="relative w-48 h-48">
              <div className="absolute inset-0 border-4 border-cyan-300/50 rounded-full animate-ping"></div>
              <div className="absolute inset-2 border-4 border-blue-400/70 rounded-full animate-pulse"></div>
              <div className="absolute inset-6 border-4 border-cyan-500 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full shadow-xl">
                <span className="text-6xl animate-bounce">⚔️</span>
              </div>
            </div>
          </div>

          {/* Queue Info with better design */}
          <div className="text-center mb-10">
            <div className="inline-block">
              <div className="text-7xl font-black bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent mb-3 drop-shadow-lg">
                #{position}
              </div>
              <p className="text-gray-600 font-semibold uppercase tracking-wider text-sm">Position in queue</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl border border-cyan-200/50 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏱️</span>
                <span className="text-gray-700 font-semibold">Wait Time</span>
              </div>
              <span className="font-bold text-xl text-cyan-600">{waitTime}s</span>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200/50 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👥</span>
                <span className="text-gray-700 font-semibold">Players Online</span>
              </div>
              <span className="font-bold text-xl text-emerald-600">{position + 15}+</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleLeaveQueue}
            className="w-full bg-white/90 backdrop-blur-sm text-red-600 py-5 rounded-2xl text-lg font-bold border-2 border-red-200 hover:bg-red-50 hover:border-red-400 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>←</span>
            <span>Leave Queue</span>
          </button>
          
          <div className="text-center p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200/50">
            <p className="text-gray-600 text-sm font-medium">
              <span className="font-semibold text-gray-700">Average match time:</span> 10-30 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueScreen;