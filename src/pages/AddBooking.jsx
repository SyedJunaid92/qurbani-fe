import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createBooking } from '../api/client.js';

export default function AddBooking() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [shares, setShares] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const shareNum = parseInt(shares, 10);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!contact.trim()) {
      setError('Phone number is required');
      return;
    }
    if (!Number.isInteger(shareNum) || shareNum < 1) {
      setError('Shares must be a whole number of at least 1');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createBooking({
        name: name.trim(),
        contact: contact.trim(),
        shares: shareNum
      });
      navigate(`/bookings/${created._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <p>
        <Link to="/">← All bookings</Link>
      </p>
      <h2 style={{ marginTop: '0.5rem' }}>Add booking</h2>
      <p className="muted">
        Enter the participant&apos;s details. Shares are assigned automatically across cows (7
        shares per cow, cows numbered from 1).
      </p>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="contact">Phone</label>
        <input
          id="contact"
          name="contact"
          type="tel"
          autoComplete="tel"
          placeholder="e.g. +923001234567"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />

        <label htmlFor="shares">Shares</label>
        <input
          id="shares"
          name="shares"
          type="number"
          min={1}
          step={1}
          value={shares}
          onChange={(e) => setShares(e.target.value)}
        />

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save booking'}
        </button>
      </form>
    </div>
  );
}
