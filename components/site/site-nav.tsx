"use client";

import Link from "next/link";
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
        <Link className="wordmark" href="/#home" aria-label={m.nav.home} onClick={close}>
          KD <span>POPS</span>
        </Link>
        <div id="nav-links" className={`nav-links ${open ? "nav-links-open" : ""}`}>
          <Link href="/#menu" onClick={close}>{m.nav.menu}</Link>
          <Link href="/#order" onClick={close}>{m.nav.order}</Link>
          <Link href="/#contact" onClick={close}>{m.nav.contact}</Link>
          <LanguageToggle />
          <Link className="pill pill-small" href="/#order" onClick={close}>{m.nav.orderNow}</Link>
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
