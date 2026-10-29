/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.23
 * Created      : 2026-10-29
 * Modified     : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Architecture Certification Test Suite
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const CORE_PRINT_COMPONENTS = [
  "src/components/vendor/VendorPrintModal.tsx",
  "src/components/purchase/POPrintPreviewModal.tsx",
  "src/components/purchase/GrnPrintModal.tsx",
  "src/components/staff/StaffPrintModal.tsx",
  "src/components/vendor/tabs/VendorStatementOfAccountModal.tsx",
  "src/components/itemMaster/modals/BatchBarcodePrintModal.tsx",
  "src/components/billing/modals/PackingSlipManagementModal.tsx",
  "src/components/billing/propos/ProPosTaxInvoiceRc.tsx",
  "src/components/billing/propos/ProPosShiftCloseDl.tsx",
  "src/components/hr/EmployeeAttendanceModal.tsx",
  "src/components/wms/WmsStudioTab.tsx",
  "src/components/barcode/TagLabelPrintingTa.tsx",
  "src/components/barcode/PrintLabelsStudio.tsx",
  "src/components/barcode/VisualLabelDesign.tsx",
  "src/components/billing/propos/ProPosEodReportVie.tsx",
  "src/components/billing/propos/ProPosShiftHandoverSlip.tsx",
  "src/components/billing/propos/ProPosDailyReports.tsx",
  "src/components/QuickReportsWidget.tsx",
  "src/components/ReportDesignerTab.tsx",
  "src/components/hr/AttendanceWorkspaceTab.tsx",
  "src/components/sales/DistTaxInvoice.tsx",
  "src/components/SalesStudioTab.tsx",
  "src/components/reports/SmritiReportEngine.tsx",
  "src/components/billing/SmritiBillingStudio.tsx",
  "src/components/drilldown/DrillDownSidePanel.tsx",
  "src/components/itemMaster/ItemDetailsGrid.tsx",
  "src/print_engine/print_store.tsx",
  "src/components/promotions/SmritiSalesPromotionsStudio.tsx",
  "src/components/reports/ReportBuilder.tsx",
  "src/components/AboutSmritiTab.tsx",
  "src/components/standalone/StandaloneWindowView.tsx",
  "src/modules/dev_tracker/ui/DevTrackerTab.tsx",
];

describe("SMRITI Enterprise Single-Tree Body Portal Architecture Certification Suite", () => {
  it("1. validates that all core print components mount outside #root directly via createPortal to document.body", () => {
    for (const relPath of CORE_PRINT_COMPONENTS) {
      const fullPath = path.resolve(__dirname, "../../", relPath);
      expect(fs.existsSync(fullPath), `File must exist: ${relPath}`).toBe(true);
      const code = fs.readFileSync(fullPath, "utf-8");
      expect(code, `${relPath} must implement createPortal`).toContain("createPortal(");
      expect(code, `${relPath} must target document.body`).toContain("document.body");
    }
  });

  it("2. validates that all core print components enforce active #root suppression in @media print", () => {
    for (const relPath of CORE_PRINT_COMPONENTS) {
      const fullPath = path.resolve(__dirname, "../../", relPath);
      const code = fs.readFileSync(fullPath, "utf-8");
      expect(code, `${relPath} must suppress #root`).toContain("#root");
      expect(code, `${relPath} must set display: none !important for #root`).toContain("display: none !important");
    }
  });

  it("3. validates zero unisolated bare window.print() calls outside body portals across src/", () => {
    const srcDir = path.resolve(__dirname, "../../src");
    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(entryPath);
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          const content = fs.readFileSync(entryPath, "utf-8");
          if (/onClick\s*=\s*{\s*\(\)\s*=>\s*window\.print\(\)\s*}/.test(content)) {
            // Must have createPortal or window.open in the file to encapsulate print action
            const isProtected = content.includes("createPortal") || content.includes("window.open") || entry.name === "PrintPreviewModal.tsx";
            expect(isProtected, `Bare unisolated window.print() detected in ${entryPath}`).toBe(true);
          }
        }
      }
    };
    scanDir(srcDir);
  });
});
