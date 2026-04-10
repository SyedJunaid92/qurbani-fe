import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { fetchBookings } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  digitsForWhatsApp,
  whatsAppDigitsHint,
} from "../utils/whatsappPhone.js";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** Distinct cow numbers for this booking (1-based), sorted */
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

/** Opens installed WhatsApp (desktop / phone app). Avoids broken WhatsApp Web. */
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

/** HTTPS chat link in a new tab (uses WhatsApp Web or mobile browser). */
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

export default function BookingsList() {
  const { isAdmin } = useAuth();
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
        if (!cancelled) {
          setError(e.message);
          toast.error(e.message || "Could not load bookings");
        }
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
        <p className="muted">
          Ensure the API is running and MongoDB is available.
        </p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="card">
        <p>No bookings yet.</p>
        <Link to="/new" className="btn" style={{ marginTop: "1rem" }}>
          Add first booking
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="list-hint muted">
        {isAdmin ? "Showing all bookings." : "Showing bookings you created."}
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Shares</th>
              <th>Cow(s)</th>
              <th>Recorded by</th>
              <th>Booked</th>
              {isAdmin && <th>WhatsApp</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b._id}>
                <td data-label="Name">{b.name}</td>
                <td data-label="Contact">{b.contact}</td>
                <td data-label="Shares">{b.shares}</td>
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
                <td data-label="">
                  <Link to={`/bookings/${b._id}`} className="table-action">
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
