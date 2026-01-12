import mongoose from 'mongoose';

// Player sub-schema
const playerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    default: 1500
  },
  choice: {
    type: String,
    enum: ['like', 'super_like', 'skip'],
    default: null
  },
  reward: {
    type: Number,
    default: 0
  }
});

// Result sub-schema
const resultSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['match', 'no_match', 'timeout'],
    default: 'no_match'
  },
  winner: {
    type: String,
    default: null
  },
  message: {
    type: String,
    default: ''
  },
  rewards: {
    type: Map,
    of: Number,
    default: {}
  }
});

// Main Duel schema
const duelSchema = new mongoose.Schema({
  duelId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  players: {
    type: [playerSchema],
    required: true,
    validate: {
      validator: function(players: any[]) {
        return players.length === 2;
      },
      message: 'Duel must have exactly 2 players'
    }
  },
  result: {
    type: resultSchema,
    default: () => ({})
  },
  duration: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // createdAt va updatedAt avtomatik qo'shiladi
});

// Indexes
duelSchema.index({ duelId: 1 }, { unique: true });
duelSchema.index({ status: 1 });
duelSchema.index({ 'players.id': 1 });
duelSchema.index({ createdAt: -1 });
duelSchema.index({ startedAt: -1 });

// Virtual fields
duelSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

duelSchema.virtual('isMatch').get(function() {
  return this.result.type === 'match';
});

// Static methods
duelSchema.statics.findActiveDuels = function() {
  return this.find({ 
    status: { $in: ['pending', 'active'] },
    createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
  }).limit(10);
};

duelSchema.statics.findByPlayerId = function(playerId: string, limit = 20) {
  return this.find({ 
    'players.id': playerId 
  }).sort({ createdAt: -1 }).limit(limit);
};

// Instance methods
duelSchema.methods.addPlayerChoice = function(playerId: string, choice: string) {
  const player = this.players.find((p: any) => p.id === playerId);
  if (player) {
    player.choice = choice;
  }
  return this.save();
};

duelSchema.methods.completeWithResult = function(resultData: any) {
  this.result = resultData;
  this.status = 'completed';
  this.completedAt = new Date();
  this.duration = Math.floor((this.completedAt.getTime() - this.startedAt.getTime()) / 1000);
  
  // Mukofotlarni taqsimlash
  if (resultData.type === 'match' && resultData.rewards) {
    this.players.forEach((player: any) => {
      const reward = resultData.rewards[player.id];
      if (reward) {
        player.reward = reward;
      }
    });
  }
  
  return this.save();
};

// Pre-save middleware
duelSchema.pre('save', function(next) {
  if (this.isNew && this.players.length === 2) {
    this.status = 'active';
  }
  next();
});

// Modelni export qilish
const Duel = mongoose.models.Duel || mongoose.model('Duel', duelSchema);

export default Duel;