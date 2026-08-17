"use client";

import { useEffect } from "react";

/**
 * Registers the service worker after the page has settled.
 *
 * Deliberately deferred to `load`: registration competes with the initial
 * render for bandwidth, and nothing about the first visit depends on it.
 *
 * Skipped in development, where a cached shell fights hot reloading.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is an enhancement; failing to register must not be
        // visible to the user.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
