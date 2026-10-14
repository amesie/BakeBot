"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n";
import { whatsAppDisplay, whatsAppLink } from "@/lib/site";

const YEAR = 2026;

export function SiteFooter() {
  const { messages: m } = useI18n();
  return (
    <footer className="site-footer" id="contact">
      <div className="container-kd footer-grid">
        <div>
          <div className="footer-wordmark">
            KD <span>POPS</span>
          </div>
          <p>{m.footer.tagline}</p>
        </div>
        <div className="footer-contact">
          <p>{m.footer.contactLabel}</p>
          {whatsAppLink && (
            <a href={whatsAppLink} target="_blank" rel="noopener noreferrer">
              {m.footer.whatsapp} · {whatsAppDisplay}
            </a>
          )}
        </div>
      </div>
      <div className="container-kd footer-bottom">
        <span>{format(m.footer.rights, { year: YEAR })}</span>
        <span>{m.footer.smallBatch}</span>
      </div>
    </footer>
  );
}

export function MobileOrderBar() {
  const { messages: m } = useI18n();
  return (
    <a className="mobile-order-bar" href="#order">
      {m.nav.orderNow} <span aria-hidden="true">→</span>
    </a>
  );
}
