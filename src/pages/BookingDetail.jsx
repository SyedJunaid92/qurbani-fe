import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal.jsx';
import {
  deleteBooking,
  fetchAllocationOptions,
  fetchBooking,
  patchBooking,
  updateBookingAllocationDetails
} from '../api/client.js';

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

function rawCowShares(rawByCow, cow) {
  const key = String(cow);
  const arr = rawByCow?.[key] ?? rawByCow?.[cow];
  return new Set(Array.isArray(arr) ? arr : []);
}

/** Shares 1–7 free for this row: not taken by other bookings, not used by another row in this draft */
function shareChoicesForRow(options, rows, rowIndex, cow) {
  const c = Number(cow);
  if (!options || !Number.isInteger(c) || c < 1) return [1, 2, 3, 4, 5, 6, 7];
  const takenOthers = rawCowShares(options.rawByCow, c);
  const out = [];
  for (let s = 1; s <= 7; s += 1) {
    if (takenOthers.has(s)) continue;
    let clash = false;
    for (let j = 0; j < rows.length; j += 1) {
      if (j === rowIndex) continue;
      if (Number(rows[j].cowNumber) === c && Number(rows[j].shareNumber) === s) {
        clash = true;
        break;
      }
    }
    if (!clash) out.push(s);
  }
  return out;
}

function cowChoicesForRow(options, rows, rowIndex) {
  const maxCow = Math.max(1, Number(options?.maxCow) || 1);
  const list = [];
  for (let c = 1; c <= maxCow; c += 1) {
    if (shareChoicesForRow(options, rows, rowIndex, c).length > 0) list.push(c);
  }
  const cur = Number(rows[rowIndex]?.cowNumber);
  if (Number.isInteger(cur) && cur >= 1 && !list.includes(cur)) {
    list.push(cur);
    list.sort((a, b) => a - b);
  }
  return list.length ? list : [1];
}

function withSortedUniqueShares(shares, currentShare) {
  const cur = Number(currentShare);
  const set = new Set(shares);
  if (Number.isInteger(cur) && cur >= 1 && cur <= 7 && !set.has(cur)) {
    set.add(cur);
  }
  return [...set].sort((a, b) => a - b);
}

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [shareRows, setShareRows] = useState([]);
  const [allocationOptions, setAllocationOptions] = useState(null);
  const [shareCountInput, setShareCountInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingCount, setUpdatingCount] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const loadOptions = useCallback(async () => {
    const opts = await fetchAllocationOptions(id);
    setAllocationOptions(opts);
    return opts;
  }, [id]);

  const optionsForUi = useMemo(() => {
    if (allocationOptions) return allocationOptions;
    const fb =
      booking?.cowShareAssignments?.length > 0
        ? Math.max(1, ...booking.cowShareAssignments.map((a) => Number(a.cowNumber) || 0)) + 1
        : 1;
    return { maxCow: fb, rawByCow: {}, prefixByCow: {}, currentAssignments: [] };
  }, [allocationOptions, booking]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBooking(id);
        if (!cancelled) {
          setBooking(data);
          setShareRows(buildShareRows(data));
          if (data?.shares != null) setShareCountInput(String(data.shares));
        }
        try {
          const opts = await fetchAllocationOptions(id);
          if (!cancelled) setAllocationOptions(opts);
        } catch {
          if (!cancelled) toast.error('Could not load slot options');
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

  function updateRowCow(index, newCow) {
    const cow = Number(newCow);
    setShareRows((rows) => {
      const draft = rows.map((row, i) =>
        i === index ? { ...row, cowNumber: cow } : row
      );
      const choices = shareChoicesForRow(optionsForUi, draft, index, cow);
      const curShare = Number(draft[index].shareNumber);
      const share =
        choices.includes(curShare) && choices.length
          ? curShare
          : choices[0] ?? draft[index].shareNumber;
      return draft.map((row, i) =>
        i === index ? { ...row, cowNumber: cow, shareNumber: share } : row
      );
    });
  }

  async function handleUpdateShareCount(e) {
    e.preventDefault();
    const n = Number(shareCountInput);
    if (!Number.isInteger(n) || n < 1) {
      toast.error('Enter a whole number of shares (at least 1)');
      return;
    }
    setUpdatingCount(true);
    try {
      const updated = await patchBooking(id, { shares: n });
      setBooking(updated);
      setShareRows(buildShareRows(updated));
      setShareCountInput(String(updated.shares));
      await loadOptions();
      toast.success('Total shares updated');
    } catch (err) {
      toast.error(err.message || 'Could not update share count');
    } finally {
      setUpdatingCount(false);
    }
  }

  async function executeDeleteBooking() {
    setDeleting(true);
    try {
      await deleteBooking(id);
      setDeleteModalOpen(false);
      toast.success('Booking deleted');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Could not delete');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveShares(e) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    const cowShareAssignments = shareRows.map((r) => ({
      cowNumber: Number(r.cowNumber),
      shareNumber: Number(r.shareNumber)
    }));
    const shareParticipantDetails = shareRows.map((r) => ({
      cowNumber: Number(r.cowNumber),
      shareNumber: Number(r.shareNumber),
      name: r.name,
      contact: r.contact,
      address: r.address
    }));
    try {
      const updated = await updateBookingAllocationDetails(id, {
        cowShareAssignments,
        shareParticipantDetails
      });
      setBooking(updated);
      setShareRows(buildShareRows(updated));
      if (updated?.shares != null) setShareCountInput(String(updated.shares));
      await loadOptions();
      toast.success('Share slots and details saved');
    } catch (err) {
      const msg = err.message || 'Could not save';
      setSaveError(msg);
      toast.error(msg);
      try {
        const fresh = await fetchBooking(id);
        setBooking(fresh);
        setShareRows(buildShareRows(fresh));
        await loadOptions();
      } catch {
        /* ignore */
      }
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
      <ConfirmModal
        open={deleteModalOpen}
        title="Delete this booking?"
        confirmLabel="Delete booking"
        cancelLabel="Keep booking"
        danger
        busy={deleting}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        onConfirm={executeDeleteBooking}
      >
        <p>
          This will permanently remove the booking for <strong>{booking.name}</strong> and free all
          cow/share slots. This cannot be undone.
        </p>
      </ConfirmModal>
      <p>
        <Link to="/">← All bookings</Link>
      </p>
      <h2 className="booking-detail__title">{booking.name}</h2>
      <p>
        <strong>Booking contact:</strong> {booking.contact}
      </p>
      <form className="booking-detail__share-count" onSubmit={handleUpdateShareCount}>
        <div className="form-field booking-detail__share-count-field">
          <label htmlFor="booking-share-count">Total shares</label>
          <div className="booking-detail__share-count-row">
            <input
              id="booking-share-count"
              type="number"
              min={1}
              step={1}
              value={shareCountInput}
              onChange={(e) => setShareCountInput(e.target.value)}
            />
            <button type="submit" className="btn btn--small" disabled={updatingCount}>
              {updatingCount ? 'Updating…' : 'Update count'}
            </button>
          </div>
        </div>
        <p className="muted booking-detail__share-count-hint">
          Increasing adds new share rows (auto-allocated). Decreasing removes the{' '}
          <strong>last</strong> share slots and their details. Save slot edits first if you need
          them kept before changing the count.
        </p>
      </form>
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
        Each cow has 7 shares; cow numbers start at 1. Choose the cow (and a preferred share) per
        row; when you save, share numbers on each cow are packed consecutively after other
        bookings so the grid stays valid. Only slots not taken by other bookings are listed.
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
            {shareRows.map((row, index) => {
              const cowList = cowChoicesForRow(optionsForUi, shareRows, index);
              const shareList = withSortedUniqueShares(
                shareChoicesForRow(optionsForUi, shareRows, index, row.cowNumber),
                row.shareNumber
              );
              return (
                <fieldset key={index} className="share-slot">
                  <legend className="share-slot__legend">Share {index + 1}</legend>
                  <div className="share-slot__fields share-slot__fields--with-allocation">
                    <div className="form-field">
                      <label htmlFor={`cow-${index}`}>Cow</label>
                      <select
                        id={`cow-${index}`}
                        value={String(row.cowNumber)}
                        onChange={(e) => updateRowCow(index, e.target.value)}
                      >
                        {cowList.map((c) => (
                          <option key={c} value={String(c)}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor={`share-${index}`}>Share</label>
                      <select
                        id={`share-${index}`}
                        value={String(row.shareNumber)}
                        onChange={(e) =>
                          updateRow(index, 'shareNumber', Number(e.target.value))
                        }
                      >
                        {shareList.map((s) => (
                          <option key={s} value={String(s)}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
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
              );
            })}
          </div>
          <div className="share-slots-actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save slots & details'}
            </button>
          </div>
        </form>
      )}

      <p className="booking-detail__footer-actions">
        <Link to="/new" className="btn">
          Add another booking
        </Link>
        <button
          type="button"
          className="btn btn--danger"
          disabled={deleting}
          onClick={() => setDeleteModalOpen(true)}
        >
          Delete booking
        </button>
      </p>
    </div>
  );
}
