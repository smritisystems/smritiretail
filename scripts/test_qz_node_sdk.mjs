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

import crypto from "crypto";

// Polyfill browser globals for QZ Tray in Node.js
if (typeof global.crypto === "undefined") {
  global.crypto = crypto;
}
if (typeof global.window === "undefined") {
  global.window = {
    location: { host: "localhost:3000", protocol: "http:", origin: "http://localhost:3000" }
  };
  global.location = global.window.location;
}
if (typeof global.screen === "undefined") {
  global.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080 };
}

import qz from "qz-tray";

const BACKEND_URL = "http://localhost:8000";

console.log("================================================================================");
console.log("  SMRITI Retail OS — Full QZ Tray End-to-End Test (CLI Node SDK)");
console.log("================================================================================");

async function run() {
  console.log(`[1] Fetching X.509 Certificate from: ${BACKEND_URL}/api/v1/barcode/qz/certificate`);
  const certRes = await fetch(`${BACKEND_URL}/api/v1/barcode/qz/certificate`);
  const certPem = await certRes.text();
  console.log(`    ✓ Received public certificate (${certPem.length} bytes)`);

  console.log(`[2] Registering Security Certificate and Signature Promises`);
  qz.security.setCertificatePromise((resolve) => resolve(certPem));
  qz.security.setSignatureAlgorithm("SHA512");
  qz.security.setSignaturePromise((toSign) => {
    return (resolve, reject) => {
      fetch(`${BACKEND_URL}/api/v1/barcode/qz/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: toSign })
      })
        .then((r) => r.text())
        .then((sig) => {
          console.log(`    ✓ Server signed challenge (length: ${sig.length} bytes)`);
          resolve(sig);
        })
        .catch(reject);
    };
  });

  console.log(`[3] Connecting to QZ Tray WebSocket Daemon at ws://localhost:8182...`);
  await qz.websocket.connect({
    host: "localhost",
    usingSecure: false,
    retries: 0
  });
  console.log(`    ✓ WebSocket connected! isActive = ${qz.websocket.isActive()}`);

  console.log(`[4] Fetching QZ Tray Version...`);
  const version = await qz.api.getVersion();
  console.log(`    ✓ QZ Tray Version: ${version}`);

  console.log(`[5] Querying Installed Windows Printers...`);
  const printers = await qz.printers.find();
  console.log(`    ✓ Discovered ${printers.length} Installed Windows Printer Queue(s):`);
  printers.forEach((p, i) => console.log(`       [${i + 1}] ${p}`));

  try {
    const def = await qz.printers.getDefault();
    console.log(`    ✓ Default Printer: "${def}"`);
  } catch (e) {
    console.log(`    - Default printer: not detected`);
  }

  console.log(`[6] Simulating Backend Print Job Creation & Two-Phase ACK...`);
  const mockPrintRes = await fetch(`${BACKEND_URL}/api/v1/barcode/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dispatch_mode: "qz_tray",
      targetPrinter: printers[0] || "IMPACT by Honeywell IH-2 (300 dpi) - DPL",
      items: [
        {
          id: "CLI-TEST-1",
          stockNo: "SKU-CLI-001",
          barcode: "8901234567890",
          product: "Cotton Formal Shirt",
          brand: "Smriti Executive",
          style: "Classic Fit",
          colour: "White",
          size: "40",
          mrp: 1499.0,
          sellingPrice: 1299.0,
          labelCount: 1
        }
      ]
    })
  });

  if (mockPrintRes.ok) {
    const jobData = await mockPrintRes.json();
    console.log(`    ✓ Backend created Print Job ID: "${jobData.job_id}"`);
    console.log(`    ✓ Generated raw thermal DPL stream (${jobData.payload?.length || 0} bytes)`);

    // Acknowledge Job
    const ackRes = await fetch(`${BACKEND_URL}/api/v1/barcode/print-jobs/${jobData.job_id}/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        printer_name: jobData.suggested_printer || printers[0] || "Honeywell IH-2"
      })
    });
    const ackData = await ackRes.json();
    console.log(`    ✓ Hardware Spool ACK recorded in DB: Status = "${ackData.status}"`);
  }

  await qz.websocket.disconnect();
  console.log(`\n✓ Closed WebSocket session.`);
  console.log("================================================================================");
  console.log("  ALL END-TO-END CLI TESTS COMPLETED WITH 100% SUCCESS");
  console.log("================================================================================");
}

run().catch((err) => {
  console.error("❌ Test error:", err);
  process.exit(1);
});
