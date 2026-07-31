/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : PrintTemplateValidator (Rule SUPP-012 Pre-Publication Validator)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Status       : FROZEN — APPROVED
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { PrintTemplateDefinition } from "./PrintTemplateRegistry.js";

export interface ValidationIssue {
  type: "ERROR" | "WARNING";
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export class PrintTemplateValidator {
  /**
   * Validates template dimensions, driver compatibility, and syntax before publication (Rule SUPP-012)
   */
  static validate(template: Partial<PrintTemplateDefinition>): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Mandatory Fields Check
    if (!template.id) {
      issues.push({ type: "ERROR", code: "MISSING_ID", message: "Template ID is required", field: "id" });
    }
    if (!template.name) {
      issues.push({ type: "ERROR", code: "MISSING_NAME", message: "Template Name is required", field: "name" });
    }
    if (!template.script || template.script.trim().length === 0) {
      issues.push({ type: "ERROR", code: "EMPTY_SCRIPT", message: "Template script content cannot be empty", field: "script" });
    }

    // 2. Dimension Bounds Validation
    if ((template.widthMm ?? 0) <= 0) {
      issues.push({ type: "ERROR", code: "INVALID_WIDTH", message: "Width must be greater than 0 mm", field: "widthMm" });
    }
    if ((template.heightMm ?? 0) <= 0) {
      issues.push({ type: "ERROR", code: "INVALID_HEIGHT", message: "Height must be greater than 0 mm", field: "heightMm" });
    }

    // 3. Driver Command Language Validation
    if (template.driverId === "zpl" && template.script) {
      if (!template.script.includes("^XA") || !template.script.includes("^XZ")) {
        issues.push({
          type: "WARNING",
          code: "ZPL_SYNTAX_WARNING",
          message: "ZPL script does not contain standard ^XA / ^XZ format tags",
          field: "script",
        });
      }
    }

    const hasError = issues.some((i) => i.type === "ERROR");
    return {
      valid: !hasError,
      issues,
    };
  }
}
