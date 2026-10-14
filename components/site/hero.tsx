"use client";

import { useI18n } from "@/components/i18n-provider";
import { HeroPops } from "@/components/kd/cake-pop";
import { Sparkle } from "@/components/kd/sparkle";
import { format } from "@/lib/i18n";

export function Hero() {
  const { messages: m } = useI18n();
  return (
    <section className="hero container-kd" id="home">
      <div className="hero-copy">
        <div className="oval-badge">{m.hero.badge}</div>
        <p className="eyebrow">{m.hero.eyebrow}</p>
        <h1 className="hero-title">
          KD <span>POPS</span>
        </h1>
        <p className="tagline">{m.hero.tagline}</p>
        <p className="sparkle-line">
          <Sparkle filled />
          <span>{m.hero.fresh}</span>
          <Sparkle filled />
        </p>
        <div className="hero-actions">
          <a className="pill" href="#order">
            {m.hero.orderNow} <span aria-hidden="true">→</span>
          </a>
          <a className="pill pill-outline" href="#menu">{m.hero.seeMenu}</a>
        </div>
      </div>
      <HeroPops label={m.hero.artLabel} />
    </section>
  );
}

export function Ticker({ fromPrice }: { fromPrice: number | null }) {
  const { messages: m } = useI18n();
  const words = [m.ticker.handmade, fromPrice ? format(m.ticker.fromPrice, { price: fromPrice }) : null, m.ticker.pickup]
    .filter((word): word is string => Boolean(word));
  const line = [...words, ...words];
  return (
    <div className="ticker" aria-hidden="true">
      <div>
        {line.map((word, i) => (
          <span key={i}>
            {word} {i < line.length - 1 ? "✦ " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
