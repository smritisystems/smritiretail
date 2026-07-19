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
 * Modified     : 2026-07-19
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import "./patchFetch.ts";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { TaxInvoicePrintPage } from "./print_engine/TaxInvoicePrintPage.tsx";

const isInvoicePrint =
  window.location.pathname === "/invoice-print" ||
  window.location.search.includes("invoice-print");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      {isInvoicePrint ? <TaxInvoicePrintPage /> : <App />}
    </ThemeProvider>
  </React.StrictMode>
);
