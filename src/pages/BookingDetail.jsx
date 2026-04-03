import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchBooking } from '../api/client.js';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBooking(id);
        if (!cancelled) setBooking(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="card">
        <p className="error">{error || 'Not found'}</p>
        <Link to="/">Back to list</Link>
      </div>
    );
  }

  return (
    <div className="card">
      <p>
        <Link to="/">← All bookings</Link>
      </p>
      <h2 style={{ marginTop: '0.5rem' }}>{booking.name}</h2>
      <p>
        <strong>Phone:</strong> {booking.contact}
      </p>
      <p>
        <strong>Total shares:</strong> {booking.shares}
      </p>
      <p className="muted">
        <strong>Created:</strong> {formatDate(booking.created_at)}
        <br />
        <strong>Updated:</strong> {formatDate(booking.updated_at)}
      </p>
      <h3 style={{ marginBottom: '0.5rem' }}>Cow & share allocation</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Each cow has 7 shares; cow numbers start at 1. Bookings use the next cow that fits the full
        requested block (or split into blocks of up to 7). Exact share numbers are stored on the booking.
      </p>
      <ul className="segments">
        {(booking.allocations || []).map((seg, i) => (
          <li key={i}>
            Cow <strong>{seg.cowNumber}</strong>: share slot(s){' '}
            <strong>
              {Array.isArray(seg.shareNumbers) && seg.shareNumbers.length
                ? seg.shareNumbers.join(', ')
                : `${seg.fromShare}–${seg.toShare}`}
            </strong>
            {seg.shareCount != null && (
              <>
                {' '}
                (<strong>{seg.shareCount}</strong> share{seg.shareCount !== 1 ? 's' : ''} on this cow)
              </>
            )}
          </li>
        ))}
      </ul>
      {(booking.cowShareAssignments || []).length > 0 && (
        <>
          <h4 style={{ marginBottom: '0.35rem' }}>Full list (cow → share)</h4>
          <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
            {booking.cowShareAssignments.map((a, i) => (
              <span key={i} className="badge">
                Cow {a.cowNumber} · share {a.shareNumber}
              </span>
            ))}
          </p>
        </>
      )}
      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/new" className="btn">
          Add another booking
        </Link>
      </p>
    </div>
  );
}
