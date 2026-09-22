import React from "react";
import type { PurchaseOrderHeader, PurchaseOrderSizePivotRow } from "../../components/purchase/types.ts";

interface SizePivotMatrixA4Props {
  header: PurchaseOrderHeader;
  rows: PurchaseOrderSizePivotRow[];
  currencySymbol: string;
  vendorName?: string;
}

const SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];

export const SizePivotMatrixA4: React.FC<SizePivotMatrixA4Props> = ({ header, rows, currencySymbol, vendorName }) => {
  const validRows = rows.filter((row) => row.articleNo.trim() || row.product.trim());
  const totalQty = validRows.reduce((sum, row) => sum + (row.totalQty || 0), 0);
  const totalValue = validRows.reduce((sum, row) => sum + (row.totalValue || row.totalQty * row.rate), 0);

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 mx-auto box-border text-[11px] font-sans print-only-container">
      <header className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between">
        <div>
          <div className="text-xl font-black text-slate-950">SMRITI RETAIL OS</div>
          <div className="text-xs text-slate-600">Size Pivot Matrix Procurement</div>
          <div className="text-[10px] mt-2">Supplier: <strong>{vendorName || header.supplierName || "Selected Supplier"}</strong></div>
          <div className="text-[10px]">Delivery: {header.deliveryLocation || "Main Store (MAIN)"}</div>
        </div>
        <div className="text-right">
          <div className="bg-slate-900 text-white px-3 py-1 font-bold text-xs">SIZE PIVOT MATRIX</div>
          <div className="font-mono font-bold mt-2">PO No: {header.prefix || "PO"}-{header.orderNumber || "1"}</div>
          <div className="text-[10px]">Date: {header.orderDate}</div>
          <div className="text-[10px]">Due: {header.deliveryDate}</div>
        </div>
      </header>

      <table className="w-full border-collapse border border-slate-400 text-[9px]">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="p-1 border border-slate-700">#</th>
            <th className="p-1 border border-slate-700">ARTICLE</th>
            <th className="p-1 border border-slate-700">PRODUCT</th>
            <th className="p-1 border border-slate-700">COLOR</th>
            {SIZES.map((size) => <th key={size} className="p-1 border border-slate-700">{size}</th>)}
            <th className="p-1 border border-slate-700">QTY</th>
            <th className="p-1 border border-slate-700">RATE</th>
            <th className="p-1 border border-slate-700">TAX</th>
            <th className="p-1 border border-slate-700">VALUE</th>
          </tr>
        </thead>
        <tbody>
          {validRows.length === 0 ? (
            <tr><td colSpan={17} className="p-5 text-center italic text-slate-500">No pivot items available</td></tr>
          ) : validRows.map((row, index) => (
            <tr key={row.id} className="border-b border-slate-200">
              <td className="p-1 border border-slate-300 text-center">{index + 1}</td>
              <td className="p-1 border border-slate-300 font-mono font-bold">{row.articleNo || "-"}</td>
              <td className="p-1 border border-slate-300 font-semibold">{row.product || "-"}</td>
              <td className="p-1 border border-slate-300">{row.color || "-"}</td>
              {SIZES.map((size) => <td key={size} className="p-1 border border-slate-300 text-center font-mono">{row.sizeQuantities[size] || 0}</td>)}
              <td className="p-1 border border-slate-300 text-right font-bold">{row.totalQty}</td>
              <td className="p-1 border border-slate-300 text-right">{currencySymbol}{row.rate.toFixed(2)}</td>
              <td className="p-1 border border-slate-300 text-right">{row.gstPercent.toFixed(2)}%</td>
              <td className="p-1 border border-slate-300 text-right font-bold">{currencySymbol}{(row.totalValue || row.totalQty * row.rate).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold">
            <td colSpan={8} className="p-2 text-right">TOTAL</td>
            <td className="p-2 text-right">{totalQty}</td>
            <td colSpan={2}></td>
            <td className="p-2 text-right">{currencySymbol}{totalValue.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="grid grid-cols-4 gap-2 mt-5 text-[8.5px]">
        {[
          ["Prepared By", header.buyer || "Procurement User"],
          ["Verified By", "Name / Signature"],
          ["Approved By", "Name / Signature"],
          ["Supplier Acknowledgement", "Name / Signature / Stamp"],
        ].map(([label, value]) => (
          <div key={label} className="border border-slate-300 rounded p-2 min-h-[42px] flex flex-col justify-between">
            <span className="font-bold uppercase text-slate-700">{label}</span>
            <span className="border-t border-dashed border-slate-400 pt-1 text-slate-500">{value}</span>
          </div>
        ))}
      </div>

      <footer className="mt-5 border-t border-slate-300 pt-2 text-[9px] text-slate-600 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="font-semibold text-slate-800">SMRITI Retail OS | Size Pivot Matrix</span>
          <span>PO: {header.prefix || "PO"}-{header.orderNumber || "1"} | Status: DRAFT</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Payment: {header.paymentTerms || "30 Days"} | Purchaser: {header.buyer || "-"}</span>
          <span>Supplier Ref: {header.supplierReference || "-"} | Due: {header.deliveryDate || "-"}</span>
        </div>
        <div className="flex justify-between gap-4 text-slate-500">
          <span>This purchase order is not a tax invoice. Goods are subject to inspection and acceptance.</span>
        </div>
        <div className="text-center border-t border-slate-200 pt-1.5 mt-1 font-mono">
          <div className="font-bold text-indigo-900">SUBJECT TO NAGPUR JURISDICTION</div>
          <div className="text-slate-600 mt-0.5">SMRITISYS | SMRITI Retail OS | Enterprise Commerce Suite | smritibooks.com</div>
        </div>
      </footer>
    </div>
  );
};

export default SizePivotMatrixA4;
