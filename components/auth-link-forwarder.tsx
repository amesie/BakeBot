"use client";

import { useEffect } from "react";

// Supabase sends people back to the Site URL (the home page) when an email
// link's redirect is not on its allow list, which is what happened to the
// first staff invites. Pass such links on to /auth/callback to finish.
export function AuthLinkForwarder() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith("/auth/")) return;
    const fromEmail =
      hash.includes("access_token=") ||
      hash.includes("error_description=") ||
      (pathname === "/" && new URLSearchParams(search).has("code"));
    if (fromEmail) window.location.replace(`/auth/callback${search}${hash}`);
  }, []);
  return null;
}
