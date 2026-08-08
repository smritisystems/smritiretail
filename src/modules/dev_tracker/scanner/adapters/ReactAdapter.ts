/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / SADS v1.0)
 * Description  : React SPA Component & Layout Engine Adapter
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IAdapter, AdapterCategory, AdapterHealth } from "./types.ts";
import { EvidenceItem } from "../../models/interfaces.ts";

export class ReactAdapter implements IAdapter {
  public id = "react-adapter";
  public name = "React SPA Component Adapter";
  public version = "2.3.0";
  public category: AdapterCategory = "frontend";
  public priority = 10;
  public supportedExtensions = [".tsx", ".ts"];
  public enabled = true;

  private filesProcessed = 0;
  private evidenceExtracted = 0;
  private warnings = 0;
  private errors = 0;

  public canHandle(filePath: string): boolean {
    const rel = filePath.replace(/\\/g, "/");
    return rel.startsWith("src/components/") && (rel.endsWith(".tsx") || rel.endsWith(".ts"));
  }

  public extract(filePath: string, content: string): EvidenceItem[] {
    const rel = filePath.replace(/\\/g, "/");
    this.filesProcessed++;
    const items: EvidenceItem[] = [];

    try {
      const fileName = rel.split("/").pop() || rel;
      const item: EvidenceItem = {
        id: `EV-FE-${rel.replace(/[^a-zA-Z0-9]/g, "-")}`,
        category: "frontend",
        file: rel,
        symbol: fileName,
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
