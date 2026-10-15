// Emailed proof of payment (D-069): pure helpers, unit-tested.

/** Payment reference anywhere in a subject: "Re: kdp-0042-7f3k paid" -> "KDP-0042-7F3K". */
export function findReference(subject: string | undefined | null): string | null {
  const match = (subject ?? "").toUpperCase().match(/KDP-\d{4,}-[A-HJKMNP-Z2-9]{4}/);
  return match ? match[0] : null;
}

export const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const MAX_PROOF_BYTES = 4 * 1024 * 1024;

/** Minimal shape of an IMAP BODYSTRUCTURE node (as returned by imapflow). */
export type BodyPart = {
  part?: string;
  type?: string;
  size?: number;
  disposition?: string;
  dispositionParameters?: Record<string, string>;
  parameters?: Record<string, string>;
  childNodes?: BodyPart[];
};

export type PickedAttachment = { part: string; type: string; extension: string; size: number };

/**
 * First image or PDF attachment small enough to store. Inline images count
 * too (phones often paste screenshots inline). Returns why nothing fit.
 */
export function pickAttachment(root: BodyPart | undefined): PickedAttachment | { reason: "no_attachment" | "unsupported" | "too_large" } {
  const candidates: BodyPart[] = [];
  const walk = (node: BodyPart | undefined) => {
    if (!node) return;
    if (node.childNodes?.length) node.childNodes.forEach(walk);
    else if (node.type && !node.type.startsWith("text/") && !node.type.startsWith("multipart/")) candidates.push(node);
  };
  walk(root);
  if (candidates.length === 0) return { reason: "no_attachment" };

  const usable = candidates.filter((c) => ACCEPTED_TYPES[c.type!.toLowerCase()]);
  if (usable.length === 0) return { reason: "unsupported" };
  const fits = usable.find((c) => (c.size ?? 0) <= MAX_PROOF_BYTES * 1.4); // base64 is ~4/3 larger on the wire
  if (!fits) return { reason: "too_large" };
  const type = fits.type!.toLowerCase();
  return { part: fits.part ?? "1", type: type === "image/jpg" ? "image/jpeg" : type, extension: ACCEPTED_TYPES[type], size: fits.size ?? 0 };
}
