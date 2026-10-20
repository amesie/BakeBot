// Customer-side email sends (D-070): run after the API has answered, so a
// slow mail server never slows an order down. Each send is logged in
// email_log through the order's own link token.
import "server-only";
import { createAnonClient } from "@/lib/supabase/anon";
import { logError } from "@/lib/log-error";
import { cancelledEmail, orderReceivedEmail, type EmailOrder } from "./compose";
import { emailConfigured, sendEmail } from "./send";

async function log(orderNumber: string, token: string, template: string, result: { status: string; attempts: number; error?: string }) {
  await createAnonClient().rpc("log_order_email", {
    p_order_number: orderNumber,
    p_token: token,
    p_template: template,
    p_status: result.status,
    p_attempts: result.attempts,
    p_error: result.error ?? null,
  });
  if (result.status !== "sent") await logError("email", `${template}: ${result.error ?? "failed"}`);
}

/** Order placed: save the address, then send details with track and cancel links. */
export async function sendOrderReceived(origin: string, token: string, email: string, order: EmailOrder) {
  const supabase = createAnonClient();
  const saved = await supabase.rpc("set_order_email", {
    p_order_number: order.order_number,
    p_token: token,
    p_email: email,
  });
  if (saved.error) return logError("email", `set_order_email: ${saved.error.message}`);
  if (!emailConfigured()) return;

  const track = `${origin}/order/${encodeURIComponent(order.order_number)}#${token}`;
  const cancel = `${origin}/order/${encodeURIComponent(order.order_number)}?cancel=1#${token}`;
  const composed = orderReceivedEmail(order, { track, cancel });
  await log(order.order_number, token, "order_received", await sendEmail({ to: email, ...composed }));
}

/** Customer cancelled: confirm by email if we have an address. */
export async function sendCancelled(token: string, email: string | null, order: EmailOrder) {
  if (!email || !emailConfigured()) return;
  await log(order.order_number, token, "cancelled", await sendEmail({ to: email, ...cancelledEmail(order) }));
}
