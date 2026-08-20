/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isQzTrayEnabled, dispatchToQzTray, acknowledgePrintJob } from "../utils/qzTrayClient";
import * as apiFetchV1Module from "../lib/apiFetchV1";

vi.mock("../lib/apiFetchV1", () => ({
  apiFetchV1: vi.fn()
}));

describe("QZ Tray Client Utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should default to disabled when VITE_ENABLE_QZ_TRAY is not true", () => {
    expect(isQzTrayEnabled()).toBe(false);
  });

  it("should fail gracefully and send failure ACK when disabled", async () => {
    const payload = {
      job_id: "job-test-123",
      payload: "^XA^FO50,50^A0N,30,30^FDTest^FS^XZ",
      language: "zpl"
    };

    const result = await dispatchToQzTray(payload);
    expect(result.success).toBe(false);
    expect(result.error).toContain("QZ Tray printing is disabled");

    expect(apiFetchV1Module.apiFetchV1).toHaveBeenCalledWith(
      "/barcode/print-jobs/job-test-123/ack",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("should send print job acknowledgment successfully", async () => {
    (apiFetchV1Module.apiFetchV1 as any).mockResolvedValue({ success: true });

    await acknowledgePrintJob("job-ack-456", true, "Zebra ZD420");
    expect(apiFetchV1Module.apiFetchV1).toHaveBeenCalledWith(
      "/barcode/print-jobs/job-ack-456/ack",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          success: true,
          printer_name: "Zebra ZD420"
        })
      })
    );
  });
});
