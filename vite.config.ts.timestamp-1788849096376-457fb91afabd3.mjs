// vite.config.ts
import { defineConfig } from "file:///F:/SMRITRretailNX/node_modules/vite/dist/node/index.js";
import react from "file:///F:/SMRITRretailNX/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///F:/SMRITRretailNX/node_modules/@tailwindcss/vite/dist/index.mjs";
var pythonCoreTarget = process.env.PYTHON_CORE_HOST ? process.env.PYTHON_CORE_HOST.startsWith("http") ? process.env.PYTHON_CORE_HOST : `http://${process.env.PYTHON_CORE_HOST}` : process.env.BACKEND_API_URL || "http://127.0.0.1:8000";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3e3,
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
    port: 3e3,
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
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFxTTVJJVFJyZXRhaWxOWFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRjpcXFxcU01SSVRScmV0YWlsTlhcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Y6L1NNUklUUnJldGFpbE5YL3ZpdGUuY29uZmlnLnRzXCI7LyoqXHJcbiAqIFByb2plY3QgICAgICA6IFNNUklUSSBSZXRhaWwgT1NcclxuICogUmVwb3NpdG9yeSAgIDogU01SSVRJUmV0YWlsTlhcclxuICogT3JnYW5pemF0aW9uIDogQUlUREwgTkVUV09SS1NcclxuICpcclxuICogRm91bmRlcnNcclxuICpcclxuICogKiBQdXNocGEgRGV2aSBKYXdhaGFyIE1hbGxhaFxyXG4gKiAgICogRm91bmRlciAmIENoYWlycGVyc29uXHJcbiAqICAgKiBQaG9uZTogKzkxIDkzMjQxMTcwMDdcclxuICogICAqIEVtYWlsOiBmb3VuZGVyQGFpdGRsLmNvbVxyXG4gKlxyXG4gKiAqIEphd2FoYXIgUmFta3JpcGFsIE1hbGxhaFxyXG4gKiAgICogRm91bmRlciwgQ2hpZWYgRXhlY3V0aXZlIE9mZmljZXIgKENFTykgJiBDaGllZiBTb2Z0d2FyZSBBcmNoaXRlY3RcclxuICogICAqIEVtYWlsOiBmb3VuZGVyQGFpdGRsLmNvbVxyXG4gKlxyXG4gKiAqIFdlYnNpdGVzOiBhaXRkbC5jb20gfCBlcnBuYm9vay5jb20gfCBzbXJpdGlib29rcy5jb21cclxuICpcclxuICogKiBWZXJzaW9uICAgIDogMy4xNy4wXHJcbiAqICogQ3JlYXRlZCAgICA6IDIwMjYtMDctMTBcclxuICogKiBNb2RpZmllZCAgIDogMjAyNi0wOC0yNlxyXG4gKiAqIENvcHlyaWdodCAgOiBcdTAwQTkgQUlUREwuY29tIGFuZCBTTVJJVElCb29rcy5jb20uIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXHJcbiAqICogTGljZW5zZSAgICA6IFByb3ByaWV0YXJ5IENvbW1lcmNpYWwgU29mdHdhcmVcclxuICovXHJcblxyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XHJcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIjtcclxuXHJcbmNvbnN0IHB5dGhvbkNvcmVUYXJnZXQgPSBwcm9jZXNzLmVudi5QWVRIT05fQ09SRV9IT1NUXHJcbiAgPyAocHJvY2Vzcy5lbnYuUFlUSE9OX0NPUkVfSE9TVC5zdGFydHNXaXRoKFwiaHR0cFwiKVxyXG4gICAgICA/IHByb2Nlc3MuZW52LlBZVEhPTl9DT1JFX0hPU1RcclxuICAgICAgOiBgaHR0cDovLyR7cHJvY2Vzcy5lbnYuUFlUSE9OX0NPUkVfSE9TVH1gKVxyXG4gIDogKHByb2Nlc3MuZW52LkJBQ0tFTkRfQVBJX1VSTCB8fCBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3JlYWN0KCksIHRhaWx3aW5kY3NzKCldLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogXCIwLjAuMC4wXCIsXHJcbiAgICBwb3J0OiAzMDAwLFxyXG4gICAgYWxsb3dlZEhvc3RzOiB0cnVlLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgXCIvYXBpL3YxXCI6IHtcclxuICAgICAgICB0YXJnZXQ6IHB5dGhvbkNvcmVUYXJnZXQsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2VcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcbiAgcHJldmlldzoge1xyXG4gICAgaG9zdDogXCIwLjAuMC4wXCIsXHJcbiAgICBwb3J0OiAzMDAwLFxyXG4gICAgYWxsb3dlZEhvc3RzOiB0cnVlLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgXCIvYXBpL3YxXCI6IHtcclxuICAgICAgICB0YXJnZXQ6IHB5dGhvbkNvcmVUYXJnZXQsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2VcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIG91dERpcjogXCJkaXN0XCIsXHJcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogNzAwLFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcclxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlc1wiKSkge1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJyZWNoYXJ0c1wiKSB8fCBpZC5pbmNsdWRlcyhcImQzXCIpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLWNoYXJ0c1wiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImx1Y2lkZS1yZWFjdFwiKSB8fCBpZC5pbmNsdWRlcyhcIkBtYXRlcmlhbC1zeW1ib2xzXCIpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLWljb25zXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibW90aW9uXCIpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLW1vdGlvblwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcInhsc3hcIikgfHwgaWQuaW5jbHVkZXMoXCJqc3BkZlwiKSB8fCBpZC5pbmNsdWRlcyhcImh0bWwyY2FudmFzXCIpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLWRvY3VtZW50c1wiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1jb3JlXCI7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9jb21wb25lbnRzL1wiKSkge1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJTYWxlc1N0dWRpb1RhYlwiKSkgcmV0dXJuIFwic21yaXRpLXNhbGVzLXN0dWRpb1wiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJQdXJjaGFzZVN0dWRpb1RhYlwiKSkgcmV0dXJuIFwic21yaXRpLXB1cmNoYXNlLXN0dWRpb1wiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJSZXBvcnREZXNpZ25lclRhYlwiKSkgcmV0dXJuIFwic21yaXRpLXJlcG9ydC1kZXNpZ25lclwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJUZXJtc0VuZ2luZVRhYlwiKSkgcmV0dXJuIFwic21yaXRpLXRlcm1zLWVuZ2luZVwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJCYXJjb2RlU3R1ZGlvVGFiXCIpKSByZXR1cm4gXCJzbXJpdGktYmFyY29kZS1zdHVkaW9cIjtcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiUHJpbnRQcmV2aWV3TW9kYWxcIikpIHJldHVybiBcInNtcml0aS1wcmludC1wcmV2aWV3XCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIkRhc2hib2FyZFRhYlwiKSkgcmV0dXJuIFwic21yaXRpLWRhc2hib2FyZFwiO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9zcmMvbGliL1wiKSkgcmV0dXJuIFwiYXBwLWxpYlwiO1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9zZXJ2aWNlcy9cIikpIHJldHVybiBcImFwcC1zZXJ2aWNlc1wiO1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiL3NyYy9jb250ZXh0cy9cIikpIHJldHVybiBcImFwcC1jb250ZXh0c1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUF5QkEsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBRXhCLElBQU0sbUJBQW1CLFFBQVEsSUFBSSxtQkFDaEMsUUFBUSxJQUFJLGlCQUFpQixXQUFXLE1BQU0sSUFDM0MsUUFBUSxJQUFJLG1CQUNaLFVBQVUsUUFBUSxJQUFJLGdCQUFnQixLQUN6QyxRQUFRLElBQUksbUJBQW1CO0FBRXBDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO0FBQUEsRUFDaEMsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsT0FBTztBQUFBLE1BQ0wsV0FBVztBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsT0FBTztBQUFBLE1BQ0wsV0FBVztBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLElBQ2IsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLGdCQUFJLEdBQUcsU0FBUyxVQUFVLEtBQUssR0FBRyxTQUFTLElBQUksR0FBRztBQUNoRCxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsY0FBYyxLQUFLLEdBQUcsU0FBUyxtQkFBbUIsR0FBRztBQUNuRSxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsUUFBUSxHQUFHO0FBQ3pCLHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUyxNQUFNLEtBQUssR0FBRyxTQUFTLE9BQU8sS0FBSyxHQUFHLFNBQVMsYUFBYSxHQUFHO0FBQzdFLHFCQUFPO0FBQUEsWUFDVDtBQUNBLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLGtCQUFrQixHQUFHO0FBQ25DLGdCQUFJLEdBQUcsU0FBUyxnQkFBZ0IsRUFBRyxRQUFPO0FBQzFDLGdCQUFJLEdBQUcsU0FBUyxtQkFBbUIsRUFBRyxRQUFPO0FBQzdDLGdCQUFJLEdBQUcsU0FBUyxtQkFBbUIsRUFBRyxRQUFPO0FBQzdDLGdCQUFJLEdBQUcsU0FBUyxnQkFBZ0IsRUFBRyxRQUFPO0FBQzFDLGdCQUFJLEdBQUcsU0FBUyxrQkFBa0IsRUFBRyxRQUFPO0FBQzVDLGdCQUFJLEdBQUcsU0FBUyxtQkFBbUIsRUFBRyxRQUFPO0FBQzdDLGdCQUFJLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUFBLFVBQzFDO0FBRUEsY0FBSSxHQUFHLFNBQVMsV0FBVyxFQUFHLFFBQU87QUFDckMsY0FBSSxHQUFHLFNBQVMsZ0JBQWdCLEVBQUcsUUFBTztBQUMxQyxjQUFJLEdBQUcsU0FBUyxnQkFBZ0IsRUFBRyxRQUFPO0FBQUEsUUFDNUM7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
