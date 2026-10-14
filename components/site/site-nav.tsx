"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { LanguageToggle } from "./language-toggle";

export function SiteNav() {
  const { messages: m } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="nav-wrap">
      <a className="skip-link" href="#main">{m.nav.skipToContent}</a>
      <nav className="nav container-kd" aria-label="Main">
        <a className="wordmark" href="#home" aria-label={m.nav.home} onClick={close}>
          KD <span>POPS</span>
        </a>
        <div id="nav-links" className={`nav-links ${open ? "nav-links-open" : ""}`}>
          <a href="#menu" onClick={close}>{m.nav.menu}</a>
          <a href="#order" onClick={close}>{m.nav.order}</a>
          <a href="#contact" onClick={close}>{m.nav.contact}</a>
          <LanguageToggle />
          <a className="pill pill-small" href="#order" onClick={close}>{m.nav.orderNow}</a>
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="nav-links"
          aria-label={open ? m.nav.closeMenu : m.nav.openMenu}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>
    </header>
  );
}
