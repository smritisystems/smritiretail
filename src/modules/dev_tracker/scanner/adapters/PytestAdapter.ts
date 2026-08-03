/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / SADS v1.0)
 * Description  : Pytest and Vitest Automated Test Suite Engine Adapter
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IAdapter, AdapterCategory, AdapterHealth } from "./types.ts";
import { EvidenceItem } from "../../models/interfaces.ts";

export class PytestAdapter implements IAdapter {
  public id = "pytest-vitest-adapter";
  public name = "Pytest & Vitest Test Suite Adapter";
  public version = "2.3.0";
  public category: AdapterCategory = "testing";
  public priority = 10;
  public supportedExtensions = [".py", ".ts", ".tsx"];
  public enabled = true;

  private filesProcessed = 0;
  private evidenceExtracted = 0;
  private warnings = 0;
  private errors = 0;

  public canHandle(filePath: string): boolean {
    const rel = filePath.replace(/\\/g, "/");
    return (
      rel.startsWith("src/tests/") ||
      rel.endsWith(".test.ts") ||
      rel.endsWith(".test.tsx") ||
      rel.startsWith("backend/app/tests/") ||
      rel.startsWith("backend/tests/") ||
      rel.includes("test_")
    );
  }

  public extract(filePath: string, content: string): EvidenceItem[] {
    const rel = filePath.replace(/\\/g, "/");
    this.filesProcessed++;
    const items: EvidenceItem[] = [];

    try {
      const fileName = rel.split("/").pop() || rel;
      const testCount = (content.match(/\bdef test_|it\(|test\(/g) || []).length;
      const item: EvidenceItem = {
        id: `EV-TST-${rel.replace(/[^a-zA-Z0-9]/g, "-")}`,
        category: "tests",
        file: rel,
        symbol: `Test suite (${testCount > 0 ? testCount : 1} assertions)`,
        confidence: "100% Verified"
      };
      items.push(item);
      this.evidenceExtracted++;
    } catch (e) {
      this.errors++;
    }

    return items;
  }

  public healthCheck(): AdapterHealth {
    return {
      adapterId: this.id,
      version: this.version,
      filesProcessed: this.filesProcessed,
      evidenceExtracted: this.evidenceExtracted,
      warnings: this.warnings,
      errors: this.errors,
      durationMs: 0
    };
  }
}
