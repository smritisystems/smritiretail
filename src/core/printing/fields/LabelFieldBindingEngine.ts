/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-003 (Label Field Binding Engine v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { UniversalFieldRegistry } from "./UniversalFieldRegistry.ts";

export interface BindingEvaluationResult {
  value: string;
  resolvedKeys: string[];
  missingKeys: string[];
  errors: string[];
}

export interface FormatterContext {
  currencySymbol?: string;
  dateFormat?: string;
  locale?: string;
}

export class LabelFieldBindingEngineService {
  /**
   * Resolves a single data path from the data context.
   * e.g. "product.brand" -> dataContext.product?.brand or dataContext.brand
   */
  public getRawValue(path: string, context: Record<string, any>): { value: any; found: boolean } {
    if (!path) return { value: undefined, found: false };

    // Try resolving via UniversalFieldRegistry
    const canonical = UniversalFieldRegistry.resolveCanonicalPath(path) || path;

    // 1. Direct property match in context (e.g. context["product.brand"] or context["brand"])
    if (context[canonical] !== undefined) {
      return { value: context[canonical], found: true };
    }
    if (context[path] !== undefined) {
      return { value: context[path], found: true };
    }

    // 2. Traversal by dot notation (e.g. context.product.brand)
    const parts = path.split(".");
    let current = context;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        // Fallback: check canonical key
        const def = UniversalFieldRegistry.getFieldDefinition(path);
        if (def && def.key in context) {
          return { value: context[def.key], found: true };
        }
        return { value: undefined, found: false };
      }
    }

    return { value: current, found: true };
  }

  /**
   * Formats a raw value using whitelisted formatters.
   */
  public applyFormatter(val: any, pipeFormatter: string, fmtCtx?: FormatterContext): string {
    if (val === undefined || val === null) return "";

    const [fmtName, rawArg] = pipeFormatter.split(":").map((s) => s.trim());
    const arg = rawArg ? rawArg.replace(/^['"]|['"]$/g, "") : "";

    switch (fmtName.toLowerCase()) {
      case "currency": {
        const num = parseFloat(val);
        if (isNaN(num)) return String(val);
        const symbol = fmtCtx?.currencySymbol || "₹";
        return `${symbol}${num.toFixed(2)}`;
      }
      case "uppercase":
      case "upper":
        return String(val).toUpperCase();

      case "lowercase":
      case "lower":
        return String(val).toLowerCase();

      case "default":
        if (val === "" || val === undefined || val === null) {
          return arg;
        }
        return String(val);

      case "integer":
      case "int": {
        const num = parseInt(val, 10);
        return isNaN(num) ? String(val) : String(num);
      }

      case "date": {
        try {
          const d = new Date(val);
          if (isNaN(d.getTime())) return String(val);
          return d.toLocaleDateString(fmtCtx?.locale || "en-IN");
        } catch {
          return String(val);
        }
      }

      default:
        return String(val);
    }
  }

  /**
   * Evaluates a token expression like `{{product.mrp | currency}}` or `{{product.brand}} - {{product.style_code}}`.
   */
  public evaluateExpression(
    expression: string,
    dataContext: Record<string, any>,
    fmtCtx?: FormatterContext
  ): BindingEvaluationResult {
    const result: BindingEvaluationResult = {
      value: "",
      resolvedKeys: [],
      missingKeys: [],
      errors: [],
    };

    if (!expression) {
      return result;
    }

    const tokenRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    let hasTokens = false;

    const substituted = expression.replace(tokenRegex, (_, tokenBody: string) => {
      hasTokens = true;
      const parts = tokenBody.split("|").map((s) => s.trim());
      const fieldPath = parts[0];
      const formatters = parts.slice(1);

      const { value, found } = this.getRawValue(fieldPath, dataContext);

      if (!found || value === undefined || value === null || value === "") {
        // Check if there is a default formatter
        const defaultFmt = formatters.find((f) => f.toLowerCase().startsWith("default"));
        if (defaultFmt) {
          const formatted = this.applyFormatter("", defaultFmt, fmtCtx);
          result.resolvedKeys.push(fieldPath);
          return formatted;
        }

        result.missingKeys.push(fieldPath);
        result.errors.push(`Missing value for field '${fieldPath}'`);
        return "";
      }

      result.resolvedKeys.push(fieldPath);
      let processedVal = value;
      for (const fmt of formatters) {
        processedVal = this.applyFormatter(processedVal, fmt, fmtCtx);
      }

      return String(processedVal);
    });

    if (hasTokens) {
      result.value = substituted;
    } else {
      // Plain text expression without tokens
      result.value = expression;
    }

    return result;
  }
}

export const LabelFieldBindingEngine = new LabelFieldBindingEngineService();
