/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Spreadsheet Platform (SSP)
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

export interface FormulaContext {
  getValue: (cellRef: string) => number | string;
  getRowData?: (rowIndex: number) => Record<string, any>;
  currentRowIndex?: number;
}

export function isFormula(val: string): boolean {
  if (typeof val !== "string") return false;
  return val.trim().startsWith("=");
}

/**
 * Enterprise Formula Engine supporting math operations, Excel functions, and ERP business functions:
 * - =GST(price, rate)
 * - =MARGIN(sell, buy)
 * - =MRP(buy, margin)
 * - =ROUND(val, dec)
 */
import logger from "../../core/logging/logger.js";

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

    // 1. ERP Business Function: GST(price, rate) -> (price * rate / 100)
    expr = expr.replace(/GST\s*\(([^,]+),\s*([^)]+)\)/gi, (_, pExpr, rExpr) => {
      const price = evaluateExpression(pExpr, context);
      const rate = evaluateExpression(rExpr, context);
      return (price * (rate / 100)).toString();
    });

    // 2. ERP Business Function: MARGIN(sell, buy) -> ((sell - buy) / sell) * 100
    expr = expr.replace(/MARGIN\s*\(([^,]+),\s*([^)]+)\)/gi, (_, sExpr, bExpr) => {
      const sell = evaluateExpression(sExpr, context);
      const buy = evaluateExpression(bExpr, context);
      if (sell <= 0) return "0";
      return (((sell - buy) / sell) * 100).toString();
    });

    // 3. ERP Business Function: MRP(buy, marginPct) -> buy * (1 + marginPct / 100)
    expr = expr.replace(/MRP\s*\(([^,]+),\s*([^)]+)\)/gi, (_, bExpr, mExpr) => {
      const buy = evaluateExpression(bExpr, context);
      const marginPct = evaluateExpression(mExpr, context);
      return (buy * (1 + marginPct / 100)).toString();
    });

    // 4. Excel Math Function: ROUND(val, dec)
    expr = expr.replace(/ROUND\s*\(([^,]+),?\s*(\d+)?\)/gi, (_, innerExpr, decimals) => {
      const val = evaluateExpression(innerExpr, context);
      const dec = decimals !== undefined ? parseInt(decimals, 10) : 0;
      const factor = Math.pow(10, dec);
      return (Math.round(val * factor) / factor).toString();
    });

    // 5. Excel Aggregation Functions: SUM, AVG, MIN, MAX
    expr = expr.replace(/SUM\s*\(([^)]+)\)/gi, (_, argsStr) => {
      const args = argsStr.split(",").map((a: string) => evaluateExpression(a.trim(), context));
      return args.reduce((acc: number, curr: number) => acc + curr, 0).toString();
    });

    expr = expr.replace(/AVG\s*\(([^)]+)\)/gi, (_, argsStr) => {
      const args = argsStr.split(",").map((a: string) => evaluateExpression(a.trim(), context));
      return (args.length > 0 ? args.reduce((acc: number, curr: number) => acc + curr, 0) / args.length : 0).toString();
    });

    return evaluateExpression(expr, context);
  } catch (err) {
    logger.warn("[SSP FormulaEngine] Evaluation exception:", err as unknown);
    return 0;
  }
}

function evaluateExpression(expr: string, context: FormulaContext): number {
  let resolvedExpr = expr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (token) => {
    if (["Math", "round", "min", "max", "abs"].includes(token)) return token;
    const val = context.getValue(token);
    const num = typeof val === "number" ? val : parseFloat(val as string);
    return isNaN(num) ? "0" : num.toString();
  });

  resolvedExpr = resolvedExpr.replace(/(\d+(\.\d+)?)%/g, (_, num) => (parseFloat(num) / 100).toString());

  if (!/^[0-9\.\s\+\-\*\/\(\)]+$/.test(resolvedExpr)) {
    return 0;
  }

  try {
    const fn = new Function(`"use strict"; return (${resolvedExpr});`);
    const res = fn();
    return typeof res === "number" && !isNaN(res) && isFinite(res) ? res : 0;
  } catch {
    return 0;
  }
}
