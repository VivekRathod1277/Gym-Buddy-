import axios from 'axios';

const hostname = window.location.hostname;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.');

// If we're on a local network, try to connect to the local python backend by default.
// Otherwise, use the production render URL.
const LOCAL_API_URL = `http://${hostname}:8000/api`;
const PROD_API_URL = 'https://gym-buddy-rkqw.onrender.com/api';

const API_URL = import.meta.env.VITE_API_URL || (isLocal ? LOCAL_API_URL : PROD_API_URL);

export const api = axios.create({
  baseURL: API_URL,
});

// Export network configs for WebSocket usage across the app
export const API_BASE = import.meta.env.VITE_API_BASE || (isLocal ? `http://${hostname}:8000` : 'https://gym-buddy-rkqw.onrender.com');
export const WS_URL = import.meta.env.VITE_WS_URL || (isLocal ? `ws://${hostname}:8000` : 'wss://gym-buddy-rkqw.onrender.com');

// Add a request interceptor to automatically add the JWT token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
