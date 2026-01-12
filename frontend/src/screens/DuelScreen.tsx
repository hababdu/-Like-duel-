import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { socketService } from '../utils/socket';
import { TELEGRAM, GAME } from '../utils/constants';
import './DuelScreen.css';

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
  const [animateTimer, setAnimateTimer] = useState(false);

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
    winRate: Math.round((12 / (12 + 8)) * 100)
  };

  useEffect(() => {
    // Timer animation for last 5 seconds
    if (timer <= 5 && timer > 0) {
      setAnimateTimer(true);
      const pulse = setInterval(() => {
        setAnimateTimer(prev => !prev);
      }, 500);
      return () => clearInterval(pulse);
    } else {
      setAnimateTimer(false);
    }
  }, [timer]);

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
    <div className="duel-screen">
      {/* Header */}
      <div className="duel-header">
        <h1 className="duel-title">
          <span className="title-icon">⚔️</span>
          Duel
        </h1>
        <div className="timer-section">
          <div className={`timer-circle ${animateTimer ? 'pulse' : ''} ${timer <= 5 ? 'warning' : ''}`}>
            <span className="timer-number">{timer > 9 ? timer : `0${timer}`}</span>
          </div>
          <p className="timer-label">seconds left</p>
        </div>
      </div>

      {/* Opponent Profile */}
      <div className="opponent-card">
        <div className="opponent-avatar-container">
          <div className="opponent-avatar">{opponent.avatar}</div>
          {opponent.online && <div className="online-badge"></div>}
        </div>
        
        <div className="opponent-info">
          <h2 className="opponent-name">{opponent.name}</h2>
          <div className="level-badge">
            <span className="level-icon">⭐</span>
            Level {opponent.level}
          </div>
        </div>
        
        <div className="opponent-stats">
          <div className="stat-item">
            <div className="stat-label">Rating</div>
            <div className="stat-value rating-value">{opponent.rating}</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-label">Win Rate</div>
            <div className="stat-value winrate-value">{opponent.winRate}%</div>
          </div>
        </div>
        
        {/* Opponent's Choice Display */}
        {opponentChoice && (
          <div className="opponent-choice-display">
            <p className="choice-label">Opponent chose:</p>
            <div className={`choice-badge ${opponentChoice}`}>
              {opponentChoice === 'like' && (
                <>
                  <span className="choice-icon">👍</span>
                  <span className="choice-text">Like</span>
                </>
              )}
              {opponentChoice === 'super_like' && (
                <>
                  <span className="choice-icon">💖</span>
                  <span className="choice-text">Super Like</span>
                </>
              )}
              {opponentChoice === 'skip' && (
                <>
                  <span className="choice-icon">➡️</span>
                  <span className="choice-text">Skip</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Voting Section */}
      {!selectedChoice && timer > 0 && (
        <div className="voting-section">
          <h3 className="voting-title">Choose your reaction:</h3>
          
          <div className="vote-options">
            <button
              className="vote-option like-option"
              onClick={() => handleVote('like')}
            >
              <div className="option-icon like-icon">👍</div>
              <div className="option-content">
                <div className="option-title">Like</div>
                <div className="option-subtitle">+50 coins if match</div>
              </div>
            </button>
            
            <button
              className="vote-option super-like-option"
              onClick={() => handleVote('super_like')}
            >
              <div className="option-icon super-like-icon">💖</div>
              <div className="option-content">
                <div className="option-title">Super Like</div>
                <div className="option-subtitle">+100 coins if mutual</div>
              </div>
            </button>
            
            <button
              className="vote-option skip-option"
              onClick={() => handleVote('skip')}
            >
              <div className="option-icon skip-icon">➡️</div>
              <div className="option-content">
                <div className="option-title">Skip</div>
                <div className="option-subtitle">No match</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Selected Choice Display */}
      {selectedChoice && !showResult && (
        <div className="selected-choice-display">
          <div className="selected-choice-content">
            <h3 className="choice-heading">Your Choice:</h3>
            <div className={`selected-choice-badge ${selectedChoice}`}>
              {selectedChoice === 'like' && (
                <>
                  <span className="choice-icon">👍</span>
                  <span className="choice-text">Like</span>
                </>
              )}
              {selectedChoice === 'super_like' && (
                <>
                  <span className="choice-icon">💖</span>
                  <span className="choice-text">Super Like</span>
                </>
              )}
              {selectedChoice === 'skip' && (
                <>
                  <span className="choice-icon">➡️</span>
                  <span className="choice-text">Skip</span>
                </>
              )}
            </div>
            <p className="waiting-text">
              {opponentChoice ? 'Calculating result...' : 'Waiting for opponent...'}
            </p>
            <div className="loading-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>
      )}

      {/* Result Display */}
      {showResult && matchResult && (
        <div className="result-overlay">
          <div className="result-modal">
            <div className="result-header">
              <div className={`result-icon ${matchResult.type}`}>
                {matchResult.type === 'match' ? '🎉' : 
                 matchResult.type === 'timeout' ? '⏰' : '😔'}
              </div>
              <h2 className="result-title">
                {matchResult.type === 'match' ? 'Match!' : 
                 matchResult.type === 'timeout' ? 'Time\'s Up!' : 'No Match'}
              </h2>
            </div>
            
            <p className="result-message">{matchResult.message}</p>
            
            {matchResult.reward && matchResult.reward > 0 && (
              <div className="reward-display">
                <div className="reward-icon">🪙</div>
                <div className="reward-amount">+{matchResult.reward}</div>
              </div>
            )}
            
            <div className="result-actions">
              <button 
                className="result-button continue-button"
                onClick={handleContinue}
              >
                Continue
              </button>
              <button 
                className="result-button rematch-button"
                onClick={handleRematch}
              >
                <span className="rematch-icon">⚔️</span>
                Rematch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="bottom-actions">
        <button 
          className="action-button back-button"
          onClick={() => navigate('/')}
        >
          <span className="back-icon">←</span>
          Back to Home
        </button>
        
        {showResult && (
          <button 
            className="action-button chat-button"
            onClick={() => navigate(`/chat/${opponent.name}`)}
          >
            <span className="chat-icon">💬</span>
            Chat with {opponent.name}
          </button>
        )}
      </div>
    </div>
  );
};

export default DuelScreen;