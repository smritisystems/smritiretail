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
 * Classification: Tag & Barcode Label Printing Thermal Portal Verification Suite
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";

vi.mock("qz-tray", () => ({
  default: {
    websocket: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
    },
    printers: {
      find: vi.fn().mockResolvedValue([]),
      getDefault: vi.fn().mockResolvedValue(null),
    },
    print: vi.fn(),
    configs: {
      create: vi.fn(),
    },
    security: {
      setCertificatePromise: vi.fn(),
      setSignatureAlgorithm: vi.fn(),
      setSignaturePromise: vi.fn(),
    },
    api: {
      getVersion: vi.fn().mockResolvedValue("2.2.6"),
    },
  },
}));

import { renderToStaticMarkup } from "react-dom/server";
import { TagLabelPrintingTab } from "../components/barcode/TagLabelPrintingTa";
import { F2DispatcherProvider } from "../context/F2DispatcherContext";

describe("TagLabelPrintingTab Thermal Portal Suite", () => {
  it("1. renders barcode printable area with #root display:none suppression and 50x25mm page size", () => {
    const html = renderToStaticMarkup(
      <F2DispatcherProvider>
        <TagLabelPrintingTab />
      </F2DispatcherProvider>
    );

    expect(html).toContain("smriti-barcode-printable-area");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: 50mm 25mm");
    expect(html).toContain("margin: 0");
    expect(html).toContain("thermal-label-page");
  });

  it("2. enforces static unrolling for thermal sticker printing", () => {
    const html = renderToStaticMarkup(
      <F2DispatcherProvider>
        <TagLabelPrintingTab />
      </F2DispatcherProvider>
    );

    expect(html).toContain("position: static !important");
    expect(html).toContain("width: 50mm !important");
    expect(html).toContain("page-break-after: always !important");
  });
});
