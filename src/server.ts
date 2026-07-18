import http, { IncomingMessage, ServerResponse } from "http";
import crypto from "crypto";
import { users, sessions } from "./state/store.js";
import { verifyPassword } from "./lib/helpers.js";

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function jsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  const json = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json).toString()
  });
  res.end(json);
}

function getSessionToken(req: IncomingMessage): string | null {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const sessionToken = req.headers["x-session-token"];
  if (typeof sessionToken === "string") {
    return sessionToken;
  }
  return null;
}

function getSessionUser(req: IncomingMessage) {
  const token = getSessionToken(req);
  if (!token) return null;
  return sessions[token] || null;
}

async function requestHandler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || "";
  if (req.method === "POST" && url === "/api/auth/login") {
    try {
      const body = await parseJsonBody(req);
      const user = users.find(u => u.username === body.username);
      if (!user || !verifyPassword(body.password, user.passwordHash)) {
        jsonResponse(res, 401, { error: "Invalid username or password." });
        return;
      }

      const token = crypto.randomUUID();
      sessions[token] = {
        username: user.username,
        userId: user.userId,
        name: user.fullName,
        role: user.role,
        loginAt: new Date().toISOString()
      };
      jsonResponse(res, 200, { success: true, token, user });
      return;
    } catch (err) {
      jsonResponse(res, 400, { error: "Invalid request payload." });
      return;
    }
  }

  if (req.method === "GET" && url === "/api/auth/me") {
    const session = getSessionUser(req);
    if (!session) {
      jsonResponse(res, 401, { error: "Unauthenticated." });
      return;
    }
    jsonResponse(res, 200, { user: { username: session.username, role: session.role, name: session.name } });
    return;
  }

  if (req.method === "POST" && url === "/api/auth/logout") {
    const token = getSessionToken(req);
    if (token && sessions[token]) {
      delete sessions[token];
    }
    jsonResponse(res, 200, { success: true });
    return;
  }

  if (req.method === "GET" && url === "/api/reports/list") {
    const session = getSessionUser(req);
    if (!session) {
      jsonResponse(res, 401, { error: "Unauthenticated." });
      return;
    }
    jsonResponse(res, 200, { studios: [], role: session.role });
    return;
  }

  if (req.method === "POST" && url === "/api/system/audit-logs") {
    const session = getSessionUser(req);
    if (!session) {
      jsonResponse(res, 401, { error: "Unauthenticated." });
      return;
    }
    jsonResponse(res, 200, { success: true });
    return;
  }

  if (req.method === "POST" && (url === "/api/sales/quotations" || url === "/api/sales/invoices")) {
    const session = getSessionUser(req);
    if (!session) {
      jsonResponse(res, 401, { error: "Unauthenticated." });
      return;
    }
    if (session.role === "Report User") {
      jsonResponse(res, 403, { error: "Operating under a Read-Only Report User role." });
      return;
    }
    jsonResponse(res, 200, { success: true });
    return;
  }

  jsonResponse(res, 404, { error: "Not found." });
}

export const app = http.createServer(requestHandler);
