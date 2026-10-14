// Order request validation (REQ-04, REQ-05), shared by the browser and
// POST /api/orders. The database function place_order() repeats every check,
// so this layer is for fast, friendly feedback, not the last line of defence.
import { z } from "zod";
import { normaliseZaPhone } from "@/lib/phone";

export const CONSENT_VERSION = "2026-10-v1";
export const MAX_PER_FLAVOUR = 100;
export const MAX_NOTES = 280;

/** Error codes shared with place_order(); the UI turns them into messages. */
export type ErrorCode =
  | "required"
  | "invalid"
  | "too_long"
  | "too_many"
  | "unavailable"
  | "closed"
  | "conflict";
export type FieldErrors = Partial<Record<string, ErrorCode>>;

const token = /^[A-Za-z0-9_-]{43}$/;

export const orderRequestSchema = z
  .object({
    order_id: z.uuid({ error: "invalid" }),
    access_token: z.string().regex(token, { error: "invalid" }),
    full_name: z
      .string({ error: "required" })
      .trim()
      .min(1, { error: "required" })
      .max(100, { error: "too_long" }),
    phone: z
      .string({ error: "required" })
      .trim()
      .min(1, { error: "required" })
      .refine((value) => normaliseZaPhone(value) !== null, { error: "invalid" }),
    language: z.enum(["en", "xh", "af"]).default("en"),
    consent_given: z.literal(true, { error: "required" }),
    consent_version: z.string().min(1, { error: "required" }).max(40),
    is_minor: z.boolean({ error: "required" }),
    guardian_consent: z.boolean().default(false),
    items: z
      .array(
        z.object({
          product_id: z.uuid({ error: "required" }),
          quantity: z
            .number({ error: "required" })
            .int()
            .min(1, { error: "required" })
            .max(MAX_PER_FLAVOUR, { error: "too_many" }),
        }),
        { error: "required" },
      )
      .min(1, { error: "required" }),
    collection_date: z.iso.date({ error: "required" }),
    collection_slot: z.enum(["second_break", "after_school"], { error: "required" }),
    payment_method: z.enum(["cash", "eft"], { error: "required" }),
    special_notes: z.string().trim().max(MAX_NOTES, { error: "too_long" }).optional(),
  })
  .refine((order) => !order.is_minor || order.guardian_consent, {
    path: ["guardian_consent"],
    error: "required",
  });

export type OrderRequest = z.input<typeof orderRequestSchema>;

const knownCodes: ErrorCode[] = ["required", "invalid", "too_long", "too_many"];

/** Validate and return field-level error codes (first problem per field). */
export function validateOrder(
  input: unknown,
): { ok: true; data: z.output<typeof orderRequestSchema> } | { ok: false; errors: FieldErrors } {
  const result = orderRequestSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (errors[field]) continue;
    const code = issue.message as ErrorCode;
    errors[field] = knownCodes.includes(code) ? code : "invalid";
  }
  return { ok: false, errors };
}
