// src/RPSBot.js
export default class RPSBot {
    constructor(difficulty = 'medium') {
      this.difficulty = difficulty;
      this.history = [];
      this.stats = { rock: 0, paper: 0, scissors: 0 };
    }
  
    choose(last = null) {
      const opts = ['rock', 'paper', 'scissors'];
  
      if (this.difficulty === 'easy') {
        return opts[Math.floor(Math.random() * 3)];
      }
  
      if (!last && this.history.length > 0) {
        last = this.history[this.history.length - 1];
      }
  
      if (this.difficulty === 'medium') {
        if (last && Math.random() < 0.68) return this.beats(last);
        return opts[Math.floor(Math.random() * 3)];
      }
  
      // hard
      const most = this.getMostFrequent();
      if (most && Math.random() < 0.82) return this.beats(most);
      if (last) return this.beats(last);
      return opts[Math.floor(Math.random() * 3)];
    }
  
    beats(choice) {
      if (choice === 'rock') return 'paper';
      if (choice === 'paper') return 'scissors';
      return 'rock';
    }
  
    getMostFrequent() {
      const values = Object.values(this.stats);
      if (values.length === 0) return null;
      const max = Math.max(...values);
      for (const [key, count] of Object.entries(this.stats)) {
        if (count === max) return key;
      }
      return null;
    }
  
    remember(choice) {
      if (!choice) return;
      this.history.push(choice);
      this.stats[choice] = (this.stats[choice] || 0) + 1;
      if (this.history.length > 25) this.history.shift();
    }
  
    reset() {
      this.history = [];
      this.stats = { rock: 0, paper: 0, scissors: 0 };
    }
  }