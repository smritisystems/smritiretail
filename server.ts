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
 * * Version    : 3.17.0 → 3.17.1 (HOTFIX-001)
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-15 (HOTFIX-001 — Global Authentication Enforcement)
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import { initializePostgres } from "./src/db/init.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import devTrackerRouter from "./src/modules/dev_tracker/api/devTracker.routes.js";
import { runScanner } from "./src/modules/dev_tracker/scanner/scanner.js";
import { loadDb } from "./src/state/store.js";
import { sessionResolver } from "./src/middleware/sessionResolver.js";
import { requireAuth } from "./src/middleware/authGuard.js";

// HOTFIX-001: Routes that are publicly accessible without a session.
// All other /api/ routes are gated by requireAuth below.
const HOTFIX_PUBLIC_PATHS: string[] = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/company/setup"
];

// Import Route Modules
import authRouter from "./src/routes/auth.js";
import usersRouter from "./src/routes/users.js";
import assistantRouter from "./src/routes/assistant.js";
import systemRouter from "./src/routes/system.js";
import termsRouter from "./src/routes/terms.js";
import exchangeRouter from "./src/routes/exchange.js";
import customersRouter from "./src/routes/customers.js";
import numberingRouter from "./src/routes/numbering.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

app.use(express.json({ limit: "50mb" }));

// Route /api/v1 requests to FastAPI backend
app.use("/api/v1", async (req, res) => {
  const pythonCoreHost = process.env.PYTHON_CORE_HOST || "127.0.0.1:8000";
  const targetUrl = `http://${pythonCoreHost}/api/v1${req.url}`;
  try {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      }
    }
    delete headers["content-length"];
    delete headers["transfer-encoding"];
    headers["host"] = pythonCoreHost;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const body = await response.text();
    res.send(body);
  } catch (error) {
    console.error(`[SMRITI Proxy] Failed to proxy to ${targetUrl}:`, error);
    res.status(500).json({ error: "Proxy connection failed." });
  }
});

// Mount Extracted Routes
app.use(sessionResolver);

// ─── HOTFIX-001: Global Authentication Enforcement (P0 Security) ─────────────
// Runs after sessionResolver (which populates req.sessionInfo from a valid token).
// Rejects unauthenticated requests to all /api/ routes except the allowlist above.
app.use("/api/", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const originalPath = req.originalUrl ? req.originalUrl.split("?")[0] : "";
  const normalizedPath = `${req.baseUrl || ""}${req.path || ""}`;
  const relativePath = req.path || "";
  const strippedApiPath = relativePath.replace(/^\/api/, "");

  const pathsToCheck = [originalPath, normalizedPath, relativePath, strippedApiPath];

  const isPublic = HOTFIX_PUBLIC_PATHS.some(publicPath =>
    pathsToCheck.some(checkPath =>
      checkPath === publicPath || checkPath.startsWith(publicPath + "/")
    )
  );

  if (isPublic) return next();
  return requireAuth(req, res, next);
});
// ─────────────────────────────────────────────────────────────────────────────


app.use(authRouter);
app.use(usersRouter);
app.use(assistantRouter);
app.use(systemRouter);
app.use(termsRouter);
app.use(exchangeRouter);
app.use(customersRouter);
app.use(numberingRouter);

// SMRITI Development Intelligence Center API routes
app.use("/api", devTrackerRouter);

// SMRITI Human-Readable Error Policy (HREP) GLOBAL HANDLER
const hrepErrorHandler = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[SMRITI HREP] Unhandled Exception caught:", err);

  let title = "System Error";
  let explanation = "An internal server error occurred while processing the request.";
  let suggestedAction = "Please contact SMRITI support team for assistance.";
  let errorCode = "SMRITI-SYS-001";
  let statusCode = 500;

  if (err && (err.code || err.severity || err.routine)) {
    title = "Database Operations Conflict";
    explanation = "A database operations conflict occurred or referential integrity check failed.";
    suggestedAction = "Ensure that the referenced records exist and that you are not violating database constraints.";
    errorCode = "SMRITI-DATA-001";
    statusCode = 400;
  } else if (err.status === 401 || err.statusCode === 401 || err.message?.includes("Access Denied")) {
    title = "Access Denied";
    explanation = "You do not have permission to access the requested retail resource.";
    suggestedAction = "Verify your credentials and active session configurations, then log in again.";
    errorCode = "SMRITI-PERM-001";
    statusCode = 401;
  } else if (err.status === 404 || err.statusCode === 404) {
    title = "Resource Not Found";
    explanation = "The requested resource could not be located in SMRITI database.";
    suggestedAction = "Verify the identifier and query parameters before attempting again.";
    errorCode = "SMRITI-VAL-001";
    statusCode = 404;
  } else if (err instanceof SyntaxError || err.name === "ValidationError" || err.message?.includes("invalid") || err.message?.includes("Invalid")) {
    title = "Input Data Validation Failed";
    explanation = `The retail input parameters provided were invalid: ${err.message || "Invalid payload format."}`;
    suggestedAction = "Check your payload formatting, data types, and required fields before sending the request.";
    errorCode = "SMRITI-VAL-001";
    statusCode = 400;
  }

  // Generate Reference ID following SMRITI-ERR-YYYYMMDD-XXXXXX format
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
  const referenceId = `SMRITI-ERR-${yyyymmdd}-${randomHex}`;

  res.status(statusCode).json({
    title,
    explanation,
    suggestedAction,
    referenceId,
    code: errorCode
  });
};

const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.all("/api/*", (req, res) => {
      res.status(404).json({ error: `API endpoint ${req.method} ${req.originalUrl} not found.` });
    });
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Register HREP global error handler middleware
  app.use(hrepErrorHandler);

  // Load database from file storage
  loadDb();

  // Initialize PostgreSQL standalone database tables & seed data
  await initializePostgres();

  // Perform initial automated scan of codebase for Dev Intelligence Center
  try {
    runScanner();
  } catch (err) {
    console.error("[SDIC] Failed to execute startup scan:", err);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SMRITI] Retail OS running on http://localhost:${PORT}`);
  });
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export { app, startServer };
