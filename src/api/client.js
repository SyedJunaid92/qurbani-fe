const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('Invalid response from server');
  }
  if (!res.ok) {
    const msg = data?.error || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

export function fetchBookings() {
  return request('/bookings');
}

export function fetchBooking(id) {
  return request(`/bookings/${id}`);
}

export function createBooking(body) {
  return request('/bookings', { method: 'POST', body: JSON.stringify(body) });
}
