// === State ===
let currentUser = null;
let quizQuestions = [];
let currentQuestion = 0;
let answers = {};

// === DOM Helpers ===
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  $(`#screen-${id}`).classList.remove('hidden');
  $('#navbar').classList.toggle('hidden', id === 'auth');
}

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// === Auth ===
$$('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    $('#form-login').classList.toggle('hidden', !isLogin);
    $('#form-register').classList.toggle('hidden', isLogin);
    $('#login-error').textContent = '';
    $('#reg-error').textContent = '';
  });
});

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    const data = await api('/login', {
      method: 'POST',
      body: {
        email: $('#login-email').value,
        password: $('#login-password').value,
      }
    });
    currentUser = data.user;
    enterDashboard();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$('#form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#reg-error').textContent = '';
  try {
    const data = await api('/register', {
      method: 'POST',
      body: {
        name: $('#reg-name').value,
        email: $('#reg-email').value,
        password: $('#reg-password').value,
      }
    });
    currentUser = data.user;
    enterDashboard();
  } catch (err) {
    $('#reg-error').textContent = err.message;
  }
});

$('#btn-logout').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' });
  currentUser = null;
  showScreen('auth');
});

// === Dashboard ===
async function enterDashboard() {
  $('#dash-name').textContent = currentUser.name;
  $('#nav-user').textContent = currentUser.name;
  // Only show admin button for admin users
  $('#btn-admin').style.display = currentUser.isAdmin ? '' : 'none';
  showScreen('dashboard');
  loadHistory();
}

async function loadHistory() {
  try {
    const data = await api('/quiz/history');
    const list = $('#history-list');
    if (data.attempts.length === 0) {
      list.innerHTML = '<p class="muted">No attempts yet. Take your first quiz!</p>';
      return;
    }
    list.innerHTML = data.attempts.map(a => {
      const scoreClass = a.score === 3 ? 'perfect' : a.score >= 2 ? 'good' : 'low';
      const date = new Date(a.completed_at + 'Z').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      return `
        <div class="history-item">
          <span class="history-score ${scoreClass}">${a.score}/${a.total}</span>
          <span class="history-date">${date}</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

// === Quiz ===
$('#btn-start-quiz').addEventListener('click', startQuiz);

async function startQuiz() {
  try {
    const data = await api('/quiz');
    quizQuestions = data.questions;
    currentQuestion = 0;
    answers = {};
    showScreen('quiz');
    renderQuestion();
  } catch (err) {
    console.error(err);
  }
}

function renderQuestion() {
  const q = quizQuestions[currentQuestion];
  const step = currentQuestion + 1;
  const letters = ['A', 'B', 'C', 'D'];

  $('#quiz-step').textContent = `Question ${step} of 3`;
  $('#progress-fill').style.width = `${(step / 3) * 100}%`;
  $('#q-text').textContent = q.question;

  const optionsHtml = q.options.map((opt, i) => `
    <button class="option-btn ${answers[q.id] === i ? 'selected' : ''}" data-index="${i}">
      <span class="option-letter">${letters[i]}</span>
      <span>${opt}</span>
    </button>
  `).join('');

  $('#q-options').innerHTML = optionsHtml;

  // Animate in
  $('#quiz-question').classList.remove('fade-in');
  void $('#quiz-question').offsetWidth;
  $('#quiz-question').classList.add('fade-in');

  // Option click handlers
  $$('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      answers[q.id] = idx;
      $$('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateQuizButtons();
    });
  });

  updateQuizButtons();
}

function updateQuizButtons() {
  const q = quizQuestions[currentQuestion];
  const hasAnswer = answers[q.id] !== undefined;
  const isLast = currentQuestion === 2;

  $('#btn-next').classList.toggle('hidden', !hasAnswer || isLast);
  $('#btn-submit-quiz').classList.toggle('hidden', !hasAnswer || !isLast);
}

$('#btn-next').addEventListener('click', () => {
  currentQuestion++;
  renderQuestion();
});

$('#btn-submit-quiz').addEventListener('click', submitQuiz);

async function submitQuiz() {
  try {
    const data = await api('/quiz/submit', {
      method: 'POST',
      body: { answers }
    });
    showResults(data);
  } catch (err) {
    console.error(err);
  }
}

// === Results ===
function showResults(data) {
  showScreen('results');

  const pct = data.score / data.total;
  const circumference = 339.292;
  const offset = circumference * (1 - pct);

  $('#score-text').textContent = `${data.score}/${data.total}`;
  $('#ring-progress').style.strokeDashoffset = offset;

  if (data.score === 3) {
    $('#results-title').textContent = 'Perfect Score';
    $('#results-subtitle').textContent = 'You are an AI connoisseur.';
  } else if (data.score === 2) {
    $('#results-title').textContent = 'Well Done';
    $('#results-subtitle').textContent = 'Impressive AI knowledge.';
  } else if (data.score === 1) {
    $('#results-title').textContent = 'Good Try';
    $('#results-subtitle').textContent = 'Keep exploring the world of AI.';
  } else {
    $('#results-title').textContent = 'Room to Grow';
    $('#results-subtitle').textContent = 'Every expert was once a beginner.';
  }

  const letters = ['A', 'B', 'C', 'D'];
  $('#results-breakdown').innerHTML = data.results.map(r => `
    <div class="result-card ${r.isCorrect ? 'correct' : 'incorrect'}">
      <div class="rq">${r.question}</div>
      <div class="answer-line">
        Your answer: <span class="${r.isCorrect ? 'correct-text' : 'incorrect-text'}">${r.options[r.userAnswer]} (${letters[r.userAnswer]})</span>
      </div>
      ${!r.isCorrect ? `
        <div class="answer-line">
          Correct answer: <span class="correct-text">${r.options[r.correctAnswer]} (${letters[r.correctAnswer]})</span>
        </div>
      ` : ''}
    </div>
  `).join('');
}

$('#btn-retry').addEventListener('click', startQuiz);
$('#btn-back-dash').addEventListener('click', () => {
  // Reset ring for next time
  $('#ring-progress').style.strokeDashoffset = 339.292;
  enterDashboard();
});

// === Admin Dashboard ===
$('#btn-admin').addEventListener('click', enterAdmin);
$('#btn-admin-back').addEventListener('click', enterDashboard);

async function enterAdmin() {
  showScreen('admin');
  try {
    const data = await api('/admin/stats');

    $('#stat-users').textContent = data.totalUsers;
    $('#stat-attempts').textContent = data.totalAttempts;
    $('#stat-avg').textContent = data.avgScore + '%';
    $('#stat-perfect').textContent = data.perfectScores;

    // Users table
    $('#admin-users-body').innerHTML = data.users.map(u => {
      const date = new Date(u.created_at + 'Z').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
      const scoreClass = u.avg_score >= 90 ? 'perfect' : u.avg_score >= 60 ? 'good' : 'low';
      return `
        <tr>
          <td>${u.name}</td>
          <td class="email-cell">${u.email}</td>
          <td>${date}</td>
          <td>${u.attempts}</td>
          <td class="score-cell ${u.attempts > 0 ? scoreClass : ''}">${u.attempts > 0 ? u.avg_score + '%' : '—'}</td>
          <td>${u.attempts > 0 ? u.best_score + '/3' : '—'}</td>
        </tr>
      `;
    }).join('');

    // Recent attempts table
    $('#admin-attempts-body').innerHTML = data.recentAttempts.map(a => {
      const date = new Date(a.completed_at + 'Z').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const scoreClass = a.score === 3 ? 'perfect' : a.score >= 2 ? 'good' : 'low';
      return `
        <tr>
          <td>${a.name}</td>
          <td class="email-cell">${a.email}</td>
          <td class="score-cell ${scoreClass}">${a.score}/${a.total}</td>
          <td>${date}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

// === Init: check session ===
(async () => {
  try {
    const data = await api('/me');
    currentUser = data.user;
    enterDashboard();
  } catch {
    showScreen('auth');
  }
})();
