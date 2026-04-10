const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const TOKEN_KEY = 'qurbani_token';
export const USER_KEY = 'qurbani_user';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function clearSession() {
  setSession(null, null);
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('Invalid response from server');
  }

  if (res.status === 401 && token) {
    clearSession();
    window.location.assign('/login');
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const msg = data?.error || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

export async function loginRequest(email, password) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('Invalid response from server');
  }
  if (!res.ok) {
    throw new Error(data?.error || 'Login failed');
  }
  return data;
}

export function fetchBookings() {
  return request('/bookings');
}

export function fetchBooking(id) {
  return request(`/bookings/${id}`);
}

export function updateBookingShareDetails(id, shareParticipantDetails) {
  return request(`/bookings/${id}/share-details`, {
    method: 'PATCH',
    body: JSON.stringify({ shareParticipantDetails })
  });
}

export function createBooking(body) {
  return request('/bookings', { method: 'POST', body: JSON.stringify(body) });
}

export function fetchAdminUsers() {
  return request('/admin/users');
}

export function createAdminUser(body) {
  return request('/admin/users', { method: 'POST', body: JSON.stringify(body) });
}
