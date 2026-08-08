/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Universal Field Mapping Engine
 * Standard     : SCS-PRINT-FIELD-MAPPING-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { UniversalFieldRegistry, FieldDomain, CanonicalFieldDefinition } from "./UniversalFieldRegistry.ts";
import { LabelFieldBindingEngine } from "./LabelFieldBindingEngine.ts";
import { UniversalPrintTemplate } from "../models/UniversalPrintTemplate.ts";

export type MappingSource = "EXPLICIT" | "AUTO_DETECTED" | "USER_SELECTED" | "IMPORTED" | "DEFAULT";

export type MappingStatus = "VALID" | "UNMAPPED" | "AMBIGUOUS" | "INVALID" | "MISSING_RUNTIME_VALUE";

export type DeclarativeFormatter =
  | "currency"
  | "number"
  | "uppercase"
  | "lowercase"
  | "date"
  | "date:DD-MM-YYYY"
  | "default"
  | "trim";

export type DeclarativeTransformType = "uppercase" | "lowercase" | "trim" | "prefix" | "suffix" | "replace" | "substring";

export interface DeclarativeTransform {
  type: DeclarativeTransformType;
  param1?: string; // e.g. prefix value, search string, start index
  param2?: string; // e.g. suffix value, replace string, end index
}

export interface TemplateFieldMapping {
  templateId: string;
  templateVersion: string;
  placeholder: string; // Original tag e.g. "{barcode}" or "{style}"
  canonicalPath: string; // e.g. "barcode.value", "product.style_code"
  sourceDomain?: FieldDomain;
  required: boolean;
  defaultValue?: string;
  formatter?: DeclarativeFormatter;
  transform?: DeclarativeTransform;
  confidence: number; // 0.0 to 1.0
  mappingSource: MappingSource;
  status: MappingStatus;
  candidatePaths?: string[];
}

export interface AutoMapResult {
  placeholder: string;
  canonicalPath?: string;
  confidence: number;
  status: MappingStatus;
  candidates?: string[];
}

export interface ValidationReport {
  isValid: boolean;
  mappings: TemplateFieldMapping[];
  missingRequiredFields: string[];
  unmappedFields: string[];
  ambiguousFields: string[];
}

export class FieldMappingEngineService {
  /**
   * Deterministically auto-maps a single placeholder tag to canonical path using UniversalFieldRegistry.
   */
  public autoMapPlaceholder(placeholder: string): AutoMapResult {
    if (!placeholder) {
      return { placeholder: "", confidence: 0, status: "UNMAPPED" };
    }

    const cleanTag = placeholder.replace(/[\{\}]/g, "").trim();
    const lower = cleanTag.toLowerCase();

    // Check for ambiguous fields (e.g. "price" which could map to mrp, selling price, or cost price)
    if (lower === "price" || lower === "rate") {
      return {
        placeholder,
        confidence: 0.5,
        status: "AMBIGUOUS",
        candidates: ["pricing.mrp", "pricing.price", "pricing.cost_price"],
      };
    }

    // Attempt resolution using UniversalFieldRegistry authority
    const canonical = UniversalFieldRegistry.resolveCanonicalPath(cleanTag);
    if (canonical) {
      return {
        placeholder,
        canonicalPath: canonical,
        confidence: 1.0,
        status: "VALID",
      };
    }

    // Unmapped unknown placeholder
    return {
      placeholder,
      confidence: 0,
      status: "UNMAPPED",
    };
  }

  /**
   * Maps a placeholder tag to a canonical field path for a specific UniversalPrintTemplate version.
   */
  public mapField(
    tmpl: UniversalPrintTemplate,
    placeholder: string,
    canonicalPath: string,
    options?: Partial<TemplateFieldMapping>
  ): TemplateFieldMapping {
    if (!tmpl || !placeholder) {
      throw new Error("Cannot map field: missing template or placeholder.");
    }

    const normalizedTag = placeholder.trim().startsWith("{") ? placeholder.trim() : `{${placeholder.trim()}}`;

    // Validate canonical path against registry authority if provided
    let status: MappingStatus = "VALID";
    let sourceDomain: FieldDomain | undefined = undefined;

    if (canonicalPath) {
      const def = UniversalFieldRegistry.getFieldDefinition(canonicalPath);
      if (def) {
        sourceDomain = def.domain;
      }
    } else {
      status = "UNMAPPED";
    }

    // Update template mapping facade (source PRN remains 100% immutable)
    tmpl.setFieldMapping(normalizedTag, canonicalPath);

    // Store metadata map on template instance if not present
    if (!(tmpl as any)._fieldMappingMetadata) {
      (tmpl as any)._fieldMappingMetadata = new Map<string, TemplateFieldMapping>();
    }

    const mapping: TemplateFieldMapping = {
      templateId: tmpl.metadata.id,
      templateVersion: tmpl.metadata.version,
      placeholder: normalizedTag,
      canonicalPath,
      sourceDomain,
      required: options?.required !== undefined ? options.required : false,
      defaultValue: options?.defaultValue,
      formatter: options?.formatter,
      transform: options?.transform,
      confidence: options?.confidence !== undefined ? options.confidence : 1.0,
      mappingSource: options?.mappingSource || "USER_SELECTED",
      status,
      candidatePaths: options?.candidatePaths,
    };

    (tmpl as any)._fieldMappingMetadata.set(normalizedTag, mapping);
    return mapping;
  }

  /**
   * Remaps an existing mapped placeholder tag to a new canonical field path.
   */
  public remapField(tmpl: UniversalPrintTemplate, placeholder: string, newCanonicalPath: string): TemplateFieldMapping {
    const existing = this.getMapping(tmpl, placeholder);
    return this.mapField(tmpl, placeholder, newCanonicalPath, {
      required: existing?.required,
      defaultValue: existing?.defaultValue,
      formatter: existing?.formatter,
      transform: existing?.transform,
      mappingSource: "USER_SELECTED",
    });
  }

  /**
   * Unmaps a placeholder tag from a template.
   */
  public unmapField(tmpl: UniversalPrintTemplate, placeholder: string): boolean {
    if (!tmpl || !placeholder) return false;
    const normalizedTag = placeholder.trim().startsWith("{") ? placeholder.trim() : `{${placeholder.trim()}}`;
    if ((tmpl as any)._fieldMappingMetadata) {
      (tmpl as any)._fieldMappingMetadata.delete(normalizedTag);
    }
    return tmpl.removeFieldMapping(normalizedTag);
  }

  /**
   * Gets the field mapping definition for a specific placeholder tag in a template version.
   */
  public getMapping(tmpl: UniversalPrintTemplate, placeholder: string): TemplateFieldMapping | undefined {
    if (!tmpl || !placeholder) return undefined;
    const normalizedTag = placeholder.trim().startsWith("{") ? placeholder.trim() : `{${placeholder.trim()}}`;

    if ((tmpl as any)._fieldMappingMetadata && (tmpl as any)._fieldMappingMetadata.has(normalizedTag)) {
      return (tmpl as any)._fieldMappingMetadata.get(normalizedTag);
    }

    const canonicalPath = tmpl.fieldMappings.get(normalizedTag);
    if (canonicalPath === undefined) {
      return undefined;
    }

    const autoRes = this.autoMapPlaceholder(normalizedTag);
    return {
      templateId: tmpl.metadata.id,
      templateVersion: tmpl.metadata.version,
      placeholder: normalizedTag,
      canonicalPath: canonicalPath || "",
      required: false,
      confidence: canonicalPath ? 1.0 : autoRes.confidence,
      mappingSource: canonicalPath ? "USER_SELECTED" : "AUTO_DETECTED",
      status: canonicalPath ? "VALID" : autoRes.status,
      candidatePaths: autoRes.candidates,
    };
  }

  /**
   * Returns all field mappings defined for a template version.
   */
  public getMappings(tmpl: UniversalPrintTemplate): TemplateFieldMapping[] {
    if (!tmpl) return [];
    const results: TemplateFieldMapping[] = [];

    tmpl.fieldMappings.forEach((canonicalPath, tag) => {
      const mapping = this.getMapping(tmpl, tag);
      if (mapping) {
        results.push(mapping);
      }
    });

    return results;
  }

  /**
   * Auto-maps all placeholders extracted in a template.
   */
  public autoMapTemplate(tmpl: UniversalPrintTemplate): ValidationReport {
    if (!tmpl) {
      return { isValid: false, mappings: [], missingRequiredFields: [], unmappedFields: [], ambiguousFields: [] };
    }

    const mappings: TemplateFieldMapping[] = [];
    const unmappedFields: string[] = [];
    const ambiguousFields: string[] = [];

    tmpl.fieldMappings.forEach((existingCanonical, tag) => {
      const existingMapping = this.getMapping(tmpl, tag);
      if (existingCanonical) {
        mappings.push(
          this.mapField(tmpl, tag, existingCanonical, {
            required: existingMapping?.required || false,
            defaultValue: existingMapping?.defaultValue,
            formatter: existingMapping?.formatter,
            transform: existingMapping?.transform,
            mappingSource: existingMapping?.mappingSource || "EXPLICIT",
          })
        );
      } else {
        const auto = this.autoMapPlaceholder(tag);
        if (auto.status === "VALID" && auto.canonicalPath) {
          mappings.push(this.mapField(tmpl, tag, auto.canonicalPath, { confidence: auto.confidence, mappingSource: "AUTO_DETECTED" }));
        } else if (auto.status === "AMBIGUOUS") {
          ambiguousFields.push(tag);
          mappings.push({
            templateId: tmpl.metadata.id,
            templateVersion: tmpl.metadata.version,
            placeholder: tag,
            canonicalPath: "",
            required: false,
            confidence: 0.5,
            mappingSource: "AUTO_DETECTED",
            status: "AMBIGUOUS",
            candidatePaths: auto.candidates,
          });
        } else {
          unmappedFields.push(tag);
          mappings.push({
            templateId: tmpl.metadata.id,
            templateVersion: tmpl.metadata.version,
            placeholder: tag,
            canonicalPath: "",
            required: false,
            confidence: 0,
            mappingSource: "DEFAULT",
            status: "UNMAPPED",
          });
        }
      }
    });

    return {
      isValid: unmappedFields.length === 0 && ambiguousFields.length === 0,
      mappings,
      missingRequiredFields: [],
      unmappedFields,
      ambiguousFields,
    };
  }

  /**
   * Validates template mappings against runtime data context before print execution.
   */
  public validateMappings(tmpl: UniversalPrintTemplate, runtimeContext?: Record<string, any>): ValidationReport {
    const report = this.autoMapTemplate(tmpl);
    const missingRequired: string[] = [];

    if (runtimeContext) {
      report.mappings.forEach((m) => {
        if (m.required && m.canonicalPath) {
          const evalRes = LabelFieldBindingEngine.evaluateExpression(`{{${m.canonicalPath}}}`, runtimeContext);
          const val = evalRes.value;
          if (!val && m.defaultValue === undefined) {
            missingRequired.push(m.canonicalPath);
            m.status = "MISSING_RUNTIME_VALUE";
          }
        }
      });
    }

    report.missingRequiredFields = missingRequired;
    report.isValid = report.unmappedFields.length === 0 && report.ambiguousFields.length === 0 && missingRequired.length === 0;

    return report;
  }

  /**
   * Resolves runtime value for a mapped template field using declarative formatters & transforms.
   * STRICT SECURITY: Zero eval(), zero Function(), zero un-sanitized code execution.
   */
  public resolveValue(mapping: TemplateFieldMapping, runtimeContext: Record<string, any>): string {
    if (!mapping) return "";

    // 1. Check for malicious code injection strings in placeholder or path
    const pathStr = mapping.canonicalPath || "";
    if (this.containsMaliciousInjection(pathStr) || this.containsMaliciousInjection(mapping.placeholder)) {
      return "[SECURITY REJECTED]";
    }

    if (!mapping.canonicalPath) {
      return mapping.defaultValue !== undefined ? mapping.defaultValue : "";
    }

    // 2. Safely evaluate value via LabelFieldBindingEngine
    let evalRes = LabelFieldBindingEngine.evaluateExpression(`{{${mapping.canonicalPath}}}`, runtimeContext);
    let val = evalRes.value;

    if (!val && mapping.defaultValue !== undefined) {
      val = mapping.defaultValue;
    }

    // 3. Apply whitelisted declarative formatter
    if (mapping.formatter) {
      val = this.applyFormatter(val, mapping.formatter);
    }

    // 4. Apply whitelisted declarative transform
    if (mapping.transform) {
      val = this.applyTransform(val, mapping.transform);
    }

    return val;
  }

  private containsMaliciousInjection(input: string): boolean {
    if (!input) return false;
    const lower = input.toLowerCase();
    return (
      lower.includes("eval(") ||
      lower.includes("function(") ||
      lower.includes("constructor") ||
      lower.includes("<script") ||
      lower.includes("alert(") ||
      lower.includes("process.") ||
      lower.includes("require(")
    );
  }

  private applyFormatter(val: string, formatter: DeclarativeFormatter): string {
    switch (formatter) {
      case "uppercase":
        return val.toUpperCase();
      case "lowercase":
        return val.toLowerCase();
      case "trim":
        return val.trim();
      case "currency": {
        const num = parseFloat(val);
        return isNaN(num) ? val : `${num.toFixed(2)}`;
      }
      case "number": {
        const num = parseFloat(val);
        return isNaN(num) ? val : `${num}`;
      }
      default:
        return val;
    }
  }

  private applyTransform(val: string, transform: DeclarativeTransform): string {
    switch (transform.type) {
      case "uppercase":
        return val.toUpperCase();
      case "lowercase":
        return val.toLowerCase();
      case "trim":
        return val.trim();
      case "prefix":
        return `${transform.param1 || ""}${val}`;
      case "suffix":
        return `${val}${transform.param1 || ""}`;
      case "replace":
        return val.replace(new RegExp(transform.param1 || "", "g"), transform.param2 || "");
      case "substring": {
        const start = parseInt(transform.param1 || "0", 10) || 0;
        const end = transform.param2 !== undefined ? parseInt(transform.param2, 10) : undefined;
        return val.substring(start, end);
      }
      default:
        return val;
    }
  }
}

export const FieldMappingEngine = new FieldMappingEngineService();
