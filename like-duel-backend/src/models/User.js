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

export const User = mongoose.model('User', userSchema);
export default User;