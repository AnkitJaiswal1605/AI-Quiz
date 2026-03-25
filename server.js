const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const app = express();

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/ai_quiz'
});

// Create tables on startup
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      questions TEXT NOT NULL,
      answers TEXT NOT NULL,
      completed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Database tables ready');
}

initDB().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Questions bank
const questions = [
  {
    id: 1,
    question: "What does GPT stand for in the context of AI language models?",
    options: ["General Processing Technology", "Generative Pre-trained Transformer", "Global Pattern Tracking", "Guided Prediction Tool"],
    correct: 1
  },
  {
    id: 2,
    question: "Which technique allows AI models to learn from human feedback?",
    options: ["Backpropagation", "RLHF (Reinforcement Learning from Human Feedback)", "Gradient Descent", "Batch Normalization"],
    correct: 1
  },
  {
    id: 3,
    question: "What is a 'hallucination' in AI terminology?",
    options: ["A visual processing error", "When AI generates confident but incorrect information", "A type of neural network layer", "An optimization algorithm"],
    correct: 1
  },
  {
    id: 4,
    question: "What is the primary purpose of attention mechanisms in transformers?",
    options: ["To reduce model size", "To weigh the importance of different parts of the input", "To speed up training", "To compress data"],
    correct: 1
  },
  {
    id: 5,
    question: "Which of these is an example of unsupervised learning?",
    options: ["Image classification with labels", "Clustering similar documents", "Spam detection with labeled emails", "Predicting house prices with historical data"],
    correct: 1
  },
  {
    id: 6,
    question: "What is 'transfer learning' in AI?",
    options: ["Moving data between servers", "Applying knowledge from one task to a different task", "Converting models between frameworks", "Sharing weights across GPUs"],
    correct: 1
  },
  {
    id: 7,
    question: "What does the 'temperature' parameter control in language models?",
    options: ["Processing speed", "Randomness/creativity of outputs", "Memory usage", "Training duration"],
    correct: 1
  },
  {
    id: 8,
    question: "Which AI approach mimics the structure of the human brain?",
    options: ["Decision Trees", "Neural Networks", "Linear Regression", "Rule-based Systems"],
    correct: 1
  },
  {
    id: 9,
    question: "What is a 'token' in the context of large language models?",
    options: ["A security credential", "A piece of text (word or subword) the model processes", "A type of neural network", "A training dataset"],
    correct: 1
  },
  {
    id: 10,
    question: "What is 'prompt engineering'?",
    options: ["Building hardware for AI", "Crafting inputs to get desired outputs from AI models", "Designing training datasets", "Optimizing model architecture"],
    correct: 1
  },
  {
    id: 11,
    question: "What does RAG stand for in AI systems?",
    options: ["Rapid Algorithm Generation", "Retrieval-Augmented Generation", "Random Access Graphics", "Recursive Attention Gate"],
    correct: 1
  },
  {
    id: 12,
    question: "Which company developed the Transformer architecture paper 'Attention Is All You Need'?",
    options: ["OpenAI", "Google", "Meta", "Microsoft"],
    correct: 1
  }
];

// Get 3 random questions
function getRandomQuestions() {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Admin email whitelist
const ADMIN_EMAILS = ['ankit@big-bang.ai'];

async function isAdmin(userId) {
  const result = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
  return result.rows[0] && ADMIN_EMAILS.includes(result.rows[0].email.toLowerCase());
}

// --- API Routes ---

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
      [name, email, hash]
    );

    const userId = result.rows[0].id;
    req.session.userId = userId;
    req.session.userName = name;

    res.json({ success: true, user: { id: userId, name, email, isAdmin: ADMIN_EMAILS.includes(email.toLowerCase()) } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    req.session.userName = user.name;

    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, isAdmin: ADMIN_EMAILS.includes(user.email.toLowerCase()) } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.session.userId]);
    const user = result.rows[0];
    res.json({ user: { ...user, isAdmin: ADMIN_EMAILS.includes(user.email.toLowerCase()) } });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get quiz questions
app.get('/api/quiz', requireAuth, (req, res) => {
  const selected = getRandomQuestions();
  const safe = selected.map(q => ({
    id: q.id,
    question: q.question,
    options: q.options
  }));
  req.session.quizQuestions = selected;
  res.json({ questions: safe });
});

// Submit quiz
app.post('/api/quiz/submit', requireAuth, async (req, res) => {
  try {
    const { answers } = req.body;
    const quizQuestions = req.session.quizQuestions;

    if (!quizQuestions) {
      return res.status(400).json({ error: 'No active quiz session' });
    }

    let score = 0;
    const results = quizQuestions.map(q => {
      const userAnswer = answers[q.id];
      const isCorrect = userAnswer === q.correct;
      if (isCorrect) score++;
      return {
        question: q.question,
        options: q.options,
        correctAnswer: q.correct,
        userAnswer,
        isCorrect
      };
    });

    await pool.query(
      'INSERT INTO quiz_attempts (user_id, score, total, questions, answers) VALUES ($1, $2, $3, $4, $5)',
      [req.session.userId, score, 3, JSON.stringify(quizQuestions.map(q => q.id)), JSON.stringify(answers)]
    );

    delete req.session.quizQuestions;

    res.json({ score, total: 3, results });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's quiz history
app.get('/api/quiz/history', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, score, total, completed_at FROM quiz_attempts WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 20',
      [req.session.userId]
    );
    res.json({ attempts: result.rows });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin dashboard data
app.get('/api/admin/stats', requireAuth, async (req, res) => {
  try {
    if (!(await isAdmin(req.session.userId))) {
      return res.status(403).json({ error: 'Access denied. Admins only.' });
    }

    const totalUsers = (await pool.query('SELECT COUNT(*) as count FROM users')).rows[0].count;
    const totalAttempts = (await pool.query('SELECT COUNT(*) as count FROM quiz_attempts')).rows[0].count;
    const avgScore = (await pool.query('SELECT ROUND(AVG(score::decimal / total) * 100, 1) as avg FROM quiz_attempts')).rows[0].avg || 0;
    const perfectScores = (await pool.query('SELECT COUNT(*) as count FROM quiz_attempts WHERE score = total')).rows[0].count;

    const users = (await pool.query(`
      SELECT u.id, u.name, u.email, u.created_at,
        COUNT(q.id) as attempts,
        COALESCE(ROUND(AVG(q.score::decimal / q.total) * 100, 1), 0) as avg_score,
        COALESCE(MAX(q.score), 0) as best_score
      FROM users u
      LEFT JOIN quiz_attempts q ON u.id = q.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)).rows;

    const recentAttempts = (await pool.query(`
      SELECT q.id, q.score, q.total, q.completed_at, u.name, u.email
      FROM quiz_attempts q
      JOIN users u ON q.user_id = u.id
      ORDER BY q.completed_at DESC
      LIMIT 50
    `)).rows;

    res.json({ totalUsers, totalAttempts, avgScore, perfectScores, users, recentAttempts });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
