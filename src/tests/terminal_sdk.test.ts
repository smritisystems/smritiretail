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

import { describe, it, expect } from "vitest";
import { TerminalManifest } from "../components/terminal/TerminalManifest";
import { TerminalEventBus } from "../components/terminal/TerminalEventBus";
import { HardwareAdapterRegistry } from "../hardware/HardwareAdapterRegistry";
import { DrawerRegistry } from "../components/terminal/DrawerRegistry";

describe("SMRITI Terminal Framework v1.0 — Core SDK & Hardware Tests", () => {
  it("TerminalManifest correctly registers and retrieves all core terminals", () => {
    const pos = TerminalManifest.get("pos");
    expect(pos).toBeDefined();
    expect(pos?.name).toBe("Retail POS Terminal");

    const po = TerminalManifest.get("po");
    expect(po).toBeDefined();
    expect(po?.name).toBe("Purchase Order Terminal");

    const grn = TerminalManifest.get("grn");
    expect(grn).toBeDefined();
    expect(grn?.name).toBe("Goods Receipt Note (GRN) Terminal");

    const transfer = TerminalManifest.get("transfer");
    expect(transfer).toBeDefined();
    expect(transfer?.name).toBe("Stock Transfer Terminal");

    const count = TerminalManifest.get("count");
    expect(count).toBeDefined();
    expect(count?.name).toBe("Physical Stock Audit Terminal");
  });

  it("DrawerRegistry registers and retrieves default GST and Transport drawers", () => {
    const gstDrawer = DrawerRegistry.get("gst");
    expect(gstDrawer).toBeDefined();
    expect(gstDrawer?.title).toBe("GSTIN & Tax Details");

    const transportDrawer = DrawerRegistry.get("transport");
    expect(transportDrawer).toBeDefined();
    expect(transportDrawer?.title).toBe("Logistics & E-Way Bill");
  });

  it("TerminalEventBus correctly emits and receives hardware events", () => {
    let receivedBarcode = "";
    const unsubscribe = TerminalEventBus.on("HARDWARE_BARCODE_SCANNED", (data) => {
      receivedBarcode = data.barcode;
    });

    HardwareAdapterRegistry.triggerScan("8901234567890");
    expect(receivedBarcode).toBe("8901234567890");

    unsubscribe();
  });

  it("HardwareAdapterRegistry openCashDrawer returns true and updates status", () => {
    const success = HardwareAdapterRegistry.openCashDrawer();
    expect(success).toBe(true);
    const status = HardwareAdapterRegistry.getStatus();
    expect(status.cashDrawer).toBe("Open");
  });
});
