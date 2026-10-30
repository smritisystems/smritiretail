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
 * Classification: Quick Reports Widget Unified Print & Modal Architecture Suite
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickReportsWidget } from "../components/QuickReportsWidget";

describe("QuickReportsWidget Unified Print Suite", () => {
  it("1. renders QuickReportsWidget and verifies background print-only-container static styling", () => {
    const html = renderToStaticMarkup(
      <QuickReportsWidget />
    );

    expect(html).toContain("print-only-container");
    expect(html).toContain("position: static !important");
    expect(html).toContain("width: 100% !important");
  });

  it("2. enforces body portal architecture and #root suppression contract in QuickReportsWidget", () => {
    const componentCode = QuickReportsWidget.toString();
    expect(componentCode).toContain("createPortal");
    expect(componentCode).toContain("#root");
    expect(componentCode).toContain("display: none !important");
    expect(componentCode).toContain("quick-report-modal-root");
    expect(componentCode).toContain("quick-report-toolbar");
  });
});
