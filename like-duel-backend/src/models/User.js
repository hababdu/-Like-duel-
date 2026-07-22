// src/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  tgId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  username: { 
    type: String, 
    default: '' 
  },
  firstName: { 
    type: String, 
    default: "O'yinchi" 
  },
  lastName: { 
    type: String, 
    default: '' 
  },
  photoUrl: { 
    type: String, 
    default: '' 
  },
  coins: { 
    type: Number, 
    default: 100, 
    min: 0 
  },
  rating: { 
    type: Number, 
    default: 100, 
    min: 0 
  },
  refParent: { 
    type: String, 
    default: null 
  },
  isRefRewarded: { 
    type: Boolean, 
    default: false 
  },
  lastLogin: { 
    type: Date, 
    default: Date.now 
  },
  totalGames: { 
    type: Number, 
    default: 0 
  },
  wins: { 
    type: Number, 
    default: 0 
  },
  losses: { 
    type: Number, 
    default: 0 
  },
  draws: { 
    type: Number, 
    default: 0 
  },
  lastGameAt: { 
    type: Date 
  },
  isOnline: { 
    type: Boolean, 
    default: false 
  },
  deviceInfo: { 
    type: String, 
    default: '' 
  }
}, { 
  timestamps: true 
});

// Index'lar
userSchema.index({ tgId: 1 });
userSchema.index({ rating: -1, coins: -1 });
userSchema.index({ username: 1 });
userSchema.index({ refParent: 1 });

// Virtual field'lar
userSchema.virtual('winRate').get(function() {
  if (this.totalGames === 0) return 0;
  return Math.round((this.wins / this.totalGames) * 100);
});

// Methods
userSchema.methods.updateCoins = function(amount) {
  this.coins = Math.max(0, this.coins + amount);
  return this.save();
};

userSchema.methods.updateRating = function(amount) {
  this.rating = Math.max(0, this.rating + amount);
  return this.save();
};

userSchema.methods.addGame = function(result) {
  this.totalGames += 1;
  if (result === 'win') this.wins += 1;
  else if (result === 'lose') this.losses += 1;
  else this.draws += 1;
  this.lastGameAt = new Date();
  return this.save();
};

export const User = mongoose.model('User', userSchema);
export default User;