import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import { fetchBooking, updateBookingShareDetails } from '../api/client.js';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function buildShareRows(booking) {
  const assignments = booking.cowShareAssignments || [];
  const details = booking.shareParticipantDetails || [];
  return assignments.map((a) => {
    const d = details.find(
      (x) => x.cowNumber === a.cowNumber && x.shareNumber === a.shareNumber
    );
    return {
      cowNumber: a.cowNumber,
      shareNumber: a.shareNumber,
      name: d?.name ?? '',
      contact: d?.contact ?? '',
      address: d?.address ?? ''
    };
  });
}

export default function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [shareRows, setShareRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBooking(id);
        if (!cancelled) {
          setBooking(data);
          setShareRows(buildShareRows(data));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          toast.error(e.message || 'Could not load booking');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateRow(index, field, value) {
    setShareRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function handleSaveShares(e) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateBookingShareDetails(id, shareRows);
      setBooking(updated);
      setShareRows(buildShareRows(updated));
      toast.success('Share details saved');
    } catch (err) {
      const msg = err.message || 'Could not save';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

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
    <div className="card booking-detail">
      <p>
        <Link to="/">← All bookings</Link>
      </p>
      <h2 className="booking-detail__title">{booking.name}</h2>
      <p>
        <strong>Booking contact:</strong> {booking.contact}
      </p>
      <p>
        <strong>Total shares:</strong> {booking.shares}
      </p>
      <p>
        <strong>Recorded by:</strong>{' '}
        {booking.created_by?.name || booking.created_by?.email || '—'}
      </p>
      <p className="muted">
        <strong>Created:</strong> {formatDate(booking.created_at)}
        <br />
        <strong>Updated:</strong> {formatDate(booking.updated_at)}
      </p>

      <h3 className="booking-detail__section-title">Cow & share allocation</h3>
      <p className="muted booking-detail__section-intro">
        Each cow has 7 shares; cow numbers start at 1. Below, add the participant for each share
        slot (name, contact, address).
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
                (<strong>{seg.shareCount}</strong> share{seg.shareCount !== 1 ? 's' : ''} on this
                cow)
              </>
            )}
          </li>
        ))}
      </ul>

      {shareRows.length > 0 && (
        <form className="share-slots-form" onSubmit={handleSaveShares}>
          <h3 className="booking-detail__section-title">Details per share</h3>
          {saveError && <p className="error">{saveError}</p>}
          <div className="share-slots-list">
            {shareRows.map((row, index) => (
              <fieldset key={`${row.cowNumber}-${row.shareNumber}`} className="share-slot">
                <legend className="share-slot__legend">
                  Cow {row.cowNumber} · share {row.shareNumber}
                </legend>
                <div className="share-slot__fields">
                  <div className="form-field">
                    <label htmlFor={`sn-${index}`}>Name</label>
                    <input
                      id={`sn-${index}`}
                      value={row.name}
                      onChange={(e) => updateRow(index, 'name', e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor={`sc-${index}`}>Contact</label>
                    <input
                      id={`sc-${index}`}
                      type="tel"
                      value={row.contact}
                      onChange={(e) => updateRow(index, 'contact', e.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="form-field form-field--full">
                    <label htmlFor={`sa-${index}`}>Address</label>
                    <textarea
                      id={`sa-${index}`}
                      className="input-textarea"
                      rows={2}
                      value={row.address}
                      onChange={(e) => updateRow(index, 'address', e.target.value)}
                      autoComplete="street-address"
                    />
                  </div>
                </div>
              </fieldset>
            ))}
          </div>
          <div className="share-slots-actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save share details'}
            </button>
          </div>
        </form>
      )}

      <p className="booking-detail__footer-actions">
        <Link to="/new" className="btn">
          Add another booking
        </Link>
      </p>
    </div>
  );
}
