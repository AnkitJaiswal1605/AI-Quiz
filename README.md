# AI Quiz

A premium, luxe-themed web application that tests users with random multiple-choice questions about Artificial Intelligence. Built with Node.js, Express, and PostgreSQL.

## Features

- **User Authentication** — Secure sign-up and login with bcrypt-hashed passwords and session management
- **AI Quiz Engine** — 3 random MCQ questions selected from a curated question bank on each attempt
- **Score Tracking** — Full quiz history with scores, dates, and performance indicators
- **Admin Dashboard** — Protected admin panel (restricted by email whitelist) with stats on all users, quiz attempts, average scores, and perfect scores
- **Premium Design** — Dark theme with gold accents for a luxe, high-end feel

## Tech Stack

| Layer     | Technology       |
|-----------|------------------|
| Backend   | Node.js, Express |
| Database  | PostgreSQL (pg)  |
| Auth      | bcryptjs, express-session |
| Frontend  | Vanilla HTML, CSS, JS (SPA) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/) (v14 or higher)

### Database Setup

```bash
# Create the database
createdb ai_quiz

# Or with a specific user
psql -U postgres -c "CREATE DATABASE ai_quiz;"
```

Tables are auto-created when the server starts.

### Installation

```bash
# Clone the repository
git clone https://github.com/AnkitJaiswal1605/AI-Quiz.git
cd AI-Quiz

# Install dependencies
npm install

# Start the server (uses postgresql://localhost:5432/ai_quiz by default)
node server.js

# Or with a custom database URL
DATABASE_URL=postgresql://user:password@host:5432/ai_quiz node server.js
```

The app will be running at **http://localhost:3000**.

### Share Publicly (Optional)

To create a temporary public link using Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

## Project Structure

```
AI-Quiz/
├── server.js            # Express backend (API routes, auth, quiz logic)
├── package.json         # Dependencies
├── .gitignore           # Ignores node_modules, .env
└── public/
    ├── index.html       # Single-page app HTML
    ├── app.js           # Frontend logic (auth, quiz, admin)
    └── style.css        # Premium dark/gold theme
```

## Admin Access

The admin dashboard is restricted to whitelisted emails. To change the admin email, edit the `ADMIN_EMAILS` array in `server.js`:

```js
const ADMIN_EMAILS = ['ankit@big-bang.ai'];
```

## Database

User data and quiz attempts are stored in PostgreSQL. To inspect the database:

```bash
psql ai_quiz -c "SELECT * FROM users;"
psql ai_quiz -c "SELECT * FROM quiz_attempts;"
```

## Environment Variables

| Variable       | Default                                  | Description          |
|----------------|------------------------------------------|----------------------|
| `DATABASE_URL` | `postgresql://localhost:5432/ai_quiz`    | PostgreSQL connection string |
| `SESSION_SECRET` | Auto-generated                         | Session encryption key |
| `PORT`         | `3000`                                   | Server port          |

## License

ISC
