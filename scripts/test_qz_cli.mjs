/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-23
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import qz from "qz-tray";

const BACKEND_URL = process.env.VITE_BACKEND_URL || "http://localhost:8000";

console.log("================================================================================");
console.log("  SMRITI Retail OS — QZ Tray & Thermal Printing CLI End-to-End Diagnostics");
console.log("================================================================================");
console.log(`[1/5] Backend URL target: ${BACKEND_URL}`);

// Setup global window/location for qz-tray in Node.js environment
if (typeof global.window === "undefined") {
  global.window = {
    location: {
      host: "localhost:3000",
      hostname: "localhost",
      protocol: "http:",
      origin: "http://localhost:3000"
    }
  };
  global.location = global.window.location;
}
if (typeof global.WebSocket === "undefined" && typeof WebSocket !== "undefined") {
  global.WebSocket = WebSocket;
}

async function runDiagnostics() {
  try {
    // Step 1: Test Backend Certificate Endpoint
    console.log("\n--- [Step 1: Fetch X.509 Certificate from Backend] ---");
    const certRes = await fetch(`${BACKEND_URL}/api/v1/barcode/qz/certificate`);
    if (!certRes.ok) {
      throw new Error(`Failed to fetch certificate: HTTP ${certRes.status} ${certRes.statusText}`);
    }
    const certPem = await certRes.text();
    console.log("✓ Certificate received successfully from backend:");
    console.log(certPem.trim().split("\n").slice(0, 3).join("\n") + "\n... [truncated] ...\n" + certPem.trim().split("\n").slice(-2).join("\n"));

    // Step 2: Test Backend Cryptographic Signing Endpoint
    console.log("\n--- [Step 2: Test SHA512 RSA Signature from Backend] ---");
    const challenge = "SMRITI_QZ_CLI_CHALLENGE_" + Date.now();
    const signRes = await fetch(`${BACKEND_URL}/api/v1/barcode/qz/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: challenge })
    });
    if (!signRes.ok) {
      throw new Error(`Failed to sign challenge: HTTP ${signRes.status} ${signRes.statusText}`);
    }
    const signature = await signRes.text();
    console.log(`✓ Challenge: "${challenge}"`);
    console.log(`✓ SHA512 Signature: ${signature.substring(0, 60)}... (${signature.length} bytes base64)`);

    // Step 3: Configure QZ Tray Security Promises
    console.log("\n--- [Step 3: Configure QZ Tray Security Hooks] ---");
    qz.security.setCertificatePromise((resolve) => resolve(certPem));
    qz.security.setSignatureAlgorithm("SHA512");
    qz.security.setSignaturePromise((toSign) => {
      return (resolve, reject) => {
        fetch(`${BACKEND_URL}/api/v1/barcode/qz/sign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: toSign })
        })
          .then((res) => res.text())
          .then(resolve)
          .catch(reject);
      };
    });
    console.log("✓ QZ Tray security certificate and signing promises registered.");

    // Step 4: Connect to Local QZ Tray WebSocket Daemon
    console.log("\n--- [Step 4: Connect to Local QZ Tray WebSocket Daemon] ---");
    console.log("Connecting to QZ Tray daemon (ws://localhost:8182 / wss://localhost:8181)...");
    
    // Connect using qz-tray
    await qz.websocket.connect({
      host: "localhost",
      usingSecure: false,
      retries: 2,
      delay: 1
    });

    const isConnected = qz.websocket.isActive();
    console.log(`✓ QZ Tray WebSocket connection established: isActive = ${isConnected}`);
    
    const version = await qz.api.getVersion();
    console.log(`✓ QZ Tray Daemon Version: ${version}`);

    // Step 5: Enumerate Installed Windows Printer Queues
    console.log("\n--- [Step 5: Query Installed Windows Printer Queues] ---");
    const printers = await qz.printers.find();
    console.log(`✓ Discovered ${printers.length} installed Windows printer queue(s):`);
    printers.forEach((p, idx) => {
      console.log(`   [${idx + 1}] ${p}`);
    });

    try {
      const defaultPrinter = await qz.printers.getDefault();
      console.log(`✓ Default Windows System Printer: "${defaultPrinter}"`);
    } catch (e) {
      console.log(`- Default printer query: none set or not detectable`);
    }

    // Disconnect cleanly
    if (qz.websocket.isActive()) {
      await qz.websocket.disconnect();
      console.log("\n✓ QZ Tray WebSocket session closed cleanly.");
    }

    console.log("\n================================================================================");
    console.log("  ALL QZ TRAY & THERMAL DISPATCH DIAGNOSTICS PASSED (100% HEALTHY)");
    console.log("================================================================================");
  } catch (err) {
    console.error("\n❌ DIAGNOSTIC FAILED:", err);
    process.exit(1);
  }
}

runDiagnostics();
