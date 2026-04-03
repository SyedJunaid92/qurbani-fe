import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBookings } from '../api/client.js';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** Distinct cow numbers for this booking (1-based), sorted */
function formatCowNumbers(booking) {
  const segs = booking.allocations;
  if (!Array.isArray(segs) || segs.length === 0) return '—';
  const cows = [...new Set(segs.map((s) => s.cowNumber).filter((n) => n != null))].sort(
    (a, b) => a - b
  );
  if (cows.length === 0) return '—';
  if (cows.length === 1) return String(cows[0]);
  return cows.join(', ');
}

export default function BookingsList() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBookings();
        if (!cancelled) setBookings(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Loading bookings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="error">{error}</p>
        <p className="muted">Ensure the API is running and MongoDB is available.</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="card">
        <p>No bookings yet.</p>
        <Link to="/new" className="btn" style={{ marginTop: '1rem' }}>
          Add first booking
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Shares</th>
            <th>Cow(s)</th>
            <th>Booked</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b._id}>
              <td>{b.name}</td>
              <td>{b.contact}</td>
              <td>{b.shares}</td>
              <td>{formatCowNumbers(b)}</td>
              <td>{formatDate(b.created_at)}</td>
              <td>
                <Link to={`/bookings/${b._id}`}>Details</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
