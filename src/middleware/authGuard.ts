/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.0
 * Created      : 2026-07-15
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * HOTFIX-001 — Global Authentication Enforcement
 * Priority   : P0 (Security)
 * Ticket     : HOTFIX-001
 * Independent of Master Command 2
 *
 * Purpose:
 *   Express middleware that enforces an authentication gate on every /api/ route.
 *   Accepts two authentication paths (transition period — Auth Strangler-Fig v3.21.0):
 *
 *   Path 1 (legacy)   — Express session token, validated by sessionResolver before this.
 *                        (req as any).sessionInfo is populated when valid.
 *   Path 2 (FastAPI)  — JWT Bearer token issued by FastAPI /api/v1/auth/login.
 *                        Validated locally using HS256 + JWT_SECRET_KEY (no round-trip).
 *
 *   Once Auth migration is complete (v3.22.0), Path 1 will be removed.
 *
 * Public routes exempt from authentication (see HOTFIX_PUBLIC_PATHS in server.ts):
 *   POST /api/auth/login
 *   POST /api/auth/logout
 *   GET  /api/auth/me      (has its own session check; kept in allowlist for clarity)
 */

import express from "express";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

// Support either standard JWT_SECRET_KEY or legacy JWT_SECRET environment variable.
const JWT_SECRET = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET || "";

// ─── JWT HS256 local verifier ─────────────────────────────────────────────────
// Uses the same JWT_SECRET_KEY as FastAPI. No external dependency required.
// Compatible with all Node.js versions >= 14.
const _b64urlToB64 = (s: string): string =>
  s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");

const _verifyJwt = (token: string, secret: string): Record<string, any> | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    if (sig !== expected) return null;
    const claims = JSON.parse(
      Buffer.from(_b64urlToB64(payload), "base64").toString("utf8")
    );
    // Reject expired tokens
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * requireAuth
 *
 * Express middleware. Accepts either:
 *   1. A valid Express session (sessionInfo set by sessionResolver) — legacy path.
 *   2. A valid FastAPI JWT Bearer token (Authorization: Bearer <jwt>) — migration path.
 *
 * Returns HREP-compliant 401 if neither is present/valid.
 */
export const requireAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  // ── Path 1: legacy Express session (set by sessionResolver) ─────────────
  if ((req as any).sessionInfo) {
    next();
    return;
  }

  // ── Path 2: FastAPI JWT Bearer token ────────────────────────────────────
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    if (!JWT_SECRET) {
      console.error("[AuthGuard] JWT_SECRET_KEY is not configured in Express process. FastAPI JWT validation cannot proceed.");
      res.status(401).json({
        title: "Authentication Configuration Missing",
        explanation:
          "The Express legacy backend cannot validate FastAPI Bearer tokens because JWT_SECRET_KEY is not configured.",
        suggestedAction:
          "Set JWT_SECRET_KEY in the Express environment or .env file to match the Python backend, then restart the server.",
        referenceId: "SMRITI-AUTH-001",
        code: "SMRITI-PERM-001"
      });
      return;
    }

    const token = authHeader.slice(7);
    const claims = _verifyJwt(token, JWT_SECRET);
    if (claims) {
      // Populate headers for downstream Express middleware compatibility
      if (claims.sub)  req.headers["x-user-id"]   = String(claims.sub);
      if (claims.role) req.headers["x-user-role"]  = String(claims.role);
      next();
      return;
    }
  }

  // ── Neither path succeeded ───────────────────────────────────────────────
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
  const referenceId = `SMRITI-ERR-${yyyymmdd}-${randomHex}`;

  res.status(401).json({
    title: "Authentication Required",
    explanation:
      "You must be logged in to access this SMRITI Retail OS resource. " +
      "Your session may have expired or was never established.",
    suggestedAction:
      "Please log in with your SMRITI credentials and try again. " +
      "If the problem persists, contact your store administrator.",
    referenceId,
    code: "SMRITI-PERM-001",
  });
};
