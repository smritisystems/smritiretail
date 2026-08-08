/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / SADS v1.0)
 * Description  : SQLAlchemy Model & Database Table Engine Adapter
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { IAdapter, AdapterCategory, AdapterHealth } from "./types.ts";
import { EvidenceItem } from "../../models/interfaces.ts";

export class SQLAlchemyAdapter implements IAdapter {
  public id = "sqlalchemy-adapter";
  public name = "SQLAlchemy ORM Model Adapter";
  public version = "2.3.0";
  public category: AdapterCategory = "database";
  public priority = 10;
  public supportedExtensions = [".py"];
  public enabled = true;

  private filesProcessed = 0;
  private evidenceExtracted = 0;
  private warnings = 0;
  private errors = 0;

  public canHandle(filePath: string): boolean {
    const rel = filePath.replace(/\\/g, "/");
    return rel.startsWith("backend/app/models/") && rel.endsWith(".py");
  }

  public extract(filePath: string, content: string): EvidenceItem[] {
    const rel = filePath.replace(/\\/g, "/");
    this.filesProcessed++;
    const items: EvidenceItem[] = [];

    try {
      const modelRegex = /__tablename__\s*=\s*["'](\w+)["']/g;
      let match;
      const tables: string[] = [];
      while ((match = modelRegex.exec(content)) !== null) {
        tables.push(match[1]);
      }

      if (tables.length > 0) {
        const item: EvidenceItem = {
          id: `EV-DB-${rel.replace(/[^a-zA-Z0-9]/g, "-")}`,
          category: "database",
          file: rel,
          symbol: `SQLAlchemy tables (${tables.join(", ")})`,
          confidence: "100% Verified"
        };
        items.push(item);
        this.evidenceExtracted += tables.length;
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
