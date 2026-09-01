/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.10.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useRef } from "react";
import { TaxInvoiceItemRow } from "../types.ts";

export interface TaxEntryBartryBarProps {
  onAddItem: (item: Omit<TaxInvoiceItemRow, "sNo" | "id">) => void;
  staffList?: { id: string; name: string }[];
  onLookupProduct?: (term: string) => Promise<any | null>;
}

export const TaxEntryBar: React.FC<TaxEntryBartryBarProps> = ({
  onAddItem,
  staffList = [
    { id: "EMP001", name: "EMP001 - Jawahar Mallah" },
    { id: "EMP002", name: "EMP002 - John Doe" },
    { id: "EMP003", name: "EMP003 - Jane Smith" },
  ],
  onLookupProduct,
}) => {
  const [stockNo, setStockNo] = useState("");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState<number | "">("");
  const [qty, setQty] = useState<number | "">(1);
  const [discCode, setDiscCode] = useState("");
  const [discQty, setDiscQty] = useState<number | "">("");
  const [discPercent, setDiscPercent] = useState<number | "">("");
  const [discAmt, setDiscAmt] = useState<number | "">("");
  const [salesStaff, setSalesStaff] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [gstRate, setGstRate] = useState<number>(18);

  const stockInputRef = useRef<HTMLInputElement>(null);

  const numRate = typeof rate === "number" ? rate : 0;
  const numQty = typeof qty === "number" ? qty : 1;
  const numValue = numRate * numQty;
  const numDiscPercent = typeof discPercent === "number" ? discPercent : 0;
  const numDiscAmt = typeof discAmt === "number" ? discAmt : (numValue * numDiscPercent) / 100;
  const numTotal = Math.max(0, numValue - numDiscAmt);

  const handleStockNoBlur = async () => {
    if (!stockNo.trim()) return;
    if (onLookupProduct) {
      const prod = await onLookupProduct(stockNo.trim());
      if (prod) {
        setDescription(prod.name || prod.title || "Selected Item");
        setRate(Number(prod.price || prod.mrp || 0));
        setHsnCode(prod.hsn_code || "64041990");
        setGstRate(Number(prod.gst_percentage || 18));
      }
    }
  };

  const handleCommitRow = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!stockNo.trim() && !description.trim()) return;

    onAddItem({
      stockNo: stockNo.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      itemDescription: description.trim() || "Retail Item",
      rate: numRate,
      qty: numQty,
      value: numValue,
      discCode: discCode || "None",
      discQty: typeof discQty === "number" ? discQty : 0,
      discPercent: numDiscPercent,
      discAmt: numDiscAmt,
      total: numTotal,
      salesStaff: salesStaff || staffList[0]?.name || "EMP001 - Jawahar Mallah",
      hsnCode: hsnCode || "64041990",
      gstRate: gstRate || 18,
    });

    // Reset entry bar and focus back on stockNo
    setStockNo("");
    setDescription("");
    setRate("");
    setQty(1);
    setDiscCode("");
    setDiscQty("");
    setDiscPercent("");
    setDiscAmt("");
    setHsnCode("");
    stockInputRef.current?.focus();
  };

  return (
    <form
      onSubmit={handleCommitRow}
      className="bg-surface-container-low border-t border-outline-variant p-2 flex gap-2 items-center"
    >
      <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-variant px-2 py-1 rounded w-10 text-center select-none">
        F1
      </span>
      <div className="flex-1 grid grid-cols-[100px_1fr_80px_80px_100px_80px_80px_80px_100px_120px_120px] gap-2">
        {/* Stock No */}
        <input
          ref={stockInputRef}
          type="text"
          value={stockNo}
          data-field-key="item_code"
          onChange={(e) => setStockNo(e.target.value)}
          onBlur={handleStockNoBlur}
          placeholder="Stock No/Barcode"
          className="border-outline-variant h-8 text-body-sm font-code-md rounded px-2 bg-surface-container-lowest text-on-surface focus:border-secondary focus:ring-secondary"
        />

        {/* Item Description */}
        <input
          type="text"
          value={description}
          data-field-key="product_name"
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Item Description"
          className="border-outline-variant h-8 text-body-sm rounded px-2 bg-surface-container cursor-not-allowed text-on-surface"
          readOnly
        />

        {/* Rate */}
        <input
          type="number"
          step="any"
          value={rate}
          data-field-key="selling_price"
          onChange={(e) => setRate(e.target.value === "" ? "" : parseFloat(e.target.value))}
          placeholder="Rate"
          className="border-outline-variant h-8 text-body-sm font-code-md rounded px-2 text-right bg-surface-container-lowest text-on-surface focus:border-secondary"
        />

        {/* Qty */}
        <input
          type="number"
          step="any"
          value={qty}
          data-field-key="quantity"
          onChange={(e) => setQty(e.target.value === "" ? "" : parseFloat(e.target.value))}
          placeholder="Qty"
          className="border-outline-variant h-8 text-body-sm font-code-md rounded px-2 text-right bg-surface-container-lowest text-on-surface focus:border-secondary font-bold"
        />

        {/* Value */}
        <input
          type="text"
          value={numValue > 0 ? numValue.toFixed(2) : ""}
          data-field-key="selling_price"
          placeholder="Value"
          readOnly
          className="bg-surface-variant border-outline-variant h-8 text-body-sm font-code-md rounded px-2 text-right cursor-not-allowed text-on-surface"
        />

        {/* Disc Code */}
        <select
          value={discCode}
          onChange={(e) => setDiscCode(e.target.value)}
          className="border-outline-variant h-8 text-body-sm font-code-md rounded px-2 bg-surface-container-lowest focus:border-secondary focus:ring-secondary text-on-surface"
        >
          <option value="">None</option>
          <option value="PROMO10">PROMO10</option>
          <option value="SEASONAL">SEASONAL</option>
          <option value="LOYALTY">LOYALTY</option>
        </select>

        {/* Disc Qty */}
        <input
          type="number"
          value={discQty}
          data-field-key="quantity"
          onChange={(e) => setDiscQty(e.target.value === "" ? "" : parseFloat(e.target.value))}
          placeholder="Disc Qty"
          className="border-outline-variant h-8 text-body-sm font-code-md rounded px-2 text-right bg-surface-container-lowest text-on-surface focus:border-secondary"
        />

        {/* Disc % */}
        <input
          type="number"
          step="any"
          value={discPercent}
          data-field-key="discount_percent"
          onChange={(e) => setDiscPercent(e.target.value === "" ? "" : parseFloat(e.target.value))}
          placeholder="Disc %"
          className="border-outline-variant h-8 text-body-sm font-code-md rounded px-2 text-right bg-surface-container-lowest text-on-surface focus:border-secondary"
        />

        {/* Disc Amt */}
        <input
          type="text"
          value={numDiscAmt > 0 ? numDiscAmt.toFixed(2) : ""}
          data-field-key="discount_amount"
          onChange={(e) => setDiscAmt(e.target.value === "" ? "" : parseFloat(e.target.value))}
          placeholder="Disc Amt"
          className="border-outline-variant h-8 text-body-sm font-code-md rounded px-2 text-right bg-surface-container-highest text-on-surface"
        />

        <input
          type="text"
          value={numTotal > 0 ? numTotal.toFixed(2) : ""}
          data-field-key="selling_price"
          placeholder="Total"
          readOnly
          className="border-outline-variant h-8 text-body-sm font-code-md rounded px-2 text-right bg-surface-container-lowest text-emerald-700 font-bold"
        />

        {/* Total */}
        <input
          type="text"
          value={numTotal > 0 ? numTotal.toFixed(2) : ""}
          placeholder="Total"
          readOnly
          className="border-outline-variant h-8 text-body-sm font-code-md rounded px-2 text-right bg-surface-container-lowest text-emerald-700 font-bold"
        />

        {/* Staff select */}
        <select
          value={salesStaff}
          onChange={(e) => setSalesStaff(e.target.value)}
          className="border-outline-variant h-8 text-body-sm rounded px-1 bg-surface-container-lowest text-on-surface"
        >
          <option value="">Staff...</option>
          {staffList.map((st) => (
            <option key={st.id} value={st.name}>
              {st.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="hidden" aria-hidden="true" />
    </form>
  );
};
