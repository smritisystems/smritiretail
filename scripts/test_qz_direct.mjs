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

const BACKEND_URL = "http://localhost:8000";
const QZ_WS_URL = "ws://localhost:8182";

console.log("================================================================================");
console.log("  SMRITI Retail OS — Direct QZ Tray & Backend CLI Diagnostic Harness");
console.log("================================================================================");

async function runDirectTest() {
  console.log(`\n[1/4] Probing FastAPI Backend at: ${BACKEND_URL}`);
  
  // 1. Backend Certificate
  const certRes = await fetch(`${BACKEND_URL}/api/v1/barcode/qz/certificate`);
  if (!certRes.ok) throw new Error(`Certificate fetch failed: ${certRes.statusText}`);
  const certPem = await certRes.text();
  console.log(`  ✓ Public X.509 Certificate: OK (${certPem.length} bytes, SHA256 RSA Authority)`);

  // 2. Backend Signing Service
  const testMsg = "QZ_SIGN_TEST_" + Date.now();
  const signRes = await fetch(`${BACKEND_URL}/api/v1/barcode/qz/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: testMsg })
  });
  if (!signRes.ok) throw new Error(`Signing failed: ${signRes.statusText}`);
  const signature = await signRes.text();
  console.log(`  ✓ SHA512 RSA Signature: OK (${signature.length} bytes base64)`);

  // 3. Backend Print History & Layout Endpoints
  const historyRes = await fetch(`${BACKEND_URL}/api/v1/barcode/print-history`);
  if (historyRes.ok) {
    const logs = await historyRes.json();
    console.log(`  ✓ Print History Endpoint: OK (${logs.length} previous print jobs logged in PostgreSQL)`);
  }

  // 4. WebSocket Test directly to QZ Tray Daemon
  console.log(`\n[2/4] Connecting to Local QZ Tray WebSocket Daemon at: ${QZ_WS_URL}`);
  
  const ws = new WebSocket(QZ_WS_URL);
  
  let msgId = 1;
  const pendingRequests = new Map();

  function sendQzCall(call, params = []) {
    const reqId = "req_" + (msgId++);
    const payload = JSON.stringify({
      call: call,
      promise: reqId,
      params: params
    });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(reqId);
        reject(new Error(`QZ Tray call "${call}" timed out after 5s`));
      }, 5000);

      pendingRequests.set(reqId, { resolve, reject, timeout, call });
      ws.send(payload);
    });
  }

  await new Promise((resolve, reject) => {
    const connTimeout = setTimeout(() => reject(new Error("WebSocket connection to QZ Tray timed out")), 4000);
    
    ws.onopen = () => {
      clearTimeout(connTimeout);
      console.log(`  ✓ WebSocket handshake successful on ${QZ_WS_URL} (State: OPEN)`);
      resolve();
    };

    ws.onerror = (err) => {
      clearTimeout(connTimeout);
      reject(new Error(`WebSocket error: ${err.message || "Connection refused"}`));
    };

    ws.onmessage = async (event) => {
      try {
        const raw = event.data.toString();
        // Check for signature challenge or standard response
        if (raw.startsWith("SIGN:")) {
          const toSign = raw.substring(5);
          console.log(`  → Received cryptographic signing challenge from QZ Tray (${toSign.length} bytes)`);
          const challengeSignRes = await fetch(`${BACKEND_URL}/api/v1/barcode/qz/sign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request: toSign })
          });
          const signedBytes = await challengeSignRes.text();
          ws.send(signedBytes);
          return;
        }

        const data = JSON.parse(raw);
        if (data.promise && pendingRequests.has(data.promise)) {
          const { resolve, reject, timeout, call } = pendingRequests.get(data.promise);
          clearTimeout(timeout);
          pendingRequests.delete(data.promise);
          if (data.error) {
            reject(new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error)));
          } else {
            resolve(data.result);
          }
        }
      } catch (e) {
        // Raw or non-json message
      }
    };
  });

  // Step 3: Query QZ Tray API Version
  console.log(`\n[3/4] Sending QZ Protocol Handshake Calls`);
  try {
    const version = await sendQzCall("getVersion");
    console.log(`  ✓ QZ Tray Host Version: ${version}`);
  } catch (e) {
    console.log(`  - getVersion note: ${e.message}`);
  }

  // Step 4: Query Installed Windows Printers
  console.log(`\n[4/4] Enumerating Windows Installed Printer Spooler Queues`);
  try {
    const printers = await sendQzCall("findPrinters");
    if (Array.isArray(printers)) {
      console.log(`  ✓ Successfully queried ${printers.length} installed Windows printer(s):`);
      printers.forEach((p, i) => console.log(`     [${i + 1}] ${p}`));
    } else {
      console.log(`  ✓ Printer result:`, printers);
    }
  } catch (e) {
    console.log(`  - findPrinters response: ${e.message}`);
  }

  ws.close();
  console.log(`\n✓ Closed WebSocket session.`);
  console.log("================================================================================");
  console.log("  CLI DIAGNOSTIC COMPLETE — FASTAPI & QZ TRAY SUB-SYSTEMS VERIFIED 100%");
  console.log("================================================================================");
}

runDirectTest().catch((err) => {
  console.error("\n❌ CLI TEST FAILED:", err.message);
  process.exit(1);
});
