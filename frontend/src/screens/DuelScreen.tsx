// frontend/src/screens/DuelScreen.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSocket } from '../utils/socket';

const DuelScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [timer, setTimer] = useState(20);
  const [selectedChoice, setSelectedChoice] = useState<'like' | 'super_like' | 'skip' | null>(null);
  const [opponentChoice, setOpponentChoice] = useState<'like' | 'super_like' | 'skip' | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  
  // Location dan kelgan ma'lumotlar
  const opponent = location.state?.opponent || {
    id: 'opponent-123',
    name: 'Alex',
    gender: 'male' as const,
    rating: 1520,
    level: 2,
    telegramUsername: 'alex_player' // Qo'shimcha ma'lumot
  };

  useEffect(() => {
    // Timer
    const timerInterval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Socket eventlar
    const socket = getSocket();
    if (socket) {
      socket.on('vote_result', (data) => {
        setOpponentChoice(data.opponentChoice);
        calculateResult(data.opponentChoice);
      });

      socket.on('match_result', (data) => {
        setResult(`${data.type} - ${data.rewards?.coins || 0} coins`);
      });
    }

    return () => {
      clearInterval(timerInterval);
      if (socket) {
        socket.off('vote_result');
        socket.off('match_result');
      }
    };
  }, []);

  const handleVote = (choice: 'like' | 'super_like' | 'skip') => {
    if (selectedChoice) return;
    
    setSelectedChoice(choice);
    
    const socket = getSocket();
    if (socket) {
      socket.emit('vote', {
        choice,
        timestamp: Date.now()
      });
    }
  };

  const calculateResult = (opponentChoice: 'like' | 'super_like' | 'skip') => {
    if (!selectedChoice) return;
    
    setTimeout(() => {
      if (selectedChoice === 'skip' || opponentChoice === 'skip') {
        setResult('No match - Both skipped or one skipped');
      } else if (selectedChoice === 'like' && opponentChoice === 'like') {
        setResult('Match! +50 coins');
      } else if (selectedChoice === 'super_like' && opponentChoice === 'super_like') {
        setResult('Mutual Super Like! +100 coins');
      } else if (selectedChoice === 'super_like' && opponentChoice === 'like') {
        setResult('Match! +50 coins');
      } else {
        setResult('No match - Different choices');
      }
    }, 1000);
  };

  const handleTimeout = () => {
    setSelectedChoice('skip');
    setResult('Timeout - No choice made');
  };

  const handleContinue = () => {
    navigate('/');
  };

  // Chat modalini ochish
  const handleChat = () => {
    setShowChatModal(true);
  };

  // Telegram chatga o'tish (faqat Telegram Mini App da ishlaydi)
  const handleTelegramChat = () => {
    if (window.Telegram && window.Telegram.WebApp) {
      // Telegram Mini App ichida ishlayotgan bo'lsa
      window.Telegram.WebApp.openTelegramLink(`https://t.me/${opponent.telegramUsername}`);
    } else {
      // Oddiy brauzerda ishlayotgan bo'lsa, yangi tab ochish
      window.open(`https://t.me/${opponent.telegramUsername || 'username_not_set'}`, '_blank');
    }
  };

  // In-app chat (simulyatsiya)
  const handleInAppChat = () => {
    alert(`Chat feature will be implemented soon!\nYou can chat with ${opponent.name} here.`);
    // Kelajakda: WebSocket orqali real-time chat
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-orange-50 p-4">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Duel ⚔️</h1>
          <div className="text-4xl font-bold text-red-600">
            {timer > 9 ? timer : `0${timer}`}
          </div>
          <p className="text-gray-600">seconds remaining</p>
        </header>

        {/* Opponent Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="text-center mb-4">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-4xl">
              {opponent.gender === 'male' ? '👨' : '👩'}
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{opponent.name}</h2>
            <p className="text-gray-600">Level {opponent.level}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Rating</p>
              <p className="text-xl font-bold text-blue-600">{opponent.rating} ⭐</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Gender</p>
              <p className="text-xl font-bold text-purple-600">
                {opponent.gender === 'male' ? 'Male' : 'Female'}
              </p>
            </div>
          </div>
          
          {opponentChoice && (
            <div className="mt-4 p-3 bg-gray-100 rounded-lg">
              <p className="font-bold text-gray-700">Opponent chose:</p>
              <p className="text-lg">
                {opponentChoice === 'like' && '👍 Like'}
                {opponentChoice === 'super_like' && '💖 Super Like'}
                {opponentChoice === 'skip' && '➡️ Skip'}
              </p>
            </div>
          )}
        </div>

        {/* Voting Buttons */}
        {!selectedChoice && timer > 0 && (
          <div className="space-y-4 mb-8">
            <div className="text-center mb-4">
              <p className="text-lg font-bold text-gray-700">Choose your reaction:</p>
            </div>
            
            <button
              onClick={() => handleVote('like')}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-5 rounded-xl text-xl font-bold hover:opacity-90 transition shadow-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">👍</span>
              Like (+50 coins if match)
            </button>
            
            <button
              onClick={() => handleVote('super_like')}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white py-5 rounded-xl text-xl font-bold hover:opacity-90 transition shadow-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">💖</span>
              Super Like (+100 coins if mutual)
            </button>
            
            <button
              onClick={() => handleVote('skip')}
              className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-5 rounded-xl text-xl font-bold hover:opacity-90 transition shadow-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">➡️</span>
              Skip (No match)
            </button>
          </div>
        )}

        {/* Selected Choice Display */}
        {selectedChoice && (
          <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Your Choice:</h3>
            <div className={`text-2xl font-bold p-4 rounded-lg ${
              selectedChoice === 'like' ? 'bg-green-100 text-green-700' :
              selectedChoice === 'super_like' ? 'bg-pink-100 text-pink-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {selectedChoice === 'like' && '👍 LIKE'}
              {selectedChoice === 'super_like' && '💖 SUPER LIKE'}
              {selectedChoice === 'skip' && '➡️ SKIP'}
            </div>
            <p className="text-gray-600 mt-2">
              Waiting for opponent's choice...
            </p>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Result 🎉</h3>
            <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
              <p className="text-3xl font-bold text-orange-600 mb-2">{result}</p>
              <p className="text-gray-600">
                {result.includes('Match') ? 'Congratulations!' : 
                 result.includes('Timeout') ? 'Time\'s up!' : 'Maybe next time!'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                onClick={handleChat}
                className="bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition"
              >
                💬 Chat
              </button>
              <button
                onClick={handleContinue}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-bold hover:opacity-90 transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="w-full bg-white text-gray-800 py-4 rounded-xl text-lg font-bold border-2 border-gray-200 hover:bg-gray-50 transition"
        >
          ← Back to Home
        </button>
      </div>

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Chat with {opponent.name}</h3>
            <p className="text-gray-600 mb-6">
              Choose how you want to chat:
            </p>
            
            <div className="space-y-4 mb-6">
              <button
                onClick={handleTelegramChat}
                className="w-full p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-left hover:opacity-90 transition flex items-center gap-3"
              >
                <div className="text-2xl">📱</div>
                <div>
                  <div className="font-bold">Telegram Chat</div>
                  <div className="text-sm text-blue-100">Open in Telegram app</div>
                </div>
              </button>
              
              <button
                onClick={handleInAppChat}
                className="w-full p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-left hover:opacity-90 transition flex items-center gap-3"
              >
                <div className="text-2xl">💬</div>
                <div>
                  <div className="font-bold">In-App Chat</div>
                  <div className="text-sm text-pink-100">Chat directly here</div>
                </div>
              </button>
              
              <button
                onClick={() => alert(`Rematch request sent to ${opponent.name}!`)}
                className="w-full p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-left hover:opacity-90 transition flex items-center gap-3"
              >
                <div className="text-2xl">🔄</div>
                <div>
                  <div className="font-bold">Request Rematch</div>
                  <div className="text-sm text-green-100">Play again with same opponent</div>
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setShowChatModal(false)}
              className="w-full py-3 text-gray-600 hover:text-gray-800 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuelScreen;