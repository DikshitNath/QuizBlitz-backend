
import axios from 'axios';
import Quiz  from '../models/Quiz.js';

// helper — builds the Groq prompt with difficulty breakdown
function buildPrompt(topic, difficulty, totalQuestions) {
  const { easy = 0, medium = 0, hard = 0 } = difficulty;

  const breakdown = [
    easy   > 0 ? `${easy} EASY questions (basic recall, straightforward facts)`   : '',
    medium > 0 ? `${medium} MEDIUM questions (some reasoning, moderate complexity)` : '',
    hard   > 0 ? `${hard} HARD questions (deep understanding, tricky or analytical)` : ''
  ].filter(Boolean).join(', ');

  return `Generate a quiz about "${topic}".
Difficulty breakdown: ${breakdown} (total: ${totalQuestions} questions).
Return ONLY valid JSON in this exact format, no extra text:
{
  "title": "Quiz Title",
  "questions": [
    {
      "text": "Question?",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "difficulty": "easy"
    }
  ]
}
Rules:
- Exactly ${totalQuestions} questions total
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- difficulty field per question must be "easy", "medium", or "hard"
- Follow the breakdown exactly: ${easy} easy, ${medium} medium, ${hard} hard
- Only JSON, absolutely no extra text`;
}

// POST /api/quiz/generate-topic
export const generateFromTopic = async (req, res) => {
  const {
    topic,
    timerSeconds = 20,
    difficulty   = { easy: 2, medium: 2, hard: 1 },
    numQuestions
  } = req.body;

  if (!topic) return res.status(400).json({ error: 'topic required' });

  // if numQuestions provided, auto-split difficulty proportionally
  const diff = resolveDifficulty(difficulty, numQuestions);
  const total = diff.easy + diff.medium + diff.hard;

  const prompt = buildPrompt(topic, diff, total);

  try {
    const r = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.7 },
      { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }
    );
    const content = r.data.choices[0].message.content.trim();
    const parsed  = JSON.parse(content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim());

    const quiz = await Quiz.create({
      title       : parsed.title,
      questions   : parsed.questions,
      timerSeconds: timerSeconds
    });

    res.json({
      quizId      : quiz._id,
      title       : quiz.title,
      questions   : quiz.questions,
      timerSeconds,
      totalQuestions: quiz.questions.length,
      difficulty  : diff
    });
  } catch(err) {
    console.error('Groq error:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI generation failed: ' + err.message });
  }
};

// POST /api/quiz/generate-pdf
export const generateFromPdfText = async (req, res) => {
  const {
    text,
    title        = 'Quiz',
    timerSeconds = 20,
    difficulty   = { easy: 2, medium: 2, hard: 1 },
    numQuestions
  } = req.body;

  if (!text) return res.status(400).json({ error: 'text required' });

  const diff  = resolveDifficulty(difficulty, numQuestions);
  const total = diff.easy + diff.medium + diff.hard;

  const prompt = `${buildPrompt(title, diff, total)}
Generate questions based on this content:
${text.slice(0, 3000)}`;

  try {
    const r = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.7 },
      { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }
    );
    const content = r.data.choices[0].message.content.trim();
    const parsed  = JSON.parse(content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim());

    const quiz = await Quiz.create({
      title       : parsed.title || title,
      questions   : parsed.questions,
      timerSeconds: timerSeconds
    });

    res.json({
      quizId        : quiz._id,
      title         : quiz.title,
      questions     : quiz.questions,
      timerSeconds,
      totalQuestions: quiz.questions.length,
      difficulty    : diff
    });
  } catch(err) {
    res.status(500).json({ error: 'AI generation failed: ' + err.message });
  }
};

// POST /api/quiz/manual
export const createManual = async (req, res) => {
  const { title, questions, timerSeconds = 20 } = req.body;
  if (!questions?.length) return res.status(400).json({ error: 'questions required' });
  try {
    const quiz = await Quiz.create({ title: title || 'Quiz', questions, timerSeconds });
    res.json({
      quizId        : quiz._id,
      title         : quiz.title,
      questions     : quiz.questions,
      timerSeconds,
      totalQuestions: quiz.questions.length
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
};

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * If numQuestions is provided, auto-split difficulty proportionally (40/40/20).
 * Otherwise use the difficulty object as-is.
 */
function resolveDifficulty(difficulty, numQuestions) {
  if (numQuestions && numQuestions > 0) {
    const n    = parseInt(numQuestions);
    const hard = Math.max(1, Math.floor(n * 0.2));
    const easy = Math.max(1, Math.floor(n * 0.4));
    const med  = n - easy - hard;
    return { easy, medium: Math.max(0, med), hard };
  }
  return {
    easy  : parseInt(difficulty.easy   || 0),
    medium: parseInt(difficulty.medium || 0),
    hard  : parseInt(difficulty.hard   || 0)
  };
}