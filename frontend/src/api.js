import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (email, password, name) =>
    api.post('/auth/register', { email, password, name }),
  
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  
  getMe: () =>
    api.get('/auth/me'),
};

// Tasks API
export const tasksAPI = {
  getTasks: (completed) => {
    const params = completed !== undefined ? { completed } : {};
    return api.get('/tasks', { params });
  },
  
  createTask: (title, description) =>
    api.post('/tasks', { title, description }),
  
  updateTask: (id, updates) =>
    api.put(`/tasks/${id}`, updates),
  
  deleteTask: (id) =>
    api.delete(`/tasks/${id}`),
};

export default api;
