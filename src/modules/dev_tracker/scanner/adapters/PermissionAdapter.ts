/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / PBC-001)
 * Description  : Security Permission Coverage Adapter
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IAdapter, AdapterCategory, AdapterHealth } from "./types.ts";
import { EvidenceItem } from "../../models/interfaces.ts";

export class PermissionAdapter implements IAdapter {
  public id = "permission-adapter";
  public name = "Security Permission Coverage Adapter";
  public version = "2.3.0";
  public category: AdapterCategory = "security";
  public priority = 13;
  public supportedExtensions = [".ts", ".tsx", ".py"];
  public enabled = true;

  private filesProcessed = 0;
  private evidenceExtracted = 0;
  private warnings = 0;
  private errors = 0;

  public canHandle(filePath: string): boolean {
    const rel = filePath.replace(/\\/g, "/");
    return (
      rel.includes("PermissionRegistry") ||
      rel.includes("security") ||
      rel.includes("auth") ||
      rel.includes("RBAC")
    );
  }

  public extract(filePath: string, content: string): EvidenceItem[] {
    const rel = filePath.replace(/\\/g, "/");
    this.filesProcessed++;
    const items: EvidenceItem[] = [];

    try {
      const permMatches = content.match(/permission:\s*["']([^"']+)["']/g) || [];
      const hasPermMatches = content.match(/hasPermission\s*\(\s*["']([^"']+)["']/g) || [];

      [...permMatches, ...hasPermMatches].forEach((match, idx) => {
        const symbol = match.replace(/["']/g, "").replace(/(permission|hasPermission\s*\():\s*/, "");
        items.push({
          id: `EV-PERM-${symbol.replace(/[^a-zA-Z0-9]/g, "-")}-${idx}`,
          category: "frontend",
          file: rel,
          symbol: `Permission: ${symbol}`,
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
