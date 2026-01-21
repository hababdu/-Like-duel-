// src/components/game/GameBoard.jsx
import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { motion } from 'framer-motion';

const CHOICES = {
  rock: { emoji: '✊', name: 'Tosh', beats: 'scissors' },
  paper: { emoji: '✋', name: 'Qog‘oz', beats: 'rock' },
  scissors: { emoji: '✌️', name: 'Qaychi', beats: 'paper' }
};

const GameBoard = ({ game }) => {
  const { makeChoice, currentGame } = useGame();
  
  const [playerChoice, setPlayerChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [timer, setTimer] = useState(30);
  const [gameState, setGameState] = useState('waiting'); // waiting, choosing, result, finished
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState({ player: 0, opponent: 0 });

  useEffect(() => {
    // Taymer
    if (gameState === 'choosing' && timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      
      return () => clearInterval(interval);
    } else if (timer === 0) {
      handleTimeout();
    }
  }, [gameState, timer]);

  // Serverdan yangiliklarni kuzatish
  useEffect(() => {
    if (currentGame?.roundResults) {
      const lastResult = currentGame.roundResults[currentGame.roundResults.length - 1];
      if (lastResult) {
        handleRoundResult(lastResult);
      }
    }
  }, [currentGame]);

  const handleChoice = async (choice) => {
    if (gameState !== 'choosing') return;
    
    setPlayerChoice(choice);
    setGameState('waiting_for_opponent');
    
    try {
      await makeChoice(game.gameId, choice, round);
    } catch (error) {
      console.error('Choice error:', error);
      setPlayerChoice(null);
      setGameState('choosing');
    }
  };

  const handleRoundResult = (result) => {
    setOpponentChoice(result.player2Choice);
    setRoundResult(result.result);
    
    // Hisobni yangilash
    if (result.result === 'player1_win') {
      setScores(prev => ({ ...prev, player: prev.player + 1 }));
    } else if (result.result === 'player2_win') {
      setScores(prev => ({ ...prev, opponent: prev.opponent + 1 }));
    }
    
    setGameState('result');
    
    // 3 soniyadan keyin keyingi raund
    setTimeout(() => {
      if (round < 3) {
        nextRound();
      } else {
        finishGame();
      }
    }, 3000);
  };

  const handleTimeout = () => {
    if (!playerChoice) {
      // Tanlov qilmagan, o'yinni yo'qotdi
      setRoundResult('timeout');
      setScores(prev => ({ ...prev, opponent: prev.opponent + 1 }));
    }
    
    setGameState('result');
    
    setTimeout(() => {
      if (round < 3) {
        nextRound();
      } else {
        finishGame();
      }
    }, 3000);
  };

  const nextRound = () => {
    setRound(prev => prev + 1);
    setPlayerChoice(null);
    setOpponentChoice(null);
    setRoundResult(null);
    setTimer(30);
    setGameState('choosing');
  };

  const finishGame = () => {
    setGameState('finished');
    // O'yin natijasini ko'rsatish
  };

  const renderChoiceButton = (choiceKey) => {
    const choice = CHOICES[choiceKey];
    const isSelected = playerChoice === choiceKey;
    
    return (
      <motion.button
        key={choiceKey}
        className={`choice-btn ${choiceKey} ${isSelected ? 'selected' : ''}`}
        onClick={() => handleChoice(choiceKey)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        disabled={gameState !== 'choosing'}
      >
        <span className="choice-emoji">{choice.emoji}</span>
        <span className="choice-name">{choice.name}</span>
      </motion.button>
    );
  };

  return (
    <div className="game-board">
      {/* Header */}
      <div className="game-header">
        <div className="player-info">
          <div className="player-avatar">😎</div>
          <div className="player-details">
            <div className="player-name">Siz</div>
            <div className="player-score">G‘alaba: {scores.player}</div>
          </div>
        </div>
        
        <div className="game-status">
          <div className="round-info">Raund: {round}/3</div>
          <div className="timer">⏱️ {timer}s</div>
          <div className="game-mode">{game.mode === 'ranked' ? '⭐ Reytingli' : '🎮 Oddiy'}</div>
        </div>
        
        <div className="player-info opponent">
          <div className="player-avatar">👤</div>
          <div className="player-details">
            <div className="player-name">{game.opponent?.firstName || 'Raqib'}</div>
            <div className="player-score">G‘alaba: {scores.opponent}</div>
          </div>
        </div>
      </div>

      {/* Game area */}
      <div className="game-area">
        {gameState === 'choosing' && (
          <>
            <div className="choice-prompt">
              <h2>Tanlang!</h2>
              <p>30 soniya ichida tanlov qiling</p>
            </div>
            
            <div className="choices-container">
              {Object.keys(CHOICES).map(renderChoiceButton)}
            </div>
          </>
        )}

        {gameState === 'waiting_for_opponent' && (
          <div className="waiting-state">
            <div className="loading-spinner"></div>
            <h2>Raqib tanlovini kutmoqda...</h2>
            <p>Sizning tanlovingiz: {CHOICES[playerChoice]?.emoji}</p>
          </div>
        )}

        {gameState === 'result' && (
          <div className="result-state">
            <div className="choices-display">
              <div className="player-choice">
                <div className="choice-large">{CHOICES[playerChoice]?.emoji}</div>
                <div className="choice-label">Siz</div>
              </div>
              
              <div className="vs">VS</div>
              
              <div className="opponent-choice">
                <div className="choice-large">{CHOICES[opponentChoice]?.emoji}</div>
                <div className="choice-label">Raqib</div>
              </div>
            </div>
            
            <div className="result-message">
              {roundResult === 'player1_win' && (
                <motion.div
                  className="result-win"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  🎉 G'alaba!
                </motion.div>
              )}
              
              {roundResult === 'player2_win' && (
                <div className="result-lose">
                  😔 Yutqazdingiz
                </div>
              )}
              
              {roundResult === 'draw' && (
                <div className="result-draw">
                  🤝 Durang
                </div>
              )}
              
              {roundResult === 'timeout' && (
                <div className="result-timeout">
                  ⏰ Vaqt tugadi
                </div>
              )}
            </div>
            
            <div className="score-display">
              <div className="score">
                <span>Siz: {scores.player}</span>
                <span>Raqib: {scores.opponent}</span>
              </div>
            </div>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="game-finished">
            <h2>O'yin Tugadi!</h2>
            
            <div className="final-score">
              <div className="final-player">
                <span>Siz</span>
                <span className="score-number">{scores.player}</span>
              </div>
              
              <div className="final-vs">:</div>
              
              <div className="final-opponent">
                <span>Raqib</span>
                <span className="score-number">{scores.opponent}</span>
              </div>
            </div>
            
            <div className="final-result">
              {scores.player > scores.opponent ? (
                <div className="victory">
                  🏆 G'alaba qozondingiz!
                </div>
              ) : scores.player < scores.opponent ? (
                <div className="defeat">
                  😢 Yutqazdingiz
                </div>
              ) : (
                <div className="draw">
                  🤝 Durang
                </div>
              )}
            </div>
            
            <div className="game-actions">
              <button className="btn-primary">Qayta o'ynash</button>
              <button className="btn-secondary">Bosh sahifa</button>
              <button className="btn-outline">Statistika</button>
            </div>
          </div>
        )}
      </div>

      {/* Chat panel */}
      <div className="game-chat">
        <div className="chat-header">
          <span>💬 Chat</span>
        </div>
        <div className="chat-messages">
          {/* Chat messages will go here */}
        </div>
        <div className="chat-input">
          <input type="text" placeholder="Xabar yozing..." />
          <button>↗️</button>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;