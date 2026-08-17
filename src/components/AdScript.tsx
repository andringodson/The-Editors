import Script from "next/script";
import { CONSENT_STORAGE_KEY, adsenseClient, isAdsConfigured } from "@/lib/ads";

/**
 * Loads the AdSense library, configured for the visitor's consent state.
 *
 * `requestNonPersonalizedAds` must be set on the queue *before* the library
 * initialises — getting that order wrong silently serves personalised ads to
 * people who never agreed. React state cannot guarantee that ordering, so the
 * flag is set by a tiny inline script that runs first, reading the stored
 * preference directly.
 *
 * Default is non-personalised. It earns less. It is also the only default that
 * is lawful in the EEA/UK without a consent flow, and the only one consistent
 * with the rest of this product.
 */
export default function AdScript() {
  if (!isAdsConfigured) return null;

  const preInit = `
    window.adsbygoogle = window.adsbygoogle || [];
    try {
      window.adsbygoogle.requestNonPersonalizedAds =
        localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)}) === "personalised" ? 0 : 1;
    } catch (e) {
      window.adsbygoogle.requestNonPersonalizedAds = 1;
    }
  `;

  return (
    <>
      {/*
        A plain inline script rather than next/script: inline code executes in
        document order, which is all the ordering guarantee we need, and it
        avoids beforeInteractive's constraints entirely.
      */}
      <script dangerouslySetInnerHTML={{ __html: preInit }} />
      <Script
        id="adsense"
        strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
      />
    </>
  );
}
