/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isQzTrayEnabled,
  initQzSecurity,
  dispatchToQzTray,
  acknowledgePrintJob,
  testQzConnection,
  testQzLabelPrint
} from "../utils/qzTrayClient";
import * as apiFetchV1Module from "../lib/apiFetchV1";
import qz from "qz-tray";

vi.mock("../lib/apiFetchV1", () => ({
  apiFetchV1: vi.fn()
}));

vi.mock("qz-tray", () => ({
  default: {
    security: {
      setCertificatePromise: vi.fn(),
      setSignatureAlgorithm: vi.fn(),
      setSignaturePromise: vi.fn()
    },
    websocket: {
      isActive: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined)
    },
    api: {
      getVersion: vi.fn().mockResolvedValue("2.2.6")
    },
    printers: {
      find: vi.fn().mockResolvedValue([
        "IMPACT by Honeywell IH-2 (300 dpi) - DPL",
        "TSC TE244 Thermal Barcode Printer",
        "Zebra ZD220 Direct Thermal Label"
      ]),
      getDefault: vi.fn().mockResolvedValue("IMPACT by Honeywell IH-2 (300 dpi) - DPL")
    },
    configs: {
      create: vi.fn().mockReturnValue({ encoding: "UTF-8" })
    },
    print: vi.fn().mockResolvedValue(undefined)
  }
}));

describe("QZ Tray Client Utility & Dispatch Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. should detect enabled QZ Tray status based on environment configuration", () => {
    expect(typeof isQzTrayEnabled()).toBe("boolean");
  });

  it("2. should initialize security certificate and SHA512 signature handlers without error", () => {
    initQzSecurity();
    expect(qz.security.setCertificatePromise).toHaveBeenCalled();
    expect(qz.security.setSignatureAlgorithm).toHaveBeenCalledWith("SHA512");
    expect(qz.security.setSignaturePromise).toHaveBeenCalled();
  });

  it("3. should perform diagnostic connection test and enumerate installed Windows printer queues", async () => {
    const res = await testQzConnection();
    expect(res.connected).toBe(true);
    expect(res.version).toBe("2.2.6");
    expect(res.printers).toContain("IMPACT by Honeywell IH-2 (300 dpi) - DPL");
    expect(res.printers.length).toBe(3);
  });

  it("4. should dispatch safe test calibration label to target printer", async () => {
    const res = await testQzLabelPrint("IMPACT by Honeywell IH-2 (300 dpi) - DPL", "DPL");
    expect(res.success).toBe(true);
    expect(res.printerName).toBe("IMPACT by Honeywell IH-2 (300 dpi) - DPL");
    expect(qz.print).toHaveBeenCalled();
  });

  it("5. should dispatch raw barcode payload to target printer and acknowledge job to backend", async () => {
    (apiFetchV1Module.apiFetchV1 as any).mockResolvedValue({ success: true });

    const payload = {
      job_id: "job-test-123",
      payload: "\x02L\nD11\n121100000200050SMRITI TEST\nQ0001\nE\n",
      language: "dpl",
      suggested_printer: "IMPACT by Honeywell IH-2 (300 dpi) - DPL"
    };

    const result = await dispatchToQzTray(payload, "IMPACT by Honeywell IH-2 (300 dpi) - DPL");
    expect(result.success).toBe(true);
    expect(result.printerName).toBe("IMPACT by Honeywell IH-2 (300 dpi) - DPL");

    expect(apiFetchV1Module.apiFetchV1).toHaveBeenCalledWith(
      "/barcode/print-jobs/job-test-123/ack",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          success: true,
          printer_name: "IMPACT by Honeywell IH-2 (300 dpi) - DPL"
        })
      })
    );
  });

  it("6. should send failure acknowledgment to backend if print dispatch encounters error", async () => {
    (qz.print as any).mockRejectedValueOnce(new Error("Printer buffer overflow"));

    const payload = {
      job_id: "job-err-456",
      payload: "^XA^FO50,50^FDError^FS^XZ",
      suggested_printer: "Zebra ZD220"
    };

    const result = await dispatchToQzTray(payload, "Zebra ZD220");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Printer buffer overflow");

    expect(apiFetchV1Module.apiFetchV1).toHaveBeenCalledWith(
      "/barcode/print-jobs/job-err-456/ack",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          success: false,
          printer_name: "Zebra ZD220",
          error_message: "Printer buffer overflow"
        })
      })
    );
  });
});
