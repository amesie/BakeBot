// Every order gets its id and status-link token on the phone before it is
// sent, so a retry after a dropped connection is recognised as the same order
// (REQ-09) and the customer can always open their status link (gap 4).
export function newOrderIdentity() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { order_id: crypto.randomUUID(), access_token: token };
}

/**
 * The token goes in the URL fragment (#...), which browsers never send to the
 * server, so it stays out of server logs and Referer headers (D-028).
 */
export function statusPath(orderNumber: string, token: string) {
  return `/order/${encodeURIComponent(orderNumber)}#${token}`;
}
