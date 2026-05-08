import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
  text        : { type: String, required: true },
  options     : [{ type: String, required: true }],
  correctIndex: { type: Number, required: true },
  difficulty  : { type: String, enum: ['easy','medium','hard'], default: 'medium' }
});

const QuizSchema = new mongoose.Schema({
  title       : { type: String, default: 'Quiz' },
  questions   : [QuestionSchema],
  timerSeconds: { type: Number, default: 20 }
}, { timestamps: true });

export default mongoose.model('Quiz', QuizSchema);