/**
 * Project      : SMRITI Retail OS
 * Component    : ScanBarcodeRow & LineItemTable Extensions
 * Standard     : IPS-002 / SMRITI Sales Billing Studio
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.2.0
 */

import React, { useState, useRef } from "react";
import { Scan, Plus, User, Building2 } from "lucide-react";
import { Product, Staff } from "../../types.js";

export interface ScanRowFieldConfig {
  key: "barcode" | "qty" | "discountPct" | "discountAmt" | "salesmanId" | "departmentId";
  label: string;
  visible: boolean;
  width?: string;
}

export const DEFAULT_SCAN_ROW_CONFIG: ScanRowFieldConfig[] = [
  { key: "barcode", label: "Barcode / SKU", visible: true, width: "w-40" },
  { key: "qty", label: "Qty", visible: true, width: "w-16" },
  { key: "discountPct", label: "Disc %", visible: true, width: "w-16" },
  { key: "discountAmt", label: "Disc ₹", visible: true, width: "w-20" },
  { key: "salesmanId", label: "Salesman / Attribution", visible: true, width: "w-48" },
  { key: "departmentId", label: "Department", visible: true, width: "w-32" },
];

export interface ScanBarcodeRowProps {
  products: Product[];
  staffList: Partial<Staff>[];
  departments: string[];
  defaultSalesmanId: string;
  defaultDepartmentId: string;
  fieldConfig?: ScanRowFieldConfig[];
  onAddLineItem: (item: {
    product?: Product;
    barcode: string;
    qty: number;
    discountPct: number;
    discountAmt: number;
    salesmanId: string;
    departmentId: string;
  }) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const ScanBarcodeRow: React.FC<ScanBarcodeRowProps> = ({
  products,
  staffList,
  departments,
  defaultSalesmanId,
  defaultDepartmentId,
  fieldConfig = DEFAULT_SCAN_ROW_CONFIG,
  onAddLineItem,
  onNotification,
}) => {
  const [scanInput, setScanInput] = useState("");
  const [qty, setQty] = useState(1);
  const [discountPct, setDiscountPct] = useState(0);
  const [discountAmt, setDiscountAmt] = useState(0);
  const [salesmanId, setSalesmanId] = useState(defaultSalesmanId);
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId);

  const inputRef = useRef<HTMLInputElement>(null);

  const isVisible = (key: ScanRowFieldConfig["key"]) => {
    const cfg = fieldConfig.find((c) => c.key === key);
    return cfg ? cfg.visible : true;
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanInput.trim().toLowerCase();
    if (!query) return;

    // Search product by barcode, code, or SKU
    const matchedProduct = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === query) ||
        (p.code && p.code.toLowerCase() === query) ||
        (p.sku && p.sku.toLowerCase() === query) ||
        p.name.toLowerCase().includes(query)
    );

    if (matchedProduct) {
      onAddLineItem({
        product: matchedProduct,
        barcode: matchedProduct.barcode || matchedProduct.code || scanInput,
        qty: qty || 1,
        discountPct,
        discountAmt,
        salesmanId: salesmanId || defaultSalesmanId,
        departmentId: departmentId || defaultDepartmentId,
      });

      if (onNotification) {
        onNotification("Item Added", `${matchedProduct.name} added to invoice line items.`, "success");
      }
    } else {
      // Manual line item fallback if barcode not found in local catalog
      onAddLineItem({
        barcode: scanInput,
        qty: qty || 1,
        discountPct,
        discountAmt,
        salesmanId: salesmanId || defaultSalesmanId,
        departmentId: departmentId || defaultDepartmentId,
      });

      if (onNotification) {
        onNotification("Custom Barcode Added", `Added row for barcode: ${scanInput}`, "success");
      }
    }

    setScanInput("");
    setQty(1);
    setDiscountPct(0);
    setDiscountAmt(0);
    inputRef.current?.focus();
  };

  return (
    <tr className="bg-blue-950/30 border-t-2 border-dashed border-blue-500/40 font-mono text-xs">
      <td className="py-2 px-2 text-center text-blue-400 font-bold">
        <Scan className="w-4 h-4 animate-pulse inline" />
      </td>

      {/* Barcode Input Field */}
      {isVisible("barcode") && (
        <td className="py-2 px-2" colSpan={2}>
          <form onSubmit={handleScanSubmit} className="flex items-center space-x-1">
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Scan Barcode / Enter SKU..."
              className="w-full bg-slate-900 border border-blue-500/50 rounded-lg px-2.5 py-1 text-xs text-white font-mono font-bold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shrink-0 flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </td>
      )}

      {/* HSN & UOM placeholders */}
      <td className="py-2 px-2 text-slate-500 text-[10px]">AUTO</td>
      <td className="py-2 px-2 text-slate-500 text-[10px]">Pcs</td>

      {/* Qty Field */}
      {isVisible("qty") && (
        <td className="py-2 px-2 text-right">
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || 1)}
            className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right text-xs font-mono font-bold text-white"
          />
        </td>
      )}

      {/* Rate placeholder */}
      <td className="py-2 px-2 text-right text-slate-500 text-[10px]">AUTO</td>

      {/* Discount Pct Field */}
      {isVisible("discountPct") && (
        <td className="py-2 px-2 text-right">
          <input
            type="number"
            min="0"
            max="100"
            value={discountPct}
            onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
            className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right text-xs font-mono text-white"
          />
        </td>
      )}

      {/* Discount Amt Field */}
      {isVisible("discountAmt") && (
        <td className="py-2 px-2 text-right">
          <input
            type="number"
            min="0"
            value={discountAmt}
            onChange={(e) => setDiscountAmt(parseFloat(e.target.value) || 0)}
            className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right text-xs font-mono text-white"
          />
        </td>
      )}

      {/* Per-Line Salesman Attribution Select */}
      {isVisible("salesmanId") && (
        <td className="py-2 px-2">
          <div className="flex items-center space-x-1">
            <User className="w-3 h-3 text-indigo-400 shrink-0" />
            <select
              value={salesmanId}
              onChange={(e) => setSalesmanId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-semibold text-indigo-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">-- Select Staff --</option>
              {staffList.map((s) => (
                <option key={s.id || s.employeeId} value={s.employeeId || s.id}>
                  {s.name} ({s.department || "Sales"})
                </option>
              ))}
            </select>
          </div>
        </td>
      )}

      {/* Per-Line Department Attribution Select */}
      {isVisible("departmentId") && (
        <td className="py-2 px-2">
          <div className="flex items-center space-x-1">
            <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-semibold text-emerald-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">-- Dept --</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </td>
      )}

      <td className="py-2 px-2 text-center text-slate-500">
        <span className="text-[10px] uppercase font-bold text-blue-400">Scan</span>
      </td>
    </tr>
  );
};
