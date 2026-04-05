/**
 * WhatsApp requires full international format: digits only, no +, must not start with 0.
 * Local numbers often use a trunk 0 (e.g. 03001234567 in Pakistan) — we drop it and prepend
 * the country calling code from VITE_DEFAULT_CALLING_CODE (e.g. 92).
 */
export function digitsForWhatsApp(contact) {
  const cc = (import.meta.env.VITE_DEFAULT_CALLING_CODE || "").replace(/\D/g, "");
  if (typeof contact !== "string") return null;

  let d = contact.replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("0")) {
    d = d.replace(/^0+/, "");
    if (!d) return null;
    if (!cc) return null;
    if (!d.startsWith(cc)) {
      d = cc + d;
    }
  }

  if (d.length < 8 || d.length > 15) return null;
  return d;
}

export function whatsAppDigitsHint() {
  const cc = import.meta.env.VITE_DEFAULT_CALLING_CODE;
  if (cc) {
    return `Use international format or local numbers starting with 0 (country code ${cc} is applied automatically).`;
  }
  return "Use international format (e.g. +923001234567). For numbers starting with 0, set VITE_DEFAULT_CALLING_CODE in .env (e.g. 92 for Pakistan).";
}
