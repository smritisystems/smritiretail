/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / PBC-001)
 * Description  : UPR Navigation & Menu Infrastructure Adapter
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IAdapter, AdapterCategory, AdapterHealth } from "./types.ts";
import { EvidenceItem } from "../../models/interfaces.ts";

export class NavigationAdapter implements IAdapter {
  public id = "navigation-adapter";
  public name = "UPR Navigation & Menu Adapter";
  public version = "2.3.0";
  public category: AdapterCategory = "frontend";
  public priority = 15;
  public supportedExtensions = [".ts", ".tsx"];
  public enabled = true;

  private filesProcessed = 0;
  private evidenceExtracted = 0;
  private warnings = 0;
  private errors = 0;

  public canHandle(filePath: string): boolean {
    const rel = filePath.replace(/\\/g, "/");
    return (
      rel.includes("NavigationRegistry") ||
      rel.includes("navigation") ||
      rel.includes("masters_registry") ||
      rel.includes("navigation_renderer")
    );
  }

  public extract(filePath: string, content: string): EvidenceItem[] {
    const rel = filePath.replace(/\\/g, "/");
    this.filesProcessed++;
    const items: EvidenceItem[] = [];

    try {
      // Extract menu definitions, NAV_IDS, and workspace mappings
      const navMatches = content.match(/(NAV_IDS\.[A-Z0-9_]+|NAV_[A-Z0-9_]+)/g) || [];
      const domainMatches = content.match(/registerDomain\s*\(/g) || [];

      navMatches.forEach((navId) => {
        items.push({
          id: `EV-NAV-${navId.replace(/[^a-zA-Z0-9]/g, "-")}`,
          category: "frontend",
          file: rel,
          symbol: navId,
          confidence: "100% Verified"
        });
        this.evidenceExtracted++;
      });

      if (domainMatches.length > 0) {
        items.push({
          id: `EV-NAV-DOMAIN-REGISTRY-${rel.replace(/[^a-zA-Z0-9]/g, "-")}`,
          category: "frontend",
          file: rel,
          symbol: "DomainRegistry",
          confidence: "100% Verified"
        });
        this.evidenceExtracted++;
      }
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
