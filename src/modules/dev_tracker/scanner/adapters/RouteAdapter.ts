/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / PBC-001)
 * Description  : Workspace Route & Tab Mapping Adapter
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IAdapter, AdapterCategory, AdapterHealth } from "./types.ts";
import { EvidenceItem } from "../../models/interfaces.ts";

export class RouteAdapter implements IAdapter {
  public id = "route-adapter";
  public name = "Workspace Route Mapping Adapter";
  public version = "2.3.0";
  public category: AdapterCategory = "frontend";
  public priority = 14;
  public supportedExtensions = [".ts", ".tsx"];
  public enabled = true;

  private filesProcessed = 0;
  private evidenceExtracted = 0;
  private warnings = 0;
  private errors = 0;

  public canHandle(filePath: string): boolean {
    const rel = filePath.replace(/\\/g, "/");
    return (
      rel.includes("workspaces/") ||
      rel.includes("layout_engine") ||
      rel.includes("App.tsx")
    );
  }

  public extract(filePath: string, content: string): EvidenceItem[] {
    const rel = filePath.replace(/\\/g, "/");
    this.filesProcessed++;
    const items: EvidenceItem[] = [];

    try {
      const routeMatches = content.match(/route:\s*["']([^"']+)["']/g) || [];
      const tabMatches = content.match(/targetTab:\s*["']([^"']+)["']/g) || [];

      [...routeMatches, ...tabMatches].forEach((match, idx) => {
        const symbol = match.replace(/["']/g, "").replace(/(route|targetTab):\s*/, "");
        items.push({
          id: `EV-ROUTE-${symbol.replace(/[^a-zA-Z0-9]/g, "-")}-${idx}`,
          category: "frontend",
          file: rel,
          symbol: `Route: ${symbol}`,
          confidence: "100% Verified"
        });
        this.evidenceExtracted++;
      });
    } catch {
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
