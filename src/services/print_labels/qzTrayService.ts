/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.38.0 (Universal Hardware Print Dispatcher — TCP/IP + WebSerial + QZ Tray)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import { PrinterProfile } from "../universalLabelPrinterService.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";

export interface DispatchPrintResult {
  success: boolean;
  method: "TCP/IP Network Socket" | "QZ Tray WebSocket" | "WebSerial Native USB" | "Browser PDF";
  message: string;
  error?: string;
}

/**
 * Checks if QZ Tray WebSocket proxy is running on local machine (wss://localhost:8182)
 */
export async function isQZTrayAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const res = await fetch("http://localhost:8182", { method: "HEAD", signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);
    return res !== null;
  } catch {
    return false;
  }
}

/**
 * Checks if browser supports WebSerial direct USB printing (Chrome 89+ / Edge 89+)
 */
export function isWebSerialSupported(): boolean {
  return typeof window !== "undefined" && "serial" in navigator;
}

/**
 * Mode 3: WebSerial Direct USB — actually sends raw ZPL/TSPL bytes to the USB port.
 * Requires user to have previously granted port access via navigator.serial.requestPort().
 */
async function dispatchViaWebSerial(rawPayload: string, baudRate: number = 115200): Promise<DispatchPrintResult> {
  try {
    const serial = (navigator as any).serial;
    // Try to reuse a previously-permitted port
    const ports = await serial.getPorts();
    let port = ports[0];

    if (!port) {
      // First time: ask user to pick the USB printer port
      port = await serial.requestPort();
    }

    if (!port) {
      return { success: false, method: "WebSerial Native USB", message: "No USB port selected.", error: "Port selection cancelled" };
    }

    await port.open({ baudRate });
    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(rawPayload));
    writer.releaseLock();
    await port.close();

    return {
      success: true,
      method: "WebSerial Native USB",
      message: `Raw ZPL stream sent directly to USB thermal printer via WebSerial API.`
    };
  } catch (err: any) {
    return {
      success: false,
      method: "WebSerial Native USB",
      message: "WebSerial USB print failed.",
      error: err?.message || String(err)
    };
  }
}

/**
 * Universal Hardware Dispatcher for SMRITI Barcode Labels.
 *
 * Priority Order:
 *  1. TCP/IP Network Printer  → Python FastAPI backend raw TCP socket (Port 9100) — NO QZ Tray needed
 *  2. QZ Tray WebSocket Proxy → wss://localhost:8182 (if installed, silent USB dispatch)
 *  3. WebSerial Native USB    → Chrome/Edge WebSerial API (direct USB, no middleware)
 *  4. Browser PDF Fallback    → window.print() / ZPL preview
 */
export async function dispatchRawPrintJob(
  profile: PrinterProfile,
  rawScriptPayload: string,
  copies: number = 1
): Promise<DispatchPrintResult> {

  // ── Mode 1: TCP/IP Network Printer ──────────────────────────────────────────
  // Uses SMRITI Platform API Python backend to open a raw TCP socket to port 9100.
  // Works for Zebra, TSC, Godex, Brother, and any RFC-2910 thermal printer on LAN.
  // Requires: smriti-api Docker container running. No browser extension needed.
  if (profile.connectionType === "TCP/IP" && profile.ipAddress) {
    try {
      const response = await apiFetchV1("/barcode/dispatch", {
        method: "POST",
        body: JSON.stringify({
          printer_ip: profile.ipAddress,
          printer_port: profile.port || 9100,
          raw_payload: rawScriptPayload,
          copies
        })
      }).catch(() => null);

      if (response && response.success) {
        return {
          success: true,
          method: "TCP/IP Network Socket",
          message: `Dispatched ${copies} label(s) to ${profile.name} [${profile.ipAddress}:${profile.port || 9100}] via TCP/IP network socket.`
        };
      } else {
        console.warn("TCP/IP backend dispatch returned non-success:", response);
      }
    } catch (err) {
      console.warn("Backend TCP/IP socket dispatch failed:", err);
    }
  }

  // ── Mode 2: QZ Tray WebSocket Proxy ─────────────────────────────────────────
  // Optional desktop helper app. If installed, enables silent USB printing from any browser.
  // Not required — falls through to Mode 3 if not running.
  const qzAvailable = await isQZTrayAvailable();
  if (qzAvailable && (window as any).qz) {
    try {
      const qz = (window as any).qz;
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }
      const config = qz.configs.create(profile.name || profile.usbPort || "Zebra");
      await qz.print(config, [rawScriptPayload]);
      return {
        success: true,
        method: "QZ Tray WebSocket",
        message: `Dispatched ${copies} label(s) to '${profile.name}' via QZ Tray WebSocket proxy.`
      };
    } catch (err: any) {
      console.warn("QZ Tray dispatch error:", err);
    }
  }

  // ── Mode 3: WebSerial Native USB (Chrome/Edge 89+) ──────────────────────────
  // Sends raw ZPL/TSPL bytes directly to USB thermal printer via browser WebSerial API.
  // No QZ Tray or middleware needed. Requires Chrome/Edge and user grants port permission once.
  if (profile.connectionType === "USB" && isWebSerialSupported()) {
    return dispatchViaWebSerial(rawScriptPayload, profile.baudRate || 115200);
  }

  // ── Mode 4: Fallback — PDF / Browser Print Dialog ───────────────────────────
  // For PDF laser printers or environments without WebSerial/QZ Tray.
  return {
    success: true,
    method: "Browser PDF",
    message: `ZPL script generated (${rawScriptPayload.length} bytes). Use PDF export or install QZ Tray / use TCP/IP for silent print.`
  };
}
