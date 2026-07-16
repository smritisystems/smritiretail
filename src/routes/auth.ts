/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.15.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import express from "express";
import crypto from "crypto";
import { sessions } from "../state/store.js";
import { container } from "../bootstrap/di.js";
import { verifyPassword, hashPassword, parseDeviceType, hasPermission } from "../lib/helpers.js";

const router = express.Router();

const failedLoginAttempts: Record<string, { count: number; lockUntil: number }> = {};

router.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || "127.0.0.1";
  const trackingKey = `${ip}:${username}`;

  // Check IP tracking lock first
  const tracking = failedLoginAttempts[trackingKey];
  if (tracking && tracking.count >= 5 && tracking.lockUntil > Date.now()) {
    const waitSec = Math.ceil((tracking.lockUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: `Too many failed login attempts. Please wait ${waitSec} seconds before trying again.`
    });
  }

  // Find user in unified database
  const user = await container.users.getByUsername(username);

  if (!user) {
    // User does not exist, track failed attempt under trackingKey
    if (!failedLoginAttempts[trackingKey]) {
      failedLoginAttempts[trackingKey] = { count: 1, lockUntil: 0 };
    } else {
      failedLoginAttempts[trackingKey].count += 1;
      if (failedLoginAttempts[trackingKey].count >= 5) {
        failedLoginAttempts[trackingKey].lockUntil = Date.now() + 30000; // 30 seconds lock
      }
    }
    return res.status(401).json({ error: "Invalid credentials." });
  }

  // User exists, check status first
  if (user.status === "Locked") {
    return res.status(403).json({
      error: "Access Denied: Your account has been locked. Please contact your administrator."
    });
  }
  if (user.status !== "Active") {
    return res.status(403).json({
      error: `Access Denied: Your account is current '${user.status}'.`
    });
  }

  // Check password
  if (!verifyPassword(password, user.passwordHash)) {
    // Increment failed attempts
    if (!failedLoginAttempts[trackingKey]) {
      failedLoginAttempts[trackingKey] = { count: 1, lockUntil: 0 };
    } else {
      failedLoginAttempts[trackingKey].count += 1;
      if (failedLoginAttempts[trackingKey].count >= 5) {
        failedLoginAttempts[trackingKey].lockUntil = Date.now() + 30000; // 30 seconds lock
      }
    }

    const failedCount = (user.failedAttempts || 0) + 1;
    if (failedCount >= 5) {
      await container.users.update(user.id, {
        status: "Locked",
        lockedUntil: new Date(Date.now() + 30000).toISOString(),
        failedAttempts: 0
      });
      return res.status(403).json({
        error: "Too many failed login attempts. Your account has been locked. Please contact your administrator."
      });
    }

    await container.users.update(user.id, {
      failedAttempts: failedCount
    });

    const attemptsLeft = 5 - failedCount;
    return res.status(401).json({
      error: `Invalid credentials. Attempt ${failedCount} of 5 before account lock.`
    });
  }

  // Clear tracking and failed attempts on success
  delete failedLoginAttempts[trackingKey];
  if (user.failedAttempts !== 0 || user.lockedUntil !== undefined) {
    await container.users.update(user.id, {
      failedAttempts: 0,
      lockedUntil: undefined
    });
  }

  // Auto-upgrade legacy plaintext passwords to hashed on login
  if (!user.passwordHash.startsWith("pbkdf2$")) {
    const newHash = hashPassword(password);
    await container.users.update(user.id, { passwordHash: newHash });
    user.passwordHash = newHash;
  }

  const token = "token-" + crypto.randomBytes(24).toString("hex");
  const userAgent = req.headers["user-agent"] || "";
  const deviceType = parseDeviceType(userAgent);

  sessions[token] = {
    username: user.username,
    userId: user.userId || user.id,
    name: user.fullName,
    role: user.role,
    userAgent,
    deviceType,
    ipAddress: ip,
    loginAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  res.json({
    success: true,
    token,
    user
  });
});

router.get("/api/auth/me", async (req, res) => {
  const token = req.headers["x-session-token"] as string;
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const session = sessions[token];
  const user = await container.users.getByUsername(session.username);
  if (!user) {
    return res.status(401).json({ error: "User profile not found." });
  }

  res.json({
    role: user.role,
    name: user.fullName,
    user,
    sessionInfo: {
      token,
      deviceType: session.deviceType,
      ipAddress: session.ipAddress,
      loginAt: session.loginAt,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent
    }
  });
});

router.post("/api/auth/logout", (req, res) => {
  const token = req.headers["x-session-token"] as string;
  if (token && sessions[token]) {
    delete sessions[token];
  }
  res.json({ success: true });
});

// GET operator sessions
router.get("/api/users/:id/sessions", async (req, res) => {
  const userId = req.params.id;
  const currentUserId = req.headers["x-user-id"] as string;

  // Allow Store Manager (staff.manage) or self-inquiry
  if (!hasPermission(req, "staff.manage") && currentUserId !== userId) {
    return res.status(403).json({ error: "Access Denied: You cannot query session tokens for other operators." });
  }

  const userObj = await container.users.getById(userId);
  if (!userObj) {
    return res.status(404).json({ error: "User not found." });
  }

  const userSessions = Object.keys(sessions)
    .filter(token => sessions[token].username === userObj.username)
    .map(token => ({
      token,
      ...sessions[token]
    }));

  res.json(userSessions);
});

// Revoke sessions
router.post("/api/sessions/:token/revoke", async (req, res) => {
  const tokenToRevoke = req.params.token;
  const currentUserId = req.headers["x-user-id"] as string;

  const targetSession = sessions[tokenToRevoke];
  if (!targetSession) {
    return res.status(404).json({ error: "Session token not found or already expired." });
  }

  // Allow Store Manager (staff.manage) or self-revocation
  const userObj = await container.users.getByUsername(targetSession.username);
  const targetUserId = userObj ? (userObj.userId || userObj.id) : "";

  if (!hasPermission(req, "staff.manage") && currentUserId !== targetUserId) {
    return res.status(403).json({ error: "Access Denied: You cannot revoke sessions of other operators." });
  }

  delete sessions[tokenToRevoke];

  res.json({ success: true, revokedToken: tokenToRevoke });
});

export default router;
