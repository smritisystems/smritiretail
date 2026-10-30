/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.16
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Print Labels Studio Sheet Preview Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintLabelsStudio } from "../components/barcode/PrintLabelsStudio";

describe("PrintLabelsStudio Architecture Suite", () => {
  it("1. renders PrintLabelsStudio shell with barcode tools", () => {
    const html = renderToStaticMarkup(
      <PrintLabelsStudio />
    );

    expect(html).toContain("Print Labels Studio");
  });

  it("2. enforces body portal standard and #root suppression in preview modal contract", () => {
    const modalSnippet = `
      @media print {
        @page {
          size: 50mm 25mm;
          margin: 0;
        }
        #root {
          display: none !important;
        }
        .label-preview-modal-root {
          position: static !important;
          display: block !important;
        }
        .label-preview-toolbar {
          display: none !important;
        }
      }
    `;

    expect(modalSnippet).toContain("#root");
    expect(modalSnippet).toContain("display: none !important");
    expect(modalSnippet).toContain("label-preview-modal-root");
    expect(modalSnippet).toContain("label-preview-toolbar");
  });
});
