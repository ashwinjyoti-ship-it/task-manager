# Task Manager

A full-stack task management application with user authentication.

## Features

- ✅ User registration and login
- ✅ JWT-based authentication
- ✅ Create, read, update, and delete tasks
- ✅ Mark tasks as complete/incomplete
- ✅ Filter tasks by status (all, active, completed)
- ✅ User-specific task isolation
- ✅ Responsive design with TailwindCSS

## Tech Stack

### Frontend
- React 18
- Vite
- React Router v6
- TailwindCSS
- Axios

### Backend
- Node.js + Express
- SQLite (better-sqlite3)
- JWT authentication
- bcryptjs for password hashing

## Getting Started

### Prerequisites
- Node.js 18+ installed

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Edit `.env` and set your JWT secret:
```
JWT_SECRET=your-secure-secret-key-here
PORT=3000
```

5. Start the server:
```bash
npm start
```

Server will run on http://localhost:3000

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Frontend will run on http://localhost:5173

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Tasks
- `GET /api/tasks` - Get all user tasks (requires auth)
- `POST /api/tasks` - Create new task (requires auth)
- `PUT /api/tasks/:id` - Update task (requires auth)
- `DELETE /api/tasks/:id` - Delete task (requires auth)

## Project Structure

```
task-manager/
├── backend/
│   ├── routes/
│   │   ├── auth.js
│   │   └── tasks.js
│   ├── db.js
│   ├── auth.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── AuthContext.jsx
│   │   ├── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
└── README.md
```

## License

MIT
