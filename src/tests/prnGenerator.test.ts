/**
 * Project      : SMRITI Retail OS
 * Test Suite   : SCS-DXP-001 DocumentService Tests
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { DocumentService } from "../dop/core/DocumentService.ts";

describe("SCS-DXP-001 DocumentService Tests", () => {
  it("should execute BARCODE_LABEL document output", async () => {
    const res = await DocumentService.output({
      documentType: "BARCODE_LABEL",
      referenceId: "SKU-TSHIRT-001",
      channel: "PRINT",
      data: {},
      items: [
        { itemCode: "P-101", itemName: "Classic Cotton T-Shirt", barcode: "8901234567890", mrp: 699, sellingPrice: 499, quantity: 2 }
      ]
    });

    expect(res.jobId).toBeDefined();
    expect(res.lifecycleState).toBe("DELIVERED");
    expect(res.labelsOrPagesProcessed).toBe(2);
  });

  it("should generate interactive preview SVG data URL", async () => {
    const previewUrl = await DocumentService.preview({
      documentType: "INVOICE",
      referenceId: "INV-2026-0001",
      data: { customerName: "Acme Retail Store" }
    });

    expect(previewUrl).toContain("svg");
    expect(previewUrl).toContain("INVOICE: INV-2026-0001");
  });
});
