const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const app = express();
const db = new Database(path.join(__dirname, 'quiz.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    questions TEXT NOT NULL,
    answers TEXT NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
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

// --- API Routes ---

// Register
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hash);

  req.session.userId = result.lastInsertRowid;
  req.session.userName = name;

  res.json({ success: true, user: { id: result.lastInsertRowid, name, email, isAdmin: ADMIN_EMAILS.includes(email.toLowerCase()) } });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  req.session.userId = user.id;
  req.session.userName = user.name;

  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, isAdmin: ADMIN_EMAILS.includes(user.email.toLowerCase()) } });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: { ...user, isAdmin: ADMIN_EMAILS.includes(user.email.toLowerCase()) } });
});

// Get quiz questions
app.get('/api/quiz', requireAuth, (req, res) => {
  const selected = getRandomQuestions();
  // Don't send correct answers to client
  const safe = selected.map(q => ({
    id: q.id,
    question: q.question,
    options: q.options
  }));
  // Store correct answers in session
  req.session.quizQuestions = selected;
  res.json({ questions: safe });
});

// Submit quiz
app.post('/api/quiz/submit', requireAuth, (req, res) => {
  const { answers } = req.body; // { questionId: selectedIndex }
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

  // Save to database
  db.prepare('INSERT INTO quiz_attempts (user_id, score, total, questions, answers) VALUES (?, ?, ?, ?, ?)')
    .run(req.session.userId, score, 3, JSON.stringify(quizQuestions.map(q => q.id)), JSON.stringify(answers));

  delete req.session.quizQuestions;

  res.json({ score, total: 3, results });
});

// Get user's quiz history
app.get('/api/quiz/history', requireAuth, (req, res) => {
  const attempts = db.prepare('SELECT id, score, total, completed_at FROM quiz_attempts WHERE user_id = ? ORDER BY completed_at DESC LIMIT 20')
    .all(req.session.userId);
  res.json({ attempts });
});

// Admin email whitelist
const ADMIN_EMAILS = ['ankit@big-bang.ai'];

function isAdmin(userId) {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  return user && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

// Admin dashboard data
app.get('/api/admin/stats', requireAuth, (req, res) => {
  if (!isAdmin(req.session.userId)) {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalAttempts = db.prepare('SELECT COUNT(*) as count FROM quiz_attempts').get().count;
  const avgScore = db.prepare('SELECT ROUND(AVG(score * 1.0 / total) * 100, 1) as avg FROM quiz_attempts').get().avg || 0;
  const perfectScores = db.prepare('SELECT COUNT(*) as count FROM quiz_attempts WHERE score = total').get().count;

  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.created_at,
      COUNT(q.id) as attempts,
      COALESCE(ROUND(AVG(q.score * 1.0 / q.total) * 100, 1), 0) as avg_score,
      COALESCE(MAX(q.score), 0) as best_score
    FROM users u
    LEFT JOIN quiz_attempts q ON u.id = q.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  const recentAttempts = db.prepare(`
    SELECT q.id, q.score, q.total, q.completed_at, u.name, u.email
    FROM quiz_attempts q
    JOIN users u ON q.user_id = u.id
    ORDER BY q.completed_at DESC
    LIMIT 50
  `).all();

  res.json({ totalUsers, totalAttempts, avgScore, perfectScores, users, recentAttempts });
});

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
