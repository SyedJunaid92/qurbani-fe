import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal.jsx";
import {
  deleteBooking,
  downloadExportExcel,
  fetchBookingCowNumbers,
  fetchBookings,
} from "../api/client.js";
import { useDebounce } from "../hooks/useDebounce.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  digitsForWhatsApp,
  whatsAppDigitsHint,
} from "../utils/whatsappPhone.js";

const LIMIT_OPTIONS = [10, 20, 30, 50];
const DEBOUNCE_MS = 350;

const PAYMENT_FILTER_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatCowNumbers(booking) {
  const segs = booking.allocations;
  if (!Array.isArray(segs) || segs.length === 0) return "—";
  const cows = [
    ...new Set(segs.map((s) => s.cowNumber).filter((n) => n != null)),
  ].sort((a, b) => a - b);
  if (cows.length === 0) return "—";
  if (cows.length === 1) return String(cows[0]);
  return cows.join(", ");
}

function recordedByLabel(booking) {
  const c = booking.created_by;
  if (!c) return "—";
  if (typeof c === "object") return c.name || c.email || "—";
  return "—";
}

function paymentStatusLabel(status) {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  return "Pending";
}

function envStr(key) {
  const v = import.meta.env[key];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function eidContactLines() {
  const out = [];
  for (let i = 1; i <= 3; i += 1) {
    const name = envStr(`VITE_CONTACT_NAME_${i}`);
    const num = envStr(`VITE_CONTACT_NUMBER_${i}`);
    if (name && num) out.push(`• ${name}: ${num}`);
    else if (num) out.push(`• ${num}`);
    else if (name) out.push(`• ${name}`);
  }
  return out;
}

function buildWhatsAppMessage(booking) {
  const perSharePrice = envStr("VITE_PER_SHARE_PRICE");
  const bankTitle = envStr("VITE_BANK_ACCOUNT_NAME");
  const bankName = envStr("VITE_BANK_NAME");
  const accountNo = envStr("VITE_BANK_ACCOUNT_NUMBER");
  const hasBank = Boolean(bankTitle || bankName || accountNo);
  const contacts = eidContactLines();

  const lines = [
    `Salam ${booking.name},`,
    "",
    "Please find your Qurbani booking summary below.",
    "",
    `Total shares: ${booking.shares}`,
    "",
  ];
  const segs = booking.allocations ?? [];
  if (segs.length) {
    lines.push("Cow and share allocation:");
    for (const seg of segs) {
      const nums =
        Array.isArray(seg.shareNumbers) && seg.shareNumbers.length
          ? seg.shareNumbers.join(", ")
          : `${seg.fromShare}–${seg.toShare}`;
      lines.push(`• Cow ${seg.cowNumber}: share(s) ${nums}`);
    }
    lines.push("");
  }

  lines.push(
    "Please share the full name, contact number, and residential address for each share holder (for every share in this booking).",
  );
  lines.push("");

  if (hasBank) {
    lines.push("Payment details");
    lines.push(`Per share price: ${perSharePrice}`);
    lines.push(`Total price: ${perSharePrice * booking.shares}`);
    lines.push(
      "Kindly transfer your payment to the following bank account. When you have paid, you may share the transfer receipt with us for our records.",
    );
    lines.push("");
    if (bankTitle) lines.push(`Account title: ${bankTitle}`);
    if (bankName) lines.push(`Bank: ${bankName}`);
    if (accountNo) lines.push(`Account number / IBAN: ${accountNo}`);
    lines.push("");
  }

  if (contacts.length) {
    lines.push(
      "On Eid day, for pickup, timing, or any urgent queries, please contact one of the numbers below.",
    );
    lines.push("");
    lines.push(...contacts);
    lines.push("");
  }

  lines.push("Thank you for entrusting us with your Qurbani.");
  return lines.join("\n");
}

function getWhatsAppPayload(booking) {
  const phone = digitsForWhatsApp(booking.contact);
  if (!phone) return null;
  const plain = buildWhatsAppMessage(booking);
  const encoded = encodeURIComponent(plain);
  return { phone, encoded };
}

function toastBadPhone() {
  toast.error(
    `This number could not be used for WhatsApp. ${whatsAppDigitsHint()}`,
    { duration: 7000 },
  );
}

function openWhatsAppNative(booking) {
  const p = getWhatsAppPayload(booking);
  if (!p) {
    toastBadPhone();
    return;
  }
  const url = `whatsapp://send?phone=${p.phone}&text=${p.encoded}`;
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("rel", "noopener noreferrer");
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openWhatsAppWeb(booking) {
  const p = getWhatsAppPayload(booking);
  if (!p) {
    toastBadPhone();
    return;
  }
  const url = `https://api.whatsapp.com/send?phone=${p.phone}&text=${p.encoded}`;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function copyWhatsAppMessage(booking) {
  const body = buildWhatsAppMessage(booking);
  try {
    await navigator.clipboard.writeText(body);
    toast.success("Message copied — paste it in WhatsApp for this contact.");
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = body;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Message copied — paste it in WhatsApp for this contact.");
    } catch {
      toast.error("Could not copy. Select the text manually if needed.");
    }
  }
}

function PaymentMultiSelect({
  value,
  onChange,
  open,
  onOpenChange,
  containerRef,
}) {
  const toggle = (v) => {
    const set = new Set(value);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    const order = PAYMENT_FILTER_OPTIONS.map((o) => o.value);
    onChange(order.filter((x) => set.has(x)));
  };

  const summary =
    value.length === 0
      ? "All statuses"
      : value.length === PAYMENT_FILTER_OPTIONS.length
        ? "All statuses"
        : value.length <= 2
          ? value
              .map(
                (v) => PAYMENT_FILTER_OPTIONS.find((o) => o.value === v)?.label ?? v,
              )
              .join(", ")
          : `${value.length} selected`;

  return (
    <div className="bookings-field bookings-field--cow" ref={containerRef}>
      <label>Payment</label>
      <div className="cow-multi">
        <button
          type="button"
          className={`cow-multi__trigger ${open ? "cow-multi__trigger--open" : ""}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => onOpenChange(!open)}
        >
          <span className="cow-multi__trigger-text">{summary}</span>
          <span className="cow-multi__chev" aria-hidden>
            ▾
          </span>
        </button>
        {open && (
          <div className="cow-multi__panel" role="listbox">
            <div className="cow-multi__actions">
              <button
                type="button"
                className="cow-multi__link"
                onClick={() =>
                  onChange(PAYMENT_FILTER_OPTIONS.map((o) => o.value))
                }
              >
                Select all
              </button>
              <button
                type="button"
                className="cow-multi__link"
                onClick={() => onChange([])}
              >
                Clear (all)
              </button>
            </div>
            <ul className="cow-multi__list">
              {PAYMENT_FILTER_OPTIONS.map((o) => (
                <li key={o.value}>
                  <label className="cow-multi__row">
                    <input
                      type="checkbox"
                      checked={value.includes(o.value)}
                      onChange={() => toggle(o.value)}
                    />
                    <span>{o.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function CowMultiSelect({
  options,
  value,
  onChange,
  open,
  onOpenChange,
  containerRef,
}) {
  const toggle = (n) => {
    const set = new Set(value);
    if (set.has(n)) set.delete(n);
    else set.add(n);
    onChange([...set].sort((a, b) => a - b));
  };

  const summary =
    value.length === 0
      ? "All cows"
      : value.length <= 2
        ? value.map(String).join(", ")
        : `${value.length} selected`;

  return (
    <div className="bookings-field bookings-field--cow" ref={containerRef}>
      <label>Cow number</label>
      <div className="cow-multi">
        <button
          type="button"
          className={`cow-multi__trigger ${open ? "cow-multi__trigger--open" : ""}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => onOpenChange(!open)}
        >
          <span className="cow-multi__trigger-text">{summary}</span>
          <span className="cow-multi__chev" aria-hidden>
            ▾
          </span>
        </button>
        {open && (
          <div className="cow-multi__panel" role="listbox">
            {options.length === 0 ? (
              <p className="cow-multi__empty muted">No cow numbers in your data yet.</p>
            ) : (
              <>
                <div className="cow-multi__actions">
                  <button
                    type="button"
                    className="cow-multi__link"
                    onClick={() => onChange([...options])}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="cow-multi__link"
                    onClick={() => onChange([])}
                  >
                    Clear
                  </button>
                </div>
                <ul className="cow-multi__list">
                  {options.map((n) => (
                    <li key={n}>
                      <label className="cow-multi__row">
                        <input
                          type="checkbox"
                          checked={value.includes(n)}
                          onChange={() => toggle(n)}
                        />
                        <span>Cow {n}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookingsList() {
  const { isAdmin } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [contactInput, setContactInput] = useState("");
  const [selectedCows, setSelectedCows] = useState([]);
  const [cowOptions, setCowOptions] = useState([]);
  const [cowPopoverOpen, setCowPopoverOpen] = useState(false);
  const cowWrapRef = useRef(null);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [paymentPopoverOpen, setPaymentPopoverOpen] = useState(false);
  const paymentWrapRef = useRef(null);

  const debouncedName = useDebounce(nameInput, DEBOUNCE_MS);
  const debouncedContact = useDebounce(contactInput, DEBOUNCE_MS);
  const cowsKey = useMemo(
    () => selectedCows.slice().sort((a, b) => a - b).join(","),
    [selectedCows],
  );
  const paymentsKey = useMemo(
    () => selectedPayments.slice().sort().join(","),
    [selectedPayments],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  const deleteModalBusy =
    Boolean(deleteModal) && deletingId === deleteModal._id;

  useLayoutEffect(() => {
    setPage(1);
  }, [debouncedName, debouncedContact, cowsKey, paymentsKey]);

  const loadBookings = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetchBookings({
        page,
        limit,
        name: debouncedName,
        contact: debouncedContact,
        cows: selectedCows,
        payments: selectedPayments,
      });
      setBookings(res.data ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
      if (res.page != null && res.page !== page) setPage(res.page);
    } catch (e) {
      setError(e.message);
      toast.error(e.message || "Could not load bookings");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [page, limit, debouncedName, debouncedContact, selectedCows, selectedPayments]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nums = await fetchBookingCowNumbers();
        if (!cancelled) setCowOptions(Array.isArray(nums) ? nums : []);
      } catch {
        if (!cancelled) setCowOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (cowPopoverOpen) {
        const el = cowWrapRef.current;
        if (el && !el.contains(e.target)) setCowPopoverOpen(false);
      }
      if (paymentPopoverOpen) {
        const el = paymentWrapRef.current;
        if (el && !el.contains(e.target)) setPaymentPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [cowPopoverOpen, paymentPopoverOpen]);

  async function executeListDelete() {
    if (!deleteModal) return;
    setDeletingId(deleteModal._id);
    try {
      await deleteBooking(deleteModal._id);
      setDeleteModal(null);
      toast.success("Booking deleted");
      await loadBookings();
    } catch (e) {
      toast.error(e.message || "Could not delete");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      await downloadExportExcel();
      toast.success("Excel file downloaded");
    } catch (err) {
      toast.error(err.message || "Could not export data");
    } finally {
      setExporting(false);
    }
  }

  const paymentFilterActive =
    selectedPayments.length > 0 &&
    selectedPayments.length < PAYMENT_FILTER_OPTIONS.length;

  const hasActiveFilters =
    debouncedName.trim() !== "" ||
    debouncedContact.trim() !== "" ||
    selectedCows.length > 0 ||
    paymentFilterActive;

  const fromIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const toIdx = total === 0 ? 0 : Math.min(page * limit, total);

  if (loading && bookings.length === 0 && !error) {
    return (
      <div className="card">
        <p className="muted">Loading bookings…</p>
      </div>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <div className="card">
        <p className="error">{error}</p>
        <p className="muted">
          Ensure the API is running and MongoDB is available.
        </p>
      </div>
    );
  }

  return (
    <div className="card bookings-page">
      <ConfirmModal
        open={deleteModal != null}
        title="Delete this booking?"
        confirmLabel="Delete booking"
        cancelLabel="Keep booking"
        danger
        busy={deleteModalBusy}
        onClose={() => !deleteModalBusy && setDeleteModal(null)}
        onConfirm={executeListDelete}
      >
        <p>
          This will permanently remove the booking for{" "}
          <strong>{deleteModal?.name}</strong> and free all cow/share slots.
          This cannot be undone.
        </p>
      </ConfirmModal>

      <div className="bookings-toolbar">
        <div className="bookings-toolbar__filters">
          <div className="bookings-field">
            <label htmlFor="filter-name">Name</label>
            <input
              id="filter-name"
              type="search"
              className="bookings-input"
              placeholder="Search by name…"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="bookings-field">
            <label htmlFor="filter-contact">Contact</label>
            <input
              id="filter-contact"
              type="search"
              className="bookings-input"
              placeholder="Search by phone / contact…"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              autoComplete="off"
            />
          </div>
          <CowMultiSelect
            options={cowOptions}
            value={selectedCows}
            onChange={setSelectedCows}
            open={cowPopoverOpen}
            onOpenChange={setCowPopoverOpen}
            containerRef={cowWrapRef}
          />
          <PaymentMultiSelect
            value={selectedPayments}
            onChange={setSelectedPayments}
            open={paymentPopoverOpen}
            onOpenChange={setPaymentPopoverOpen}
            containerRef={paymentWrapRef}
          />
        </div>
        <div className="bookings-toolbar__actions">
          <div className="bookings-toolbar__size">
            <label htmlFor="page-size">Rows per page</label>
            <select
              id="page-size"
              className="bookings-select"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn--small"
            disabled={exporting}
            onClick={handleExportExcel}
          >
            {exporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>
      </div>

      <p className="list-hint muted bookings-page__hint">
        {isAdmin ? "All bookings." : "Your bookings."}
        {refreshing && (
          <span className="bookings-page__refreshing"> Updating…</span>
        )}
      </p>

      {bookings.length === 0 ? (
        <div className="bookings-empty">
          {hasActiveFilters ? (
            <>
              <p>No bookings match your filters.</p>
              <p className="muted">
                Try adjusting name, contact, cow, or payment filters — search updates
                as you type.
              </p>
            </>
          ) : (
            <>
              <p>No bookings yet.</p>
              <Link to="/new" className="btn" style={{ marginTop: "1rem" }}>
                Add first booking
              </Link>
            </>
          )}
        </div>
      ) : (
        <div
          className={`table-wrap ${refreshing ? "table-wrap--refreshing" : ""}`}
        >
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Shares</th>
                <th>Payment</th>
                <th>Cow(s)</th>
                <th>Recorded by</th>
                <th>Booked</th>
                {isAdmin && <th>WhatsApp</th>}
                <th>Slots</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id}>
                  <td data-label="Name">{b.name}</td>
                  <td data-label="Contact">{b.contact}</td>
                  <td data-label="Shares">{b.shares}</td>
                  <td data-label="Payment">
                    <span
                      className={`payment-badge payment-badge--${b.paymentStatus || "pending"}`}
                    >
                      {paymentStatusLabel(b.paymentStatus || "pending")}
                    </span>
                  </td>
                  <td data-label="Cows">{formatCowNumbers(b)}</td>
                  <td data-label="Recorded by">{recordedByLabel(b)}</td>
                  <td data-label="Booked">{formatDate(b.created_at)}</td>
                  {isAdmin && (
                    <td data-label="WhatsApp">
                      <div className="wa-actions">
                        <button
                          type="button"
                          className="btn btn--wa"
                          onClick={() => openWhatsAppNative(b)}
                        >
                          Open app
                        </button>
                        <button
                          type="button"
                          className="btn btn--small btn-secondary"
                          onClick={() => openWhatsAppWeb(b)}
                        >
                          Web
                        </button>
                        <button
                          type="button"
                          className="btn btn--small btn-secondary"
                          onClick={() => copyWhatsAppMessage(b)}
                        >
                          Copy message
                        </button>
                      </div>
                    </td>
                  )}
                  <td data-label="Slots">
                    <Link to={`/bookings/${b._id}`} className="table-action">
                      Edit cow / share
                    </Link>
                  </td>
                  <td data-label="Actions">
                    <div className="table-row-actions">
                      <Link to={`/bookings/${b._id}`} className="table-action">
                        Details
                      </Link>
                      <button
                        type="button"
                        className="btn btn--small btn--danger"
                        disabled={deletingId === b._id}
                        onClick={() =>
                          setDeleteModal({ _id: b._id, name: b.name })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination-bar">
        <p className="pagination-bar__info muted">
          {total === 0
            ? "0 results"
            : `Showing ${fromIdx}–${toIdx} of ${total}`}
        </p>
        <div className="pagination-bar__nav">
          <button
            type="button"
            className="btn btn--small btn-secondary"
            disabled={page <= 1 || refreshing}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="pagination-bar__page muted">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn--small btn-secondary"
            disabled={page >= totalPages || refreshing}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
