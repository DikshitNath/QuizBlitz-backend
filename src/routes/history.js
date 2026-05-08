import express from 'express';
import Game    from '../models/Game.js';

const router = express.Router();

// Host history — games they created
router.get('/host/:userId', async (req, res) => {
  try {
    const games = await Game.find({
      hostUserId: req.params.userId,
      status    : 'finished'
    })
    .populate('quiz', 'title')
    .sort({ createdAt: -1 })
    .limit(20);

    const history = games.map(g => ({
      id          : g._id,
      pin         : g.pin,
      quizTitle   : g.quiz?.title ?? 'Unknown Quiz',
      playerCount : g.players.length,
      winner      : g.players.sort((a,b) => b.score - a.score)[0]?.name ?? '-',
      winnerEmoji : g.players.sort((a,b) => b.score - a.score)[0]?.avatarEmoji ?? '🎮',
      topScore    : g.players.sort((a,b) => b.score - a.score)[0]?.score ?? 0,
      playedAt    : g.createdAt
    }));

    res.json({ history });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Player history — games they joined
router.get('/player/:userId', async (req, res) => {
  try {
    const games = await Game.find({
      'players.userId': req.params.userId,
      status          : 'finished'
    })
    .populate('quiz', 'title')
    .sort({ createdAt: -1 })
    .limit(20);

    const history = games.map(g => {
      const sorted = [...g.players].sort((a,b) => b.score - a.score);
      const me     = g.players.find(p => p.userId === req.params.userId);
      const rank   = sorted.findIndex(p => p.userId === req.params.userId) + 1;
      return {
        id         : g._id,
        pin        : g.pin,
        quizTitle  : g.quiz?.title ?? 'Unknown Quiz',
        myScore    : me?.score ?? 0,
        myRank     : rank,
        totalPlayers: g.players.length,
        playedAt   : g.createdAt
      };
    });

    res.json({ history });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;