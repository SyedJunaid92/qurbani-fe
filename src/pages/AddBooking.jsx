import { useState } from 'react';
import toast from 'react-hot-toast';
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
      const msg = 'Name is required';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!contact.trim()) {
      const msg = 'Phone number is required';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!Number.isInteger(shareNum) || shareNum < 1) {
      const msg = 'Shares must be a whole number of at least 1';
      setError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createBooking({
        name: name.trim(),
        contact: contact.trim(),
        shares: shareNum
      });
      toast.success('Booking created');
      navigate(`/bookings/${created._id}`);
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Could not create booking');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card form-card">
      <p>
        <Link to="/">← All bookings</Link>
      </p>
      <h2 style={{ marginTop: '0.5rem' }}>Add booking</h2>
      <p className="muted">
        Enter the participant&apos;s details. Up to 7 shares stay on one cow; if your count does
        not fit the free slots on the earliest partial cow, the next cow is used and the leftover
        slots are filled by later bookings. Cows are numbered from 1.
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
