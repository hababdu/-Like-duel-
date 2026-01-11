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
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-red-50 to-orange-50 p-4">
      <div className="max-w-md mx-auto py-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800 mb-4 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            Duel
          </h1>
          <div className="inline-block p-6 bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border-4 border-red-200">
            <div className="text-6xl font-black bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent mb-2">
              {timer > 9 ? timer : `0${timer}`}
            </div>
            <p className="text-gray-600 font-semibold uppercase tracking-wider text-xs">seconds remaining</p>
          </div>
        </header>

        {/* Enhanced Opponent Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8 border border-white/20 transform transition-all hover:scale-[1.01]">
          <div className="text-center mb-6">
            <div className="relative inline-block mb-4">
              <div className="w-32 h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-full mx-auto flex items-center justify-center text-white text-5xl shadow-2xl ring-4 ring-white/50">
                {opponent.gender === 'male' ? '👨' : '👩'}
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg"></div>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">{opponent.name}</h2>
            <div className="inline-block px-4 py-1 bg-purple-100 rounded-full">
              <p className="text-sm font-semibold text-purple-700">Level {opponent.level}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-2xl border border-blue-200/50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Rating</p>
              <div className="flex items-center gap-1">
                <p className="text-2xl font-bold text-blue-600">{opponent.rating}</p>
                <span className="text-lg">⭐</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-purple-100/50 p-4 rounded-2xl border border-pink-200/50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Gender</p>
              <p className="text-2xl font-bold text-pink-600">
                {opponent.gender === 'male' ? '👨 Male' : '👩 Female'}
              </p>
            </div>
          </div>
          
          {opponentChoice && (
            <div className="mt-4 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl border-2 border-cyan-300/50 shadow-md">
              <p className="font-bold text-gray-700 mb-2 text-sm uppercase tracking-wide">Opponent chose:</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {opponentChoice === 'like' && '👍'}
                  {opponentChoice === 'super_like' && '💖'}
                  {opponentChoice === 'skip' && '➡️'}
                </span>
                <p className="text-xl font-bold text-cyan-700">
                  {opponentChoice === 'like' && 'Like'}
                  {opponentChoice === 'super_like' && 'Super Like'}
                  {opponentChoice === 'skip' && 'Skip'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Voting Buttons */}
        {!selectedChoice && timer > 0 && (
          <div className="space-y-4 mb-8">
            <div className="text-center mb-6">
              <p className="text-xl font-bold text-gray-800 mb-1">Choose your reaction:</p>
              <p className="text-sm text-gray-500">Make your decision quickly!</p>
            </div>
            
            <button
              onClick={() => handleVote('like')}
              className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 text-white py-6 rounded-2xl text-lg font-bold hover:from-green-600 hover:via-emerald-600 hover:to-green-700 transition-all duration-200 shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98] border-2 border-green-400/30"
            >
              <span className="text-3xl">👍</span>
              <div className="text-left">
                <div className="font-bold">Like</div>
                <div className="text-xs text-green-100">+50 coins if match</div>
              </div>
            </button>
            
            <button
              onClick={() => handleVote('super_like')}
              className="w-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white py-6 rounded-2xl text-lg font-bold hover:from-pink-600 hover:via-rose-600 hover:to-pink-700 transition-all duration-200 shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98] border-2 border-pink-400/30"
            >
              <span className="text-3xl">💖</span>
              <div className="text-left">
                <div className="font-bold">Super Like</div>
                <div className="text-xs text-pink-100">+100 coins if mutual</div>
              </div>
            </button>
            
            <button
              onClick={() => handleVote('skip')}
              className="w-full bg-gradient-to-r from-gray-500 via-gray-600 to-gray-700 text-white py-6 rounded-2xl text-lg font-bold hover:from-gray-600 hover:via-gray-700 hover:to-gray-800 transition-all duration-200 shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98] border-2 border-gray-400/30"
            >
              <span className="text-3xl">➡️</span>
              <div className="text-left">
                <div className="font-bold">Skip</div>
                <div className="text-xs text-gray-300">No match</div>
              </div>
            </button>
          </div>
        )}

        {/* Enhanced Selected Choice Display */}
        {selectedChoice && (
          <div className="bg-white/95 backdrop-blur-sm p-6 rounded-3xl shadow-2xl mb-8 border border-white/20">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Your Choice:</h3>
            <div className={`text-3xl font-black p-6 rounded-2xl border-2 ${
              selectedChoice === 'like' ? 'bg-gradient-to-br from-green-100 to-emerald-100 text-green-700 border-green-300' :
              selectedChoice === 'super_like' ? 'bg-gradient-to-br from-pink-100 to-rose-100 text-pink-700 border-pink-300' :
              'bg-gradient-to-br from-gray-100 to-slate-100 text-gray-700 border-gray-300'
            }`}>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl">
                  {selectedChoice === 'like' && '👍'}
                  {selectedChoice === 'super_like' && '💖'}
                  {selectedChoice === 'skip' && '➡️'}
                </span>
                <span>
                  {selectedChoice === 'like' && 'LIKE'}
                  {selectedChoice === 'super_like' && 'SUPER LIKE'}
                  {selectedChoice === 'skip' && 'SKIP'}
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <p className="text-gray-600 font-medium">
                Waiting for opponent's choice...
              </p>
            </div>
          </div>
        )}

        {/* Enhanced Result Display */}
        {result && (
          <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl mb-8 border border-white/20">
            <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Result 🎉</h3>
            <div className="text-center p-6 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl border-2 border-amber-200/50 shadow-lg mb-6">
              <p className="text-4xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-3">{result}</p>
              <p className="text-gray-700 font-semibold">
                {result.includes('Match') ? '🎊 Congratulations!' : 
                 result.includes('Timeout') ? '⏰ Time\'s up!' : '💪 Maybe next time!'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleChat}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-2xl font-bold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span className="text-xl">💬</span>
                <span>Chat</span>
              </button>
              <button
                onClick={handleContinue}
                className="bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white py-4 rounded-2xl font-bold hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Back Button */}
        <button
          onClick={() => navigate('/')}
          className="w-full bg-white/90 backdrop-blur-sm text-gray-800 py-4 rounded-2xl text-lg font-bold border-2 border-gray-200 hover:bg-white hover:border-purple-300 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>←</span>
          <span>Back to Home</span>
        </button>
      </div>

      {/* Enhanced Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowChatModal(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 transform transition-all scale-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-3xl font-bold text-gray-800 mb-2 text-center">Chat with {opponent.name}</h3>
            <p className="text-gray-600 mb-8 text-center">
              Choose how you want to chat:
            </p>
            
            <div className="space-y-4 mb-6">
              <button
                onClick={handleTelegramChat}
                className="w-full p-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl text-left hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-4 transform hover:scale-[1.02] active:scale-[0.98] border-2 border-blue-400/30"
              >
                <div className="text-3xl">📱</div>
                <div>
                  <div className="font-bold text-lg">Telegram Chat</div>
                  <div className="text-sm text-blue-100">Open in Telegram app</div>
                </div>
              </button>
              
              <button
                onClick={handleInAppChat}
                className="w-full p-5 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white rounded-2xl text-left hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-4 transform hover:scale-[1.02] active:scale-[0.98] border-2 border-pink-400/30"
              >
                <div className="text-3xl">💬</div>
                <div>
                  <div className="font-bold text-lg">In-App Chat</div>
                  <div className="text-sm text-pink-100">Chat directly here</div>
                </div>
              </button>
              
              <button
                onClick={() => alert(`Rematch request sent to ${opponent.name}!`)}
                className="w-full p-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl text-left hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-4 transform hover:scale-[1.02] active:scale-[0.98] border-2 border-green-400/30"
              >
                <div className="text-3xl">🔄</div>
                <div>
                  <div className="font-bold text-lg">Request Rematch</div>
                  <div className="text-sm text-green-100">Play again with same opponent</div>
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setShowChatModal(false)}
              className="w-full py-4 text-gray-600 hover:text-gray-800 font-medium transition-colors rounded-xl hover:bg-gray-100"
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