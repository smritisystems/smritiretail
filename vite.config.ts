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
import { visualizer } from "rollup-plugin-visualizer";
import path from "node:path";

const apiTarget = process.env.SMRITI_API_HOST
  ? `http://${process.env.SMRITI_API_HOST}`
  : process.env.PYTHON_CORE_HOST
  ? `http://${process.env.PYTHON_CORE_HOST}`
  : process.env.VITE_API_HOST
  ? `http://${process.env.VITE_API_HOST}`
  : "http://localhost:8000";

const manualChunksHandler = (id: string) => {
  if (id.includes("node_modules")) {
    return "vendor";
  }
};

export default defineConfig({
  define: {
    global: "globalThis",
    "process.env": {},
    "process.browser": true,
    "process.version": '"v20.0.0"',
  },

  optimizeDeps: {
    // Force Vite to pre-bundle `buffer` so it is resolved synchronously
    // before any module-graph code executes — eliminates the race condition
    // between the deferred polyfill.ts module and vendor chunk loading.
    include: ["buffer"],
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
  resolve: {
    alias: {
      buffer: "buffer/",
      pg: path.resolve(__dirname, "src/lib/pg_browser_stub.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        banner: [
          // ── Global polyfills injected at the top of every output chunk ──────────
          // This banner runs before any module-level code in the chunk executes.
          // /buffer.min.js (loaded via a sync <script> in index.html) has already
          // set window.Buffer = BufferModule.Buffer. We copy it to globalThis here
          // so that vendor libraries that reference bare `Buffer` (replaced by Vite's
          // define: { Buffer: "globalThis.Buffer" }) always find it defined.
          "if (typeof globalThis !== 'undefined') {",
          "  globalThis.global = globalThis.global || globalThis;",
          "  if (typeof globalThis.Buffer === 'undefined') {",
          "    var _wb = (typeof window !== 'undefined' && window.Buffer) || null;",
          "    if (_wb) globalThis.Buffer = _wb;",
          "  }",
          "}"
        ].join(" "),
        manualChunks: manualChunksHandler
      }
    }
  },
  plugins: [
    // Inject Buffer polyfill at the top of every module entry so it is
    // guaranteed to be defined before any vendor library code runs.
    {
      name: "smriti-buffer-inject",
      transformIndexHtml: {
        order: "pre",
        handler() {
          return [
            {
              tag: "script",
              attrs: { type: "text/javascript" },
              children: [
                "(function(){",
                "  var _b = (typeof window !== 'undefined' && window.Buffer) || (typeof globalThis !== 'undefined' && globalThis.Buffer);",
                "  if (!_b) {",
                "    try {",
                "      var bm = window.BufferModule || (typeof BufferModule !== 'undefined' ? BufferModule : null);",
                "      _b = bm && bm.Buffer ? bm.Buffer : null;",
                "    } catch(e) {}",
                "  }",
                "  if (_b) {",
                "    if (typeof window !== 'undefined') window.Buffer = _b;",
                "    if (typeof globalThis !== 'undefined') globalThis.Buffer = _b;",
                "  }",
                "})();"
              ].join("\n"),
              injectTo: "head-prepend",
            },
          ];
        },
      },
    },
    react(),
    tailwindcss(),
    visualizer({
      filename: "dist/stats.html",
      title: "SMRITI Retail OS Bundle Analysis",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});


