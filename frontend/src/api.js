const API_BASE = 'http://localhost:4000/api';

export const request = async (path, options = {}) => {
  const token = localStorage.getItem('erp_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
};