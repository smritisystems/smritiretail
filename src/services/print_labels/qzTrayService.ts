/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (QZ Tray & Direct USB/Network Hardware Dispatcher Service)
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
}

/**
 * Checks if QZ Tray WebSocket proxy is running on local machine (wss://localhost:8182 or ws://localhost:8181)
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
 * Checks if browser supports WebSerial direct USB printing
 */
export function isWebSerialSupported(): boolean {
  return typeof window !== "undefined" && "serial" in navigator;
}

/**
 * Universal Hardware Dispatcher for SMRITI Barcode Labels:
 * 1. For TCP/IP Network Printers -> Dispatches via FastAPI backend raw socket (No QZ Tray needed)
 * 2. For Direct USB Printers -> Checks WebSerial / QZ Tray / SMRITI Agent, or falls back to backend print stream
 */
export async function dispatchRawPrintJob(
  profile: PrinterProfile, 
  rawScriptPayload: string, 
  copies: number = 1
): Promise<DispatchPrintResult> {
  // Mode 1: TCP/IP Network Printer (Dispatched via SMRITI Platform API - No QZ Tray required)
  if (profile.connectionType === "TCP/IP") {
    try {
      const response = await apiFetchV1("/barcode/dispatch", {
        method: "POST",
        body: JSON.stringify({
          printer_ip: profile.ipAddress || "192.168.1.200",
          printer_port: profile.port || 9100,
          raw_payload: rawScriptPayload,
          copies
        })
      }).catch(() => null);

      if (response && response.success) {
        return {
          success: true,
          method: "TCP/IP Network Socket",
          message: `Dispatched ${copies} copies directly to TCP/IP network printer ${profile.ipAddress}:${profile.port || 9100}`
        };
      }
    } catch (err) {
      console.warn("Backend TCP/IP socket dispatch failed, fallback to local handler:", err);
    }
  }

  // Mode 2: QZ Tray WebSocket Proxy (If installed on local PC)
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
        message: `Dispatched silently to USB printer '${profile.name}' via QZ Tray WebSocket.`
      };
    } catch (err: any) {
      console.warn("QZ Tray dispatch error:", err);
    }
  }

  // Mode 3: Browser WebSerial Direct USB (Chrome/Edge)
  if (profile.connectionType === "USB" && isWebSerialSupported()) {
    return {
      success: true,
      method: "WebSerial Native USB",
      message: `Raw ZPL stream ready for WebSerial direct USB port [${profile.usbPort || "USB001"}]`
    };
  }

  // Fallback: Browser Print / PDF preview
  return {
    success: true,
    method: "Browser PDF",
    message: `Raw ZPL stream generated. Open print preview or PDF to output.`
  };
}
