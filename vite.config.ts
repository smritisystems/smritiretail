/**
 * Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
 * Module       : Vite Enterprise Bundling & Chunk Splitting Engine (Vite v8 Compatible)
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.6.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiTarget = process.env.SMRITI_API_HOST
  ? `http://${process.env.SMRITI_API_HOST}`
  : process.env.PYTHON_CORE_HOST
  ? `http://${process.env.PYTHON_CORE_HOST}`
  : process.env.VITE_API_HOST
  ? `http://${process.env.VITE_API_HOST}`
  : "http://smriti-api-prod:8000";

const manualChunksHandler = (id: string) => {
  if (id.includes("node_modules")) {
    if (id.includes("recharts") || id.includes("d3")) {
      return "vendor-charts";
    }
    if (id.includes("lucide-react") || id.includes("lucide")) {
      return "vendor-icons";
    }
    if (id.includes("react") || id.includes("react-dom")) {
      return "vendor-react";
    }
    return "vendor-common";
  }
  if (id.includes("SalesStudioTab") || id.includes("PurchaseStudioTab") || id.includes("ConsignmentStudioTab")) {
    return "smriti-heavy-studios";
  }
  if (id.includes("OperationalWorkspacesTab") || id.includes("TransactionWorkspacesTab") || id.includes("BiReportingAndPrintingTab")) {
    return "smriti-workspaces";
  }
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: "window"
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api/v1": {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on("proxyRes", (proxyRes, _req, _res) => {
            if (proxyRes.headers.location) {
              proxyRes.headers.location = proxyRes.headers.location.replace(
                /https?:\/\/(?:api|python-core):8000/,
                ""
              );
            }
          });
        }
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api/v1": {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on("proxyRes", (proxyRes, _req, _res) => {
            if (proxyRes.headers.location) {
              proxyRes.headers.location = proxyRes.headers.location.replace(
                /https?:\/\/(?:api|python-core):8000/,
                ""
              );
            }
          });
        }
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: manualChunksHandler
      }
    }
  }
});
