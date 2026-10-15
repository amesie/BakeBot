// Public contact details. NEXT_PUBLIC_OWNER_WHATSAPP is set in Vercel; links
// are hidden rather than shown with a fake number when it is missing.
const raw = process.env.NEXT_PUBLIC_OWNER_WHATSAPP ?? "";
const digits = raw.replace(/\D/g, "");

/** E.164 digits without "+", e.g. 27821234567; null when not configured. */
export const ownerWhatsApp = /^27\d{9}$/.test(digits) ? digits : null;

export const whatsAppLink = ownerWhatsApp ? `https://wa.me/${ownerWhatsApp}` : null;

/** Local display format: 082 123 4567. */
export const whatsAppDisplay = ownerWhatsApp
  ? `0${ownerWhatsApp.slice(2, 4)} ${ownerWhatsApp.slice(4, 7)} ${ownerWhatsApp.slice(7)}`
  : null;

/** Inbox for emailed proofs of payment (D-069). */
export const proofEmail = process.env.NEXT_PUBLIC_PROOF_EMAIL || "thebakebot@gmail.com";
