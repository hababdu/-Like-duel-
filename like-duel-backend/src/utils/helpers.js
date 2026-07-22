// src/utils/helpers.js
export const determineWinner = (choice1, choice2) => {
    if (choice1 === choice2) return 'draw';
    if (
      (choice1 === 'rock' && choice2 === 'scissors') ||
      (choice1 === 'paper' && choice2 === 'rock') ||
      (choice1 === 'scissors' && choice2 === 'paper')
    ) return 'player1';
    return 'player2';
  };
  
  export const getEmojiForChoice = (choice) => {
    const map = {
      'rock': '🪨',
      'paper': '📄',
      'scissors': '✂️'
    };
    return map[choice] || '❓';
  };
  
  export const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  export const calculateWinRate = (wins, totalGames) => {
    if (totalGames === 0) return 0;
    return Math.round((wins / totalGames) * 100);
  };