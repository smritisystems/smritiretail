/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Founders
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 * Version      : 3.27.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-30
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import "./polyfill.ts";
import "./patchFetch.ts";
import React from "react";

import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { TaxInvoicePrintPage } from "./print_engine/TaxInvoicePrintPage.tsx";
// SEEF — must be the outermost provider so CSS data-attributes are written
// to <html> before any child component renders (prevents theme flash).
import { SEEFProvider } from "./layout_engine/SEEFContext.tsx";
// SWSDK v1.0 / SPF PlatformBootstrap — 12-stage platform boot sequence (Rule SWSDK-001)
import { PlatformBootstrap } from "./platform/spf/bootstrap/PlatformBootstrap.ts";

const isInvoicePrint =
  window.location.pathname === "/invoice-print" ||
  window.location.search.includes("invoice-print");

/**
 * SPF Platform Boot — executes the 12-stage boot sequence and AWAITS completion
 * before React hydration. This guarantees SWSDK Registry (Stage 8) has registered
 * all workspace manifests before SUNEF renders navigation or the launchpad.
 *
 * Bug fixed: executeBootSequence() is async — calling it without await caused
 * React to hydrate before Stage 8 (SWSDKRegistry) completed. Wrap in async IIFE.
 */
(async () => {
  try {
    await PlatformBootstrap.executeBootSequence((progress) => {
      if (import.meta.env.DEV) {
        console.info(
          `[SPF Boot] [${progress.index}/${progress.totalStages}] ${progress.stage} — ${progress.message}`
        );
      }
    });
  } catch (err) {
    console.error("[SPF Boot] ❌ Boot sequence failed:", err);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <SEEFProvider>
        <ThemeProvider>
          {isInvoicePrint ? <TaxInvoicePrintPage /> : <App />}
        </ThemeProvider>
      </SEEFProvider>
    </React.StrictMode>
  );
})();
