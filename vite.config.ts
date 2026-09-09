/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.30.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-09-09
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pythonCoreTarget = process.env.PYTHON_CORE_HOST
  ? (process.env.PYTHON_CORE_HOST.startsWith("http")
      ? process.env.PYTHON_CORE_HOST
      : `http://${process.env.PYTHON_CORE_HOST}`)
  : (process.env.BACKEND_API_URL || "http://127.0.0.1:8000");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    proxy: {
      "/api/v1": {
        target: pythonCoreTarget,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    proxy: {
      "/api/v1": {
        target: pythonCoreTarget,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Vendor: React core (must be first to prevent circular chunk) ─
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          // ── Vendor: TanStack Query ───────────────────────────────────────
          if (id.includes("@tanstack")) {
            return "vendor-query";
          }
          // ── Vendor: Charts + D3 ─────────────────────────────────────────
          if (id.includes("recharts") || id.includes("/d3-")) {
            return "vendor-charts";
          }
          // ── Vendor: Icons ───────────────────────────────────────────────
          if (id.includes("lucide-react") || id.includes("@material-symbols")) {
            return "vendor-icons";
          }
          // ── Vendor: Animation ───────────────────────────────────────────
          if (id.includes("motion") || id.includes("framer")) {
            return "vendor-motion";
          }
          // ── Vendor: Documents (xlsx, jspdf, html2canvas) ────────────────
          if (id.includes("xlsx") || id.includes("jspdf") || id.includes("html2canvas")) {
            return "vendor-documents";
          }
          // ── Vendor: Everything else ──────────────────────────────────────
          if (id.includes("node_modules")) {
            return "vendor-core";
          }

          // ── SMRITI: Business Engines ────────────────────────────────────
          if (id.includes("/src/utils/") && id.includes("Engine")) {
            return "smriti-engines";
          }

          // ── SMRITI: Billing (largest standalone workspace) ───────────────
          if (id.includes("BillingWorkspace") || id.includes("/billing/")) {
            return "smriti-billing";
          }

          // ── SMRITI: Named Studio Tabs ────────────────────────────────────
          if (id.includes("SalesStudioTab")) return "smriti-sales-studio";
          if (id.includes("PurchaseStudioTab")) return "smriti-purchase-studio";
          if (id.includes("ReportDesignerTab")) return "smriti-report-designer";
          if (id.includes("TermsEngineTab")) return "smriti-terms-engine";
          if (id.includes("BarcodeStudioTab")) return "smriti-barcode-studio";
          if (id.includes("PrintPreviewModal")) return "smriti-print-preview";
          if (id.includes("DashboardTab")) return "smriti-dashboard";

          // ── SMRITI: Feature Tabs ─────────────────────────────────────────
          if (id.includes("CRMTab") || id.includes("/crm/")) return "smriti-crm";
          if (id.includes("InventoryTab") || id.includes("/inventory/")) return "smriti-inventory";
          if (id.includes("AccountsTab") || id.includes("/accounts/")) return "smriti-accounts";
          if (id.includes("SettingsTab") || id.includes("/settings/")) return "smriti-settings";

          // ── SMRITI: Shared Infrastructure ────────────────────────────────
          if (id.includes("/src/lib/")) return "app-lib";
          if (id.includes("/src/services/")) return "app-services";
          if (id.includes("/src/contexts/")) return "app-contexts";
        }
      }
    }
  }
});
