/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Print Registry (UPRT Phase 6 Core) Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & UPRT Standard v1.0 Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../../src/kernel/SPK.js";
import { createPlatformContext } from "../../src/kernel/context/PlatformContext.js";
import { PrintRegistry, type PrintTemplateDefinition } from "../../src/kernel/upr/printing/PrintRegistry.js";

describe("Universal Print Registry (UPRT Phase 6 Core)", () => {
  beforeEach(() => {
    PrintRegistry.clear();
  });

  it("should seed default print templates (tmpl.pos_receipt, tmpl.barcode_label)", () => {
    const templates = SPK.printing.getTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(2);

    const posReceipt = SPK.printing.getTemplate("tmpl.pos_receipt");
    expect(posReceipt).toBeDefined();
    expect(posReceipt?.paperSize).toBe("thermal_80mm");
    expect(posReceipt?.entityId).toBe("sales_invoice");
  });

  it("should render template placeholder variables with data", () => {
    const context = createPlatformContext();
    const doc = SPK.printing.renderDocument("tmpl.pos_receipt", {
      invoiceNo: "INV-9900",
      totalAmount: "₹1,250.00"
    }, context);

    expect(doc.templateId).toBe("tmpl.pos_receipt");
    expect(doc.htmlContent).toContain("INV-9900");
    expect(doc.htmlContent).toContain("₹1,250.00");
    expect(doc.plainTextContent).toContain("SMRITI RETAIL RECEIPT");
  });

  it("should support dynamic registration of plugin print templates", () => {
    const customTemplate: PrintTemplateDefinition = {
      id: "tmpl.jewellery_tag",
      name: "Gold Ornament Tag Label",
      entityId: "jewellery_item",
      paperSize: "label_50x25mm",
      permissionId: "inventory.item.read",
      templateBody: `<div className="tag"><p>Gross Wt: {{grossWeight}}g</p><p>Net Wt: {{netWeight}}g</p></div>`
    };

    SPK.printing.registerTemplate(customTemplate);

    const registered = SPK.printing.getTemplate("tmpl.jewellery_tag");
    expect(registered).toBeDefined();

    const context = createPlatformContext();
    const doc = SPK.printing.renderDocument("tmpl.jewellery_tag", { grossWeight: "12.5", netWeight: "11.8" }, context);
    expect(doc.htmlContent).toContain("Gross Wt: 12.5g");
  });
});
