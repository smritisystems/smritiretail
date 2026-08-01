/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : © SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * Lightweight, zero-dependency Spreadsheet Formula Engine.
 * Evaluates math expressions, cell references (e.g. C2, D5), column field references (e.g. {costPrice}),
 * and built-in functions (=ROUND(val, 2), =SUM(a, b), =MIN(a, b), =MAX(a, b), =AVG(a, b)).
 */

import logger from "../core/logging/logger.js";

export interface FormulaContext {
  getValue: (cellRef: string) => number | string;
  getRowData?: (rowIndex: number) => Record<string, any>;
  currentRowIndex?: number;
}

/**
 * Checks if a string starts with '=' denoting a formula.
 */
export function isFormula(val: string): boolean {
  if (typeof val !== "string") return false;
  return val.trim().startsWith("=");
}

/**
 * Evaluates a formula string (e.g. "=C2 * 1.18" or "=ROUND(costPrice * 1.25, 2)").
 */
export function evaluateFormula(
  formulaStr: string,
  context: FormulaContext
): number {
  if (!formulaStr || !isFormula(formulaStr)) {
    const parsed = parseFloat(formulaStr);
    return isNaN(parsed) ? 0 : parsed;
  }

  try {
    let expr = formulaStr.trim().slice(1).trim();

    // 1. Evaluate built-in ROUND function: ROUND(expression, decimals)
    expr = expr.replace(/ROUND\s*\(([^,]+),?\s*(\d+)?\)/gi, (_, innerExpr, decimals) => {
      const val = evaluateExpression(innerExpr, context);
      const dec = decimals !== undefined ? parseInt(decimals, 10) : 0;
      const factor = Math.pow(10, dec);
      return (Math.round(val * factor) / factor).toString();
    });

    // 2. Evaluate built-in SUM function: SUM(arg1, arg2, ...)
    expr = expr.replace(/SUM\s*\(([^)]+)\)/gi, (_, argsStr) => {
      const args = argsStr.split(",").map((a: string) => evaluateExpression(a.trim(), context));
      const sum = args.reduce((acc: number, curr: number) => acc + curr, 0);
      return sum.toString();
    });

    // 3. Evaluate built-in AVG function: AVG(arg1, arg2, ...)
    expr = expr.replace(/AVG\s*\(([^)]+)\)/gi, (_, argsStr) => {
      const args = argsStr.split(",").map((a: string) => evaluateExpression(a.trim(), context));
      const avg = args.length > 0 ? args.reduce((acc: number, curr: number) => acc + curr, 0) / args.length : 0;
      return avg.toString();
    });

    // 4. Evaluate built-in MIN function: MIN(arg1, arg2, ...)
    expr = expr.replace(/MIN\s*\(([^)]+)\)/gi, (_, argsStr) => {
      const args = argsStr.split(",").map((a: string) => evaluateExpression(a.trim(), context));
      return Math.min(...args).toString();
    });

    // 5. Evaluate built-in MAX function: MAX(arg1, arg2, ...)
    expr = expr.replace(/MAX\s*\(([^)]+)\)/gi, (_, argsStr) => {
      const args = argsStr.split(",").map((a: string) => evaluateExpression(a.trim(), context));
      return Math.max(...args).toString();
    });

    return evaluateExpression(expr, context);
  } catch (err) {
    logger.warn("Formula evaluation warning:", err as unknown);
    return 0;
  }
}

/**
 * Safely evaluates simple arithmetic expression containing numbers, operators +, -, *, /, %, and cell references.
 */
function evaluateExpression(expr: string, context: FormulaContext): number {
  // Replace cell references (e.g. A1, C2, costPrice, price) with resolved numeric values
  let resolvedExpr = expr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (token) => {
    // If token is a keyword or function name, don't replace
    if (["Math", "round", "min", "max", "abs"].includes(token)) return token;
    
    const val = context.getValue(token);
    const num = typeof val === "number" ? val : parseFloat(val as string);
    return isNaN(num) ? "0" : num.toString();
  });

  // Handle % symbol (e.g., 10% -> 0.10)
  resolvedExpr = resolvedExpr.replace(/(\d+(\.\d+)?)%/g, (_, num) => (parseFloat(num) / 100).toString());

  // Sanitize math string (allow only numbers, decimal points, spaces, and math operators)
  if (!/^[0-9\.\s\+\-\*\/\(\)]+$/.test(resolvedExpr)) {
    return 0;
  }

  // Safe Function evaluation for simple arithmetic math
  try {
    const fn = new Function(`"use strict"; return (${resolvedExpr});`);
    const res = fn();
    return typeof res === "number" && !isNaN(res) && isFinite(res) ? res : 0;
  } catch {
    return 0;
  }
}
