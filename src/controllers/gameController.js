import Game from '../models/Game.js';
import Quiz from '../models/Quiz.js';

export const createGame = async (req, res) => {
  const { quizId } = req.body;
  if (!quizId) return res.status(400).json({ error:'quizId required' });
  try {
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ error:'Quiz not found' });
    let pin, exists;
    do {
      pin    = Math.floor(100000 + Math.random() * 900000).toString();
      exists = await Game.findOne({ pin });
    } while (exists);
    const game = await Game.create({ pin, quiz: quizId });
    res.json({ pin, gameId:game._id, totalQuestions:quiz.questions.length, timerSeconds:quiz.timerSeconds, title:quiz.title });
  } catch(err) { res.status(500).json({ error:err.message }); }
};

export const getGame = async (req, res) => {
  try {
    const game = await Game.findOne({ pin:req.params.pin }).populate('quiz');
    if (!game) return res.status(404).json({ error:'Game not found' });
    res.json({
      pin:game.pin, status:game.status,
      currentQuestion:game.currentQuestion,
      totalQuestions:game.quiz.questions.length,
      timerSeconds:game.quiz.timerSeconds,
      title:game.quiz.title,
      players:game.players.map(p=>({ name:p.name, score:p.score, avatarEmoji:p.avatarEmoji }))
    });
  } catch(err) { res.status(500).json({ error:err.message }); }
};