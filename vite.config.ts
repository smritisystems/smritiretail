/**
 * Project      : SMRITI Retail OS v5.0 — Workspace Experience Platform
 * Module       : Vite Enterprise Bundling & Chunk Splitting Engine
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.5.0
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
  : "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api/v1": {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on("proxyRes", (proxyRes, req, res) => {
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
          proxy.on("proxyRes", (proxyRes, req, res) => {
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
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
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
        }
      }
    }
  }
});
