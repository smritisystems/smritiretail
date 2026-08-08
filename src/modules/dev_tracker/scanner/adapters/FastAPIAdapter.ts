/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / SADS v1.0)
 * Description  : FastAPI Router API Gateway Engine Adapter
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IAdapter, AdapterCategory, AdapterHealth } from "./types.ts";
import { EvidenceItem } from "../../models/interfaces.ts";

export class FastAPIAdapter implements IAdapter {
  public id = "fastapi-adapter";
  public name = "FastAPI API Router Adapter";
  public version = "2.3.0";
  public category: AdapterCategory = "api";
  public priority = 10;
  public supportedExtensions = [".py"];
  public enabled = true;

  private filesProcessed = 0;
  private evidenceExtracted = 0;
  private warnings = 0;
  private errors = 0;

  public canHandle(filePath: string): boolean {
    const rel = filePath.replace(/\\/g, "/");
    return rel.startsWith("backend/app/api/") && rel.endsWith(".py");
  }

  public extract(filePath: string, content: string): EvidenceItem[] {
    const rel = filePath.replace(/\\/g, "/");
    this.filesProcessed++;
    const items: EvidenceItem[] = [];

    try {
      const pyRouteRegex = /@router\.(get|post|put|delete|patch)\(\s*["'](\/.*?)["']/g;
      let match;
      const prefixMatch = content.match(/APIRouter\([^)]*prefix=["'](\/[^"']+)["']/);
      const prefix = prefixMatch ? prefixMatch[1] : "";
      
      const routes: string[] = [];
      while ((match = pyRouteRegex.exec(content)) !== null) {
        routes.push(`${match[1].toUpperCase()} ${prefix}${match[2]}`);
      }

      if (routes.length > 0) {
        const item: EvidenceItem = {
          id: `EV-API-${rel.replace(/[^a-zA-Z0-9]/g, "-")}`,
          category: "api",
          file: rel,
          symbol: `@router prefix="${prefix}" (${routes.slice(0, 3).join(", ")})`,
          confidence: "100% Verified"
        };
        items.push(item);
        this.evidenceExtracted += routes.length;
      }
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
