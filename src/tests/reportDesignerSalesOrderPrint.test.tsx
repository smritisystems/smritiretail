/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.18
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Report Designer Sales Order Print Modal Architecture Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { ReportDesignerTab } from "../components/ReportDesignerTab";

describe("ReportDesignerTab Sales Order Print Modal Suite", () => {
  it("1. enforces createPortal, #root display:none suppression, and A4 portrait page size", () => {
    const componentCode = ReportDesignerTab.toString();

    expect(componentCode).toContain("createPortal");
    expect(componentCode).toContain("#root");
    expect(componentCode).toContain("display: none !important");
    expect(componentCode).toContain("size: A4 portrait");
    expect(componentCode).toContain("margin: 10mm 12mm 12mm 12mm");
    expect(componentCode).toContain("so-print-modal-root");
    expect(componentCode).toContain("so-print-toolbar");
  });
});
