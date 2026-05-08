import mongoose from 'mongoose';

const PlayerSchema = new mongoose.Schema({
  name       : { type: String, required: true },
  avatarEmoji: { type: String, default: '🎮' },
  score      : { type: Number, default: 0 },
  socketId   : { type: String }
});

const GameSchema = new mongoose.Schema({
  pin            : { type: String, required: true, unique: true },
  quiz           : { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  status         : { type: String, enum: ['waiting','started','reveal','finished'], default: 'waiting' },
  currentQuestion: { type: Number, default: 0 },
  players        : [PlayerSchema],
  hostSocketId   : { type: String }
}, { timestamps: true });

export default mongoose.model('Game', GameSchema);