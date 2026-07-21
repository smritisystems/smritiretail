/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { TerminalEventBus } from "../components/terminal/TerminalEventBus";

export interface HardwareStatus {
  scanner: "OK" | "DISCONNECTED" | "ERROR";
  printer: "Ready" | "OFFLINE" | "PAPER_OUT";
  cashDrawer: "Closed" | "Open";
  scale: "Connected" | "Disconnected";
  poleDisplay: "Active" | "Inactive";
}

export class HardwareAdapterRegistry {
  private static status: HardwareStatus = {
    scanner: "OK",
    printer: "Ready",
    cashDrawer: "Closed",
    scale: "Connected",
    poleDisplay: "Active"
  };

  public static getStatus(): HardwareStatus {
    return { ...this.status };
  }

  // Scanner Adapter Trigger
  public static triggerScan(barcode: string): void {
    console.log(`[HardwareAdapterRegistry] Barcode Scanned: ${barcode}`);
    TerminalEventBus.emit("HARDWARE_BARCODE_SCANNED", { barcode, timestamp: Date.now() });
  }

  // Cash Drawer Pulse Trigger
  public static openCashDrawer(): boolean {
    console.log("[HardwareAdapterRegistry] Cash Drawer Pulse Triggered (RJ11/COM)");
    this.status.cashDrawer = "Open";
    TerminalEventBus.emit("HARDWARE_DRAWER_OPENED");
    setTimeout(() => {
      this.status.cashDrawer = "Closed";
      TerminalEventBus.emit("HARDWARE_DRAWER_CLOSED");
    }, 3000);
    return true;
  }

  // Print ESC/POS Receipt Adapter
  public static printReceipt(rawContent: string): boolean {
    console.log("[HardwareAdapterRegistry] ESC/POS Thermal Print Payload Sent");
    TerminalEventBus.emit("HARDWARE_PRINT_SENT", { rawContent, timestamp: Date.now() });
    return true;
  }

  // Weighing Scale Reader Adapter
  public static readScaleWeight(): number {
    // Return mock weight or reading
    return 0.00;
  }

  // Customer Pole Display Update Adapter
  public static updatePoleDisplay(line1: string, line2: string): void {
    console.log(`[HardwareAdapterRegistry] Pole Display Line 1: ${line1} | Line 2: ${line2}`);
    TerminalEventBus.emit("HARDWARE_POLE_DISPLAY_UPDATED", { line1, line2 });
  }
}
