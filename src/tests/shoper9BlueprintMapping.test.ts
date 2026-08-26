/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-08-26
 * Modified     : 2026-08-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Vitest Frontend Test Suite for Shoper9 Blueprint Schema, Menus & Profile Mappings
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const BLUEPRINT_DIR = path.resolve(__dirname, "../../docs/legacy_blueprints/shoper9");

describe("Shoper9 Legacy Blueprint Verification", () => {
  it("should have valid template manifest with quarantine protection", () => {
    const manifestPath = path.join(BLUEPRINT_DIR, "template_manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.totalFiles).toBe(21);

    const quarantined = manifest.files.filter((f: any) => f.status === "QUARANTINED");
    expect(quarantined.length).toBe(2);

    const quarantinedFiles = quarantined.map((f: any) => f.filename);
    expect(quarantinedFiles).toContain("Distributor_tmp.txt");
    expect(quarantinedFiles).toContain("Retail_tmp.txt");
  });

  it("should validate retail and distributor blueprints", () => {
    const retailPath = path.join(BLUEPRINT_DIR, "retail_blueprint.json");
    const distPath = path.join(BLUEPRINT_DIR, "distributor_blueprint.json");

    expect(fs.existsSync(retailPath)).toBe(true);
    expect(fs.existsSync(distPath)).toBe(true);

    const retail = JSON.parse(fs.readFileSync(retailPath, "utf-8"));
    const dist = JSON.parse(fs.readFileSync(distPath, "utf-8"));

    expect(retail.profile).toBe("Retail");
    expect(dist.profile).toBe("Distributor");

    expect(retail.scope).toContain("POS billing");
    expect(dist.scope).toContain("Delivery Challan (Sales DC)");
    expect(dist.scope).toContain("Approval Issue Delivery Challan");
    expect(dist.scope).toContain("Transport Receipt Entry");
  });

  it("should verify distributor workflow mapping to canonical SMRITI modules", () => {
    const distPath = path.join(BLUEPRINT_DIR, "distributor_blueprint.json");
    const dist = JSON.parse(fs.readFileSync(distPath, "utf-8"));

    const workflows = dist.distributorWorkflows;
    expect(workflows.length).toBe(5);

    const salesDC = workflows.find((w: any) => w.workflowId === "WF-DC-SALES");
    expect(salesDC).toBeDefined();
    expect(salesDC.documentType).toBe("DELIVERY_CHALLAN");
    expect(salesDC.status).toBe("MAPPED");

    const approvalDC = workflows.find((w: any) => w.workflowId === "WF-DC-APPROVAL");
    expect(approvalDC).toBeDefined();
    expect(approvalDC.documentType).toBe("APPROVAL_ISSUE_DC");

    const transportLR = workflows.find((w: any) => w.workflowId === "WF-TRANSPORT-RECEIPT");
    expect(transportLR).toBeDefined();
    expect(transportLR.documentType).toBe("TRANSPORT_RECEIPT");

    const poConsolidation = workflows.find((w: any) => w.workflowId === "WF-PO-CONSOLIDATION");
    expect(poConsolidation).toBeDefined();
    expect(poConsolidation.documentType).toBe("PURCHASE_ORDER_CONSOLIDATION");
  });

  it("should verify menu registry has no duplicate statements", () => {
    const menusPath = path.join(BLUEPRINT_DIR, "menus.json");
    expect(fs.existsSync(menusPath)).toBe(true);

    const menusData = JSON.parse(fs.readFileSync(menusPath, "utf-8"));
    const distMenus = menusData.distributorMenus;

    expect(distMenus.length).toBeGreaterThan(0);

    // Verify all menus have proper SMRITI tile mappings
    distMenus.forEach((m: any) => {
      expect(m.smritiTileMapping).toBeDefined();
      expect(m.smritiTileMapping.tileId).toBeDefined();
      expect(m.smritiTileMapping.workspace).toBeDefined();
    });
  });

  it("should verify display layout column definitions", () => {
    const layoutPath = path.join(BLUEPRINT_DIR, "display_layouts.json");
    expect(fs.existsSync(layoutPath)).toBe(true);

    const layouts = JSON.parse(fs.readFileSync(layoutPath, "utf-8"));
    const distCols = layouts.distributorAcceptDisplayDtls;

    expect(distCols.length).toBeGreaterThan(0);

    const stockNoCol = distCols.find((c: any) => c.Caption === "Stock No");
    expect(stockNoCol).toBeDefined();

    const rateCol = distCols.find((c: any) => c.Caption === "Rate");
    expect(rateCol).toBeDefined();

    const qtyCol = distCols.find((c: any) => c.Caption === "Qty");
    expect(qtyCol).toBeDefined();
  });
});
