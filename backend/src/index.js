/**
 * Cloudflare Worker for Task Manager API
 * Uses Web Crypto API for JWT and password hashing
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS requests
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Helper to create JSON response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Password hashing using Web Crypto API
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

// Simple JWT implementation using Web Crypto API
async function createJWT(payload, secret, expiresIn = 7 * 24 * 60 * 60) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = { ...payload, iat: now, exp: now + expiresIn };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const encoder = new TextEncoder();
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', secretKey, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function verifyJWT(token, secret) {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify('HMAC', secretKey, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

// Auth middleware
async function verifyToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  return payload ? payload.userId : null;
}

// Initialize database
async function initDatabase(env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await env.DB.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)
  `);

  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await env.DB.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)
  `);

  await env.DB.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)
  `);
}

// Route handlers
async function handleRegister(request, env) {
  const { email, password, name } = await request.json();

  if (!email || !password || !name || password.length < 6) {
    return jsonResponse({ error: 'Validation failed' }, 400);
  }

  try {
    // Check if user exists
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return jsonResponse({ error: 'Email already registered' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const result = await env.DB.prepare(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
    ).bind(email, passwordHash, name).run();

    const userId = result.meta.last_row_id;

    // Generate token
    const token = await createJWT({ userId }, env.JWT_SECRET);

    return jsonResponse({
      token,
      user: { id: userId, email, name },
    }, 201);
  } catch (error) {
    console.error('Register error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleLogin(request, env) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return jsonResponse({ error: 'Validation failed' }, 400);
  }

  try {
    const user = await env.DB.prepare(
      'SELECT id, email, name, password_hash FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }

    const token = await createJWT({ userId: user.id }, env.JWT_SECRET);

    return jsonResponse({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleGetMe(request, env) {
  const userId = await verifyToken(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const user = await env.DB.prepare(
      'SELECT id, email, name, created_at FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return jsonResponse({ error: 'User not found' }, 404);
    }

    return jsonResponse(user);
  } catch (error) {
    console.error('Get user error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleGetTasks(request, env) {
  const userId = await verifyToken(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const url = new URL(request.url);
    const completed = url.searchParams.get('completed');

    let query = 'SELECT id, title, description, completed, created_at, updated_at FROM tasks WHERE user_id = ?';
    let stmt = env.DB.prepare(query).bind(userId);

    if (completed !== null) {
      query += ' AND completed = ?';
      stmt = env.DB.prepare(query).bind(userId, completed === 'true' ? 1 : 0);
    }

    const { results } = await stmt.all();

    const tasks = results.map(task => ({
      ...task,
      completed: task.completed === 1,
    }));

    return jsonResponse({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleCreateTask(request, env) {
  const userId = await verifyToken(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const { title, description = '' } = await request.json();

    if (!title || title.trim().length === 0) {
      return jsonResponse({ error: 'Title is required' }, 400);
    }

    const result = await env.DB.prepare(
      'INSERT INTO tasks (user_id, title, description) VALUES (?, ?, ?)'
    ).bind(userId, title, description).run();

    const taskId = result.meta.last_row_id;

    const task = await env.DB.prepare(
      'SELECT id, title, description, completed, created_at, updated_at FROM tasks WHERE id = ?'
    ).bind(taskId).first();

    return jsonResponse({
      task: {
        ...task,
        completed: task.completed === 1,
      },
    }, 201);
  } catch (error) {
    console.error('Create task error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleUpdateTask(request, env, taskId) {
  const userId = await verifyToken(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const { title, description, completed } = await request.json();

    const existing = await env.DB.prepare(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ?'
    ).bind(taskId, userId).first();

    if (!existing) {
      return jsonResponse({ error: 'Task not found' }, 404);
    }

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (completed !== undefined) {
      updates.push('completed = ?');
      params.push(completed ? 1 : 0);
    }

    if (updates.length === 0) {
      return jsonResponse({ error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(taskId, userId);

    await env.DB.prepare(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...params).run();

    const task = await env.DB.prepare(
      'SELECT id, title, description, completed, created_at, updated_at FROM tasks WHERE id = ?'
    ).bind(taskId).first();

    return jsonResponse({
      task: {
        ...task,
        completed: task.completed === 1,
      },
    });
  } catch (error) {
    console.error('Update task error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleDeleteTask(request, env, taskId) {
  const userId = await verifyToken(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await env.DB.prepare(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?'
    ).bind(taskId, userId).run();

    if (result.meta.changes === 0) {
      return jsonResponse({ error: 'Task not found' }, 404);
    }

    return jsonResponse({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

// Main request handler
export default {
  async fetch(request, env, ctx) {
    // Handle OPTIONS for CORS
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Initialize database on first request
    await initDatabase(env);

    const url = new URL(request.url);
    const path = url.pathname;

    // Route matching
    if (path === '/api/auth/register' && request.method === 'POST') {
      return handleRegister(request, env);
    }

    if (path === '/api/auth/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    if (path === '/api/auth/me' && request.method === 'GET') {
      return handleGetMe(request, env);
    }

    if (path === '/api/tasks' && request.method === 'GET') {
      return handleGetTasks(request, env);
    }

    if (path === '/api/tasks' && request.method === 'POST') {
      return handleCreateTask(request, env);
    }

    if (path.startsWith('/api/tasks/') && request.method === 'PUT') {
      const taskId = parseInt(path.split('/')[3]);
      return handleUpdateTask(request, env, taskId);
    }

    if (path.startsWith('/api/tasks/') && request.method === 'DELETE') {
      const taskId = parseInt(path.split('/')[3]);
      return handleDeleteTask(request, env, taskId);
    }

    if (path === '/api/health' && request.method === 'GET') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    return jsonResponse({ error: 'Route not found' }, 404);
  },
};
