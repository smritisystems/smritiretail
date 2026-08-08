/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-011 (Universal Print Template Model v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { UniversalLabelDocument, UniversalLabelDocumentJSON } from "./UniversalLabelDocument.ts";
import { DetectedPrinterLanguage } from "../prn_engine/PrinterLanguageDetector.ts";

export type TemplateSourceFormat =
  | "PRN_ZPL"
  | "PRN_TSPL"
  | "PRN_EPL"
  | "PRN_CPCL"
  | "PRN_ESC_POS"
  | "PRN_SBPL"
  | "PRN_DPL"
  | "RAW"
  | "CUSTOM";

export type TemplateSourceType = "IMPORTED_PRN" | "VISUAL_DESIGN" | "SYSTEM_DEFAULT";

export type TemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED" | "INVALID";

export interface TemplateMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  sourceFormat: TemplateSourceFormat;
  sourceType: TemplateSourceType;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSourceInfo {
  originalContent: string;
  originalFormat: DetectedPrinterLanguage;
  checksum?: string;
}

export interface TemplatePrinterPreferences {
  preferredLanguage?: DetectedPrinterLanguage;
  preferredDpi?: number;
  preferredPrinterProfileId?: string;
}

export interface TemplateMediaPreferences {
  widthMm?: number;
  heightMm?: number;
  gapMm?: number;
  sensor?: "GAP" | "BLACK_MARK" | "NONE";
  orientation?: "PORTRAIT" | "LANDSCAPE";
}

export interface UniversalPrintTemplateJSON {
  metadata: TemplateMetadata;
  source: TemplateSourceInfo;
  document: UniversalLabelDocumentJSON;
  fieldMappings: Record<string, string>; // Maps PRN placeholder (e.g. "{style}") to canonical field (e.g. "product.style_code")
  printerPreferences?: TemplatePrinterPreferences;
  mediaPreferences?: TemplateMediaPreferences;
  status: TemplateStatus;
}

export class UniversalPrintTemplate {
  public metadata: TemplateMetadata;
  public source: TemplateSourceInfo;
  public document: UniversalLabelDocument;
  public fieldMappings: Map<string, string>;
  public printerPreferences?: TemplatePrinterPreferences;
  public mediaPreferences?: TemplateMediaPreferences;
  public status: TemplateStatus;

  constructor(init?: Partial<UniversalPrintTemplateJSON> & { name?: string }) {
    const now = new Date().toISOString();

    this.metadata = {
      id: init?.metadata?.id || `tmpl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: init?.metadata?.name || init?.name || "Untitled Print Template",
      version: init?.metadata?.version || "1.0.0",
      description: init?.metadata?.description,
      author: init?.metadata?.author || "SMRITI Enterprise SaaS",
      sourceFormat: init?.metadata?.sourceFormat || "PRN_ZPL",
      sourceType: init?.metadata?.sourceType || "VISUAL_DESIGN",
      createdAt: init?.metadata?.createdAt || now,
      updatedAt: init?.metadata?.updatedAt || now,
    };

    this.source = {
      originalContent: init?.source?.originalContent || "",
      originalFormat: init?.source?.originalFormat || "ZPL",
      checksum: init?.source?.checksum || this.computeChecksum(init?.source?.originalContent || ""),
    };

    this.document = init?.document
      ? UniversalLabelDocument.fromJSON(init.document)
      : new UniversalLabelDocument({ metadata: { id: `doc-${this.metadata.id}`, name: this.metadata.name, version: this.metadata.version, createdAt: now, updatedAt: now } });

    this.fieldMappings = new Map();
    if (init?.fieldMappings) {
      Object.entries(init.fieldMappings).forEach(([k, v]) => this.fieldMappings.set(k, v));
    }

    this.printerPreferences = init?.printerPreferences ? { ...init.printerPreferences } : undefined;
    this.mediaPreferences = init?.mediaPreferences ? { ...init.mediaPreferences } : undefined;
    this.status = init?.status || "DRAFT";
  }

  private computeChecksum(content: string): string {
    if (!content) return "empty";
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `sha-${Math.abs(hash).toString(16)}`;
  }

  public setFieldMapping(placeholder: string, canonicalPath: string): void {
    if (!placeholder) return;
    const normalizedTag = placeholder.trim().startsWith("{") ? placeholder.trim() : `{${placeholder.trim()}}`;
    this.fieldMappings.set(normalizedTag, canonicalPath);
    this.metadata.updatedAt = new Date().toISOString();
  }

  public removeFieldMapping(placeholder: string): boolean {
    const normalizedTag = placeholder.trim().startsWith("{") ? placeholder.trim() : `{${placeholder.trim()}}`;
    const res = this.fieldMappings.delete(normalizedTag);
    if (res) {
      this.metadata.updatedAt = new Date().toISOString();
    }
    return res;
  }

  public bumpVersion(newVersion?: string): void {
    if (newVersion) {
      this.metadata.version = newVersion;
    } else {
      const parts = this.metadata.version.split(".").map((n) => parseInt(n, 10) || 0);
      if (parts.length === 3) {
        parts[2]++;
        this.metadata.version = parts.join(".");
      } else {
        this.metadata.version = `${this.metadata.version}.1`;
      }
    }
    this.metadata.updatedAt = new Date().toISOString();
  }

  public clone(newId?: string, newName?: string): UniversalPrintTemplate {
    const json = this.toJSON();
    json.metadata.id = newId || `tmpl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    json.metadata.name = newName || `Copy of ${this.metadata.name}`;
    json.metadata.createdAt = new Date().toISOString();
    json.metadata.updatedAt = new Date().toISOString();
    return UniversalPrintTemplate.fromJSON(json);
  }

  public toBarcodeLayoutElementsJSON(): Record<string, any> {
    const mappingsObj: Record<string, string> = {};
    this.fieldMappings.forEach((v, k) => (mappingsObj[k] = v));

    return {
      template_id: this.metadata.id,
      template_name: this.metadata.name,
      version: this.metadata.version,
      source_format: this.metadata.sourceFormat,
      elements: this.document.toJSON().elements,
      prn_template: this.source.originalContent,
      field_mappings: mappingsObj,
      status: this.status,
    };
  }

  public toJSON(): UniversalPrintTemplateJSON {
    const mappingsObj: Record<string, string> = {};
    this.fieldMappings.forEach((val, key) => {
      mappingsObj[key] = val;
    });

    return {
      metadata: { ...this.metadata },
      source: { ...this.source },
      document: this.document.toJSON(),
      fieldMappings: mappingsObj,
      printerPreferences: this.printerPreferences ? { ...this.printerPreferences } : undefined,
      mediaPreferences: this.mediaPreferences ? { ...this.mediaPreferences } : undefined,
      status: this.status,
    };
  }

  public static fromJSON(json: Partial<UniversalPrintTemplateJSON>): UniversalPrintTemplate {
    return new UniversalPrintTemplate(json);
  }
}
