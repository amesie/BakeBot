"use client";

import { useI18n } from "@/components/i18n-provider";
import { CakePop } from "@/components/kd/cake-pop";
import { requestAddFlavour } from "@/components/order/events";
import { AskBakeBotButton } from "@/components/chat/chat-widget";
import { visualFor } from "@/lib/catalogue-visuals";
import { formatRand } from "@/lib/format";
import { format } from "@/lib/i18n";
import type { MenuItem } from "@/lib/menu";

export function MenuSection({ items }: { items: MenuItem[] }) {
  const { messages: m } = useI18n();
  return (
    <section className="menu-section" id="menu" aria-labelledby="menu-title">
      <div className="container-kd">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{m.menu.eyebrow}</p>
            <h2 id="menu-title">{m.menu.title}</h2>
          </div>
          <div className="stack" style={{ gap: 12, maxWidth: 400 }}>
            <p className="m-0" style={{ color: "var(--milk)", fontSize: 15, lineHeight: 1.8 }}>{m.menu.intro}</p>
            <AskBakeBotButton className="pill pill-small pill-outline self-start" />
          </div>
        </div>

        {items.length === 0 ? (
          <p className="kd-card">{m.menu.empty}</p>
        ) : (
          <ul className="menu-grid" role="list">
            {items.map((item, index) => {
              const visual = visualFor(item.flavour, index);
              const price = formatRand(item.unit_price);
              return (
                <li className="menu-card" key={item.product_id}>
                  <span className="number-badge" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="menu-illustration" data-tint={visual.tint}>
                    <CakePop variant={visual.variant} label={format(m.menu.illustration, { flavour: item.flavour })} />
                    <span className="price-stamp" aria-hidden="true">{price}</span>
                  </div>
                  <div className="menu-details">
                    <h3>{item.flavour}</h3>
                    {visual.belgian && <div className="mini-badge">{m.menu.belgianBadge}</div>}
                    {item.description && <p>{item.description}</p>}
                    <div className="card-bottom">
                      <strong>
                        {price} <small>{m.menu.perPop}</small>
                      </strong>
                      <a
                        className="text-button"
                        href="#order"
                        onClick={() => requestAddFlavour(item.product_id)}
                        aria-label={format(m.menu.addFlavour, { flavour: item.flavour })}
                      >
                        {m.menu.addToOrder} <span className="icon-circle" aria-hidden="true">＋</span>
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
