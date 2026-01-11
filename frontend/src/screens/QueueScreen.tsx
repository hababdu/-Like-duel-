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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Finding Opponent 🔍</h1>
          <p className="text-gray-600">Please wait while we match you</p>
        </header>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          {/* Animation */}
          <div className="flex justify-center mb-8">
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping"></div>
              <div className="absolute inset-4 border-4 border-blue-300 rounded-full animate-pulse"></div>
              <div className="absolute inset-8 border-4 border-blue-400 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl">⚔️</span>
              </div>
            </div>
          </div>

          {/* Queue Info */}
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-blue-600 mb-2">{position}</div>
            <p className="text-gray-600">Position in queue</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">⏱️ Wait Time</span>
              <span className="font-bold">{waitTime}s</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">👥 Players Online</span>
              <span className="font-bold">{position + 15}+</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleLeaveQueue}
            className="w-full bg-white text-red-600 py-4 rounded-xl text-lg font-bold border-2 border-red-200 hover:bg-red-50 transition"
          >
            ← Leave Queue
          </button>
          
          <div className="text-center text-gray-500 text-sm">
            <p>Average match time: 10-30 seconds</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueScreen;