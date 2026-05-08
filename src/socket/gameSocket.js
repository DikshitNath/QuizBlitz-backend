import Game from '../models/Game.js';

const answers = {}; // answers[pin][qIndex][playerName] = { answerIndex, timeTakenMs }

export default (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 connected:', socket.id);

    socket.on('host-join', async ({ pin }) => {
      const game = await Game.findOne({ pin }).populate('quiz');
      if (!game) return socket.emit('error', { message:'Game not found' });
      socket.join(pin);
      game.hostSocketId = socket.id;
      await game.save();
      socket.emit('host-joined', {
        pin,
        totalQuestions : game.quiz.questions.length,
        timerSeconds   : game.quiz.timerSeconds,
        title          : game.quiz.title,
        players        : game.players.map(p=>({ name:p.name, score:p.score, avatarEmoji:p.avatarEmoji }))
      });
    });

    socket.on('player-join', async ({ pin, name }) => {
      const game = await Game.findOne({ pin }).populate('quiz');
      if (!game)                   return socket.emit('error', { message:'Game not found' });
      if (game.status !== 'waiting') return socket.emit('error', { message:'Game already started' });

      const avatars = ['🎮','🦊','🐼','🦁','🐸','🦄','🤖','👾','🎯','🔥'];
      const avatar  = avatars[Math.floor(Math.random()*avatars.length)];
      const existing = game.players.find(p=>p.name===name);

      if (!existing) game.players.push({ name, avatarEmoji:avatar, score:0, socketId:socket.id });
      else existing.socketId = socket.id;
      await game.save();

      socket.join(pin);
      socket.emit('player-joined', {
        name, pin,
        avatarEmoji   : existing?.avatarEmoji || avatar,
        totalQuestions: game.quiz.questions.length,
        timerSeconds  : game.quiz.timerSeconds,
        title         : game.quiz.title
      });
      io.to(pin).emit('players-updated', {
        players: game.players.map(p=>({ name:p.name, score:p.score, avatarEmoji:p.avatarEmoji }))
      });
    });

    socket.on('start-game', async ({ pin }) => {
      const game = await Game.findOne({ pin }).populate('quiz');
      if (!game) return socket.emit('error', { message:'Game not found' });
      game.status = 'started'; game.currentQuestion = 0;
      await game.save();
      answers[pin] = {};
      const q = game.quiz.questions[0];
      io.to(pin).emit('question', {
        index:0, totalQuestions:game.quiz.questions.length,
        timerSeconds:game.quiz.timerSeconds, text:q.text, options:q.options
      });
    });

    socket.on('submit-answer', async ({ pin, name, answerIndex, timeTakenMs }) => {
      const game = await Game.findOne({ pin });
      if (!game) return;
      const qIndex = game.currentQuestion;
      if (!answers[pin]) answers[pin] = {};
      if (!answers[pin][qIndex]) answers[pin][qIndex] = {};
      if (answers[pin][qIndex][name] !== undefined) return;
      answers[pin][qIndex][name] = { answerIndex, timeTakenMs };
      socket.emit('answer-received', { questionIndex:qIndex });
      const count = Object.keys(answers[pin][qIndex]).length;
      io.to(game.hostSocketId).emit('answer-count', {
        count, total:game.players.length,
        answerCounts: _countAnswers(answers[pin][qIndex])
      });
    });

    socket.on('reveal-answer', async ({ pin }) => {
      const game = await Game.findOne({ pin }).populate('quiz');
      if (!game) return;
      const qIndex       = game.currentQuestion;
      const correctIndex = game.quiz.questions[qIndex].correctIndex;
      const qAnswers     = answers[pin]?.[qIndex] || {};

      for (const [name, { answerIndex, timeTakenMs }] of Object.entries(qAnswers)) {
        if (answerIndex === correctIndex) {
          const player = game.players.find(p=>p.name===name);
          if (player) player.score += 100 + Math.max(0, 1000 - Math.floor(timeTakenMs/10));
        }
      }
      game.status = 'reveal';
      await game.save();

      const leaderboard = game.players
        .map(p=>({ name:p.name, score:p.score, avatarEmoji:p.avatarEmoji }))
        .sort((a,b)=>b.score-a.score);

      io.to(pin).emit('answer-revealed', {
        correctIndex, questionIndex:qIndex,
        answerCounts:_countAnswers(qAnswers), leaderboard
      });
    });

    socket.on('next-question', async ({ pin }) => {
      const game = await Game.findOne({ pin }).populate('quiz');
      if (!game) return;
      const nextIndex = game.currentQuestion + 1;
      const totalQ    = game.quiz.questions.length;

      if (nextIndex >= totalQ) {
        game.status = 'finished';
        await game.save();
        const leaderboard = game.players
          .map(p=>({ name:p.name, score:p.score, avatarEmoji:p.avatarEmoji }))
          .sort((a,b)=>b.score-a.score);
        io.to(pin).emit('game-finished', { leaderboard });
      } else {
        game.currentQuestion = nextIndex; game.status = 'started';
        await game.save();
        const q = game.quiz.questions[nextIndex];
        io.to(pin).emit('question', {
          index:nextIndex, totalQuestions:totalQ,
          timerSeconds:game.quiz.timerSeconds, text:q.text, options:q.options
        });
      }
    });

    socket.on('end-game', async ({ pin }) => {
      const game = await Game.findOne({ pin }).populate('quiz');
      if (!game) return;
      game.status = 'finished'; await game.save();
      const leaderboard = game.players
        .map(p=>({ name:p.name, score:p.score, avatarEmoji:p.avatarEmoji }))
        .sort((a,b)=>b.score-a.score);
      io.to(pin).emit('game-finished', { leaderboard });
    });

    socket.on('disconnect', () => console.log('🔌 disconnected:', socket.id));
  });
};

function _countAnswers(qAnswers) {
  const counts = [0,0,0,0];
  for (const { answerIndex } of Object.values(qAnswers))
    if (answerIndex >= 0 && answerIndex <= 3) counts[answerIndex]++;
  return counts;
}