import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all tasks for the authenticated user
router.get('/', (req, res) => {
  try {
    const { completed } = req.query;
    
    let query = 'SELECT id, title, description, completed, created_at, updated_at FROM tasks WHERE user_id = ?';
    const params = [req.userId];

    if (completed !== undefined) {
      query += ' AND completed = ?';
      params.push(completed === 'true' ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC';

    const tasks = db.prepare(query).all(...params);

    // Convert completed from 0/1 to boolean
    const formattedTasks = tasks.map(task => ({
      ...task,
      completed: task.completed === 1
    }));

    res.json({ tasks: formattedTasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new task
router.post('/',
  body('title').trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { title, description = '' } = req.body;

    try {
      const result = db.prepare(
        'INSERT INTO tasks (user_id, title, description) VALUES (?, ?, ?)'
      ).run(req.userId, title, description);

      const taskId = result.lastInsertRowid;

      const task = db.prepare(
        'SELECT id, title, description, completed, created_at, updated_at FROM tasks WHERE id = ?'
      ).get(taskId);

      res.status(201).json({
        task: {
          ...task,
          completed: task.completed === 1
        }
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update a task
router.put('/:id',
  body('title').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('completed').optional().isBoolean(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { title, description, completed } = req.body;

    try {
      // Check if task exists and belongs to user
      const existingTask = db.prepare(
        'SELECT id FROM tasks WHERE id = ? AND user_id = ?'
      ).get(id, req.userId);

      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Build update query dynamically
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
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id, req.userId);

      db.prepare(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
      ).run(...params);

      const task = db.prepare(
        'SELECT id, title, description, completed, created_at, updated_at FROM tasks WHERE id = ?'
      ).get(id);

      res.json({
        task: {
          ...task,
          completed: task.completed === 1
        }
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete a task
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const result = db.prepare(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?'
    ).run(id, req.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
