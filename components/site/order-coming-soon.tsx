"use client";

// Placeholder for the order section until the order form ships in Phase 3.
import { useI18n } from "@/components/i18n-provider";
import { Sparkle } from "@/components/kd/sparkle";
import { whatsAppLink } from "@/lib/site";

export function OrderComingSoon() {
  const { messages: m } = useI18n();
  return (
    <section className="order-section" id="order" aria-labelledby="order-title">
      <div className="container-kd">
        <div className="section-heading" style={{ alignItems: "center" }}>
          <div>
            <p className="eyebrow">{m.order.eyebrow}</p>
            <h2 id="order-title">{m.order.title}</h2>
          </div>
          <Sparkle className="w-[60px] text-kd-orange" />
        </div>
        <div className="kd-card flex flex-col items-start gap-6">
          <p className="m-0 text-lg font-semibold">{m.order.comingSoon}</p>
          {whatsAppLink && (
            <a className="pill" href={whatsAppLink} target="_blank" rel="noopener noreferrer">
              {m.order.whatsapp} <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
