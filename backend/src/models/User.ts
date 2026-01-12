import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  username: { type: String },
  rating: { type: Number, default: 1500 },
  coins: { type: Number, default: 100 },
  level: { type: Number, default: 1 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  dailySuperLikes: { type: Number, default: 3 },
  streakDays: { type: Number, default: 0 },
  bio: { type: String, default: '' },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Virtual field for win rate
userSchema.virtual('winRate').get(function() {
  const total = this.wins + this.losses;
  return total > 0 ? Math.round((this.wins / total) * 100) : 0;
});

export const User = mongoose.model('User', userSchema);