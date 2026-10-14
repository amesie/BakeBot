"use client";

import { useEffect } from "react";

// Registers public/sw.js in production builds (spec 7.7). Development is left
// alone so hot reload never serves stale files.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Unsupported or blocked: the site still works online.
    });
  }, []);
  return null;
}
