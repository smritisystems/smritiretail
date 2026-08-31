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
 * * Version    : 3.17.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-08-26
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
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("d3")) {
              return "vendor-charts";
            }
            if (id.includes("lucide-react") || id.includes("@material-symbols")) {
              return "vendor-icons";
            }
            if (id.includes("motion")) {
              return "vendor-motion";
            }
            if (id.includes("xlsx") || id.includes("jspdf") || id.includes("html2canvas")) {
              return "vendor-documents";
            }
            return "vendor-core";
          }

          if (id.includes("/src/components/")) {
            if (id.includes("SalesStudioTab")) return "smriti-sales-studio";
            if (id.includes("PurchaseStudioTab")) return "smriti-purchase-studio";
            if (id.includes("ReportDesignerTab")) return "smriti-report-designer";
            if (id.includes("TermsEngineTab")) return "smriti-terms-engine";
            if (id.includes("BarcodeStudioTab")) return "smriti-barcode-studio";
            if (id.includes("PrintPreviewModal")) return "smriti-print-preview";
            if (id.includes("DashboardTab")) return "smriti-dashboard";
          }

          if (id.includes("/src/lib/")) return "app-lib";
          if (id.includes("/src/services/")) return "app-services";
          if (id.includes("/src/contexts/")) return "app-contexts";
        }
      }
    }
  }
});
