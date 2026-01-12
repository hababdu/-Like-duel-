import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { socketService } from '../utils/socket';
import { TELEGRAM, GAME } from '../utils/constants';

const DuelScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [timer, setTimer] = useState(GAME.MAX_TIMER);
  const [selectedChoice, setSelectedChoice] = useState<'like' | 'super_like' | 'skip' | null>(null);
  const [opponentChoice, setOpponentChoice] = useState<'like' | 'super_like' | 'skip' | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    type: 'match' | 'no_match' | 'timeout';
    message: string;
    reward?: number;
  } | null>(null);

  // Opponent data from navigation or socket
  const opponent = location.state?.opponent || {
    id: 'opponent-123',
    name: 'Alex',
    rating: 1520,
    level: 5,
    gender: 'male',
    avatar: '👨',
    wins: 12,
    losses: 8,
    online: true,
  };

  useEffect(() => {
    // Timer countdown
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

    // Socket listeners
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('opponent_vote', (data: { choice: 'like' | 'super_like' | 'skip' }) => {
        setOpponentChoice(data.choice);
        if (selectedChoice) {
          calculateResult(selectedChoice, data.choice);
        }
      });

      socket.on('duel_result', (result: any) => {
        setMatchResult({
          type: result.type,
          message: result.message,
          reward: result.reward,
        });
        setShowResult(true);
      });
    }

    return () => {
      clearInterval(timerInterval);
      if (socket) {
        socket.off('opponent_vote');
        socket.off('duel_result');
      }
    };
  }, [selectedChoice]);

  const handleVote = (choice: 'like' | 'super_like' | 'skip') => {
    if (selectedChoice || timer === 0) return;
    
    setSelectedChoice(choice);
    
    // Send vote to server
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('player_vote', { choice });
    }
    
    // If opponent already voted, calculate result
    if (opponentChoice) {
      calculateResult(choice, opponentChoice);
    }
  };

  const calculateResult = (playerChoice: 'like' | 'super_like' | 'skip', opponentChoice: 'like' | 'super_like' | 'skip') => {
    let result: typeof matchResult;
    
    if (playerChoice === 'skip' || opponentChoice === 'skip') {
      result = {
        type: 'no_match',
        message: 'No match - Someone skipped',
        reward: 0,
      };
    } else if (playerChoice === 'like' && opponentChoice === 'like') {
      result = {
        type: 'match',
        message: 'Match! +50 coins',
        reward: GAME.LIKE_REWARD,
      };
    } else if (playerChoice === 'super_like' && opponentChoice === 'super_like') {
      result = {
        type: 'match',
        message: 'Super Match! +100 coins',
        reward: GAME.SUPER_LIKE_REWARD,
      };
    } else if (playerChoice === 'super_like' && opponentChoice === 'like') {
      result = {
        type: 'match',
        message: 'Match! +50 coins',
        reward: GAME.LIKE_REWARD,
      };
    } else {
      result = {
        type: 'no_match',
        message: 'No match - Different choices',
        reward: 0,
      };
    }
    
    setTimeout(() => {
      setMatchResult(result);
      setShowResult(true);
    }, 1500);
  };

  const handleTimeout = () => {
    setSelectedChoice('skip');
    setMatchResult({
      type: 'timeout',
      message: 'Time\'s up! No choice made',
      reward: 0,
    });
    setShowResult(true);
  };

  const handleContinue = () => {
    navigate('/match-result', { state: { result: matchResult, opponent } });
  };

  const handleRematch = () => {
    // Request rematch
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('request_rematch', { opponentId: opponent.id });
    }
    navigate('/queue');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-telegram-brand/10 via-white to-purple-50/50 p-4">
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Duel ⚔️</h1>
        <div className="flex flex-col items-center">
          <div className={`w-20 h-20 rounded-full border-4 ${timer <= 5 ? 'border-red-500' : 'border-blue-500'} flex items-center justify-center mb-1`}>
            <span className="text-2xl font-bold">{timer > 9 ? timer : `0${timer}`}</span>
          </div>
          <p className="text-sm text-gray-600">seconds left</p>
        </div>
      </div>

      {/* Opponent Profile */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-200">
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-3xl">
              {opponent.avatar}
            </div>
            {opponent.online && (
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
            )}
          </div>
        </div>
        
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{opponent.name}</h2>
          <div className="inline-block px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-sm font-semibold rounded-full mt-1">
            Level {opponent.level}
          </div>
        </div>
        
        <div className="flex justify-around mb-4">
          <div className="text-center">
            <div className="text-sm text-gray-600">Rating</div>
            <div className="text-xl font-bold text-yellow-600">
              {opponent.rating}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Win Rate</div>
            <div className="text-xl font-bold text-green-600">
              {Math.round((opponent.wins / (opponent.wins + opponent.losses)) * 100)}%
            </div>
          </div>
        </div>
        
        {/* Opponent's Choice Display */}
        {opponentChoice && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-gray-600 mb-2">Opponent chose:</p>
            <div className={`inline-block px-4 py-2 rounded-lg font-semibold ${
              opponentChoice === 'like' ? 'bg-blue-100 text-blue-700' :
              opponentChoice === 'super_like' ? 'bg-pink-100 text-pink-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {opponentChoice === 'like' && '👍 Like'}
              {opponentChoice === 'super_like' && '💖 Super Like'}
              {opponentChoice === 'skip' && '➡️ Skip'}
            </div>
          </div>
        )}
      </div>

      {/* Voting Section */}
      {!selectedChoice && timer > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">Choose your reaction:</h3>
          
          <div className="space-y-4">
            <button
              className="w-full flex items-center p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleVote('like')}
            >
              <div className="text-3xl mr-4">👍</div>
              <div className="text-left flex-1">
                <div className="font-bold text-blue-700">Like</div>
                <div className="text-sm text-blue-600">+50 coins if match</div>
              </div>
            </button>
            
            <button
              className="w-full flex items-center p-4 bg-pink-50 hover:bg-pink-100 border-2 border-pink-200 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleVote('super_like')}
            >
              <div className="text-3xl mr-4">💖</div>
              <div className="text-left flex-1">
                <div className="font-bold text-pink-700">Super Like</div>
                <div className="text-sm text-pink-600">+100 coins if mutual</div>
              </div>
            </button>
            
            <button
              className="w-full flex items-center p-4 bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleVote('skip')}
            >
              <div className="text-3xl mr-4">➡️</div>
              <div className="text-left flex-1">
                <div className="font-bold text-gray-700">Skip</div>
                <div className="text-sm text-gray-600">No match</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Selected Choice Display */}
      {selectedChoice && !showResult && (
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border border-gray-200 text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Your Choice:</h3>
          <div className={`inline-block px-6 py-3 rounded-xl text-lg font-bold mb-4 ${
            selectedChoice === 'like' ? 'bg-blue-100 text-blue-700' :
            selectedChoice === 'super_like' ? 'bg-pink-100 text-pink-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {selectedChoice === 'like' && '👍 Like'}
            {selectedChoice === 'super_like' && '💖 Super Like'}
            {selectedChoice === 'skip' && '➡️ Skip'}
          </div>
          <p className="text-gray-600 animate-pulse">
            {opponentChoice ? 'Calculating result...' : 'Waiting for opponent...'}
          </p>
        </div>
      )}

      {/* Result Display */}
      {showResult && matchResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full border border-gray-200">
            <h2 className="text-3xl font-bold text-center mb-4">
              {matchResult.type === 'match' ? '🎉 Match!' : 
               matchResult.type === 'timeout' ? '⏰ Time\'s Up!' : '😔 No Match'}
            </h2>
            
            <p className="text-gray-700 text-center mb-6">{matchResult.message}</p>
            
            {matchResult.reward && matchResult.reward > 0 && (
              <div className="flex items-center justify-center mb-6">
                <div className="text-4xl mr-2">🪙</div>
                <div className="text-3xl font-bold text-yellow-600">+{matchResult.reward}</div>
              </div>
            )}
            
            <div className="space-y-3">
              <button 
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:opacity-90 transition"
                onClick={handleContinue}
              >
                Continue
              </button>
              <button 
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition"
                onClick={handleRematch}
              >
                Rematch ⚔️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="flex flex-col space-y-3">
        <button 
          className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
          onClick={() => navigate('/')}
        >
          ← Back to Home
        </button>
        
        {showResult && (
          <button 
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-telegram-brand text-white font-bold rounded-xl hover:opacity-90 transition"
            onClick={() => navigate(`/chat/${opponent.name}`)}
          >
            💬 Chat with {opponent.name}
          </button>
        )}
      </div>
    </div>
  );
};

export default DuelScreen;