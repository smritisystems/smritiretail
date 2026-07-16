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
import { sessions } from "../state/store.js";
import { container } from "../bootstrap/di.js";

export const sessionResolver = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = (req.headers["x-session-token"] as string) || 
                (req.headers["authorization"]?.startsWith("Bearer ") ? req.headers["authorization"].split(" ")[1] : undefined);

  if (token && sessions[token]) {
    const session = sessions[token];
    
    // Check if session has expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      delete sessions[token];
    } else {
      (req as any).sessionInfo = session;
      try {
        const user = await container.users.getByUsername(session.username);
        if (user) {
          (req as any).user = user;
          // Populate headers for backward compatibility with down-stream routing checks
          req.headers["x-user-name"] = user.username;
          req.headers["x-user-role"] = user.role;
          req.headers["x-user-branch"] = user.branch || "HQ";
        }
      } catch (err) {
        console.error("[Session Resolver] Failed to fetch user for session:", err);
      }
    }
  }
  next();
};
