/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.1
 * Created      : 2026-09-20
 * Modified     : 2026-09-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_PRINT_MODAL")
 * Target UI    : SMRITI Statutory A4 Goods Receipt Note (GRN) & Landed Cost Audit Slip
 */

import React, { useState, useEffect } from "react";
import { Printer, X, ZoomIn, ZoomOut, CheckCircle2, ShieldCheck, Truck } from "lucide-react";

export interface GrnPrintItem {
  code?: string;
  sku?: string;
  name?: string;
  size?: string;
  color?: string;
  quantity_ordered?: number;
  quantity_received?: number;
  quantity_damaged?: number;
  cost_price?: number;
  invoice_rate?: number;
  landed_cost?: number;
  freight_allocated?: number;
  mrp?: number;
  gst_rate?: number;
}

export interface GrnPrintCostComponent {
  component_type: string;
  description?: string;
  amount: number;
  taxable_amount?: number;
  tax_amount?: number;
  tax_rate?: number;
  total_amount?: number;
  allocation_method?: string;
  transporter_name?: string;
  document_no?: string;
}

export interface GrnPrintReceiptData {
  id?: string;
  receipt_no: string;
  date?: string;
  created_at?: string;
  supplier_id?: string;
  supplier_name?: string;
  order_id?: string;
  po_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  transporter_name?: string;
  lr_number?: string;
  lr_date?: string;
  vehicle_number?: string;
  weight_cbm?: string;
  cartons?: number;
  notes?: string;
  subtotal?: number;
  tax_total?: number;
  grand_total?: number;
  items: GrnPrintItem[];
  cost_components?: GrnPrintCostComponent[];
}

interface GrnPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: GrnPrintReceiptData | null;
}

export const GrnPrintModal: React.FC<GrnPrintModalProps> = ({
  isOpen,
  onClose,
  receiptData,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && e.key === "p")) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !receiptData) return null;

  const items = receiptData.items || [];
  const costComponents = receiptData.cost_components || [];

  const totalOrdered = items.reduce((s, i) => s + Number(i.quantity_ordered || 0), 0);
  const totalReceived = items.reduce((s, i) => s + Number(i.quantity_received || 0), 0);
  const totalDamaged = items.reduce((s, i) => s + Number(i.quantity_damaged || 0), 0);
  const totalAccepted = items.reduce(
    (s, i) => s + Math.max(0, Number(i.quantity_received || 0) - Number(i.quantity_damaged || 0)),
    0
  );

  const totalMaterialsValue = items.reduce((s, i) => {
    const accepted = Math.max(0, Number(i.quantity_received || 0) - Number(i.quantity_damaged || 0));
    const rate = Number(i.invoice_rate || i.cost_price || 0);
    return s + accepted * rate;
  }, 0);

  const totalAddons = costComponents.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalAcquisitionCost = totalMaterialsValue + totalAddons;
  const avgLandedCost = totalAccepted > 0 ? totalAcquisitionCost / totalAccepted : 0;

  const displayDate = receiptData.date ||
    (receiptData.created_at ? new Date(receiptData.created_at).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Top Modal Controls Toolbar (Hidden in Print) */}
      <div className="print:hidden bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between text-white shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-600 text-white">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm">Statutory A4 GRN &amp; Landed Cost Audit Slip</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                {receiptData.receipt_no}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Statutory verification sheet with line-item landed cost allocations &amp; carrier audit trail
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.max(60, prev - 10))}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 transition"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-200">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(140, prev + 10))}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 transition"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold text-xs shadow-md transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Slip (Ctrl+P)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Body Canvas Container */}
      <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-slate-800/40">
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
          className="transition-transform duration-100 ease-out"
        >
          {/* A4 Sheet Dimensions: 210mm x 297mm */}
          <div className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[15mm] shadow-2xl rounded-sm box-border text-[11px] font-sans flex flex-col justify-between print:w-full print:min-h-0 print:p-0 print:shadow-none print:rounded-none">
            <div>
              {/* Header: Company & Statutory Identification */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-lg text-slate-950 tracking-tight">SMRITI RETAIL OS</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[9px] font-bold">
                      OFFICIAL SYSTEM OF RECORD
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium">
                    Statutory Warehouse Inward, Physical Verification &amp; Landed Cost Capitalization Slip
                  </p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-base font-extrabold text-indigo-700">{receiptData.receipt_no}</div>
                  <div className="text-[10px] text-slate-500">Date: {displayDate}</div>
                  <div className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">
                    ● POSTED &amp; ALLOCATED
                  </div>
                </div>
              </div>

              {/* Document References Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Supplier &amp; Source Details
                  </div>
                  <div className="font-bold text-xs text-slate-900">
                    {receiptData.supplier_name || receiptData.supplier_id || "Direct Supplier"}
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    Supplier ID: {receiptData.supplier_id || "--"}
                  </div>
                  {receiptData.invoice_number && (
                    <div className="text-[10px] text-slate-600 font-mono">
                      Vendor Invoice: <strong>{receiptData.invoice_number}</strong>
                      {receiptData.invoice_date ? ` (${receiptData.invoice_date})` : ""}
                    </div>
                  )}
                  {receiptData.po_number && (
                    <div className="text-[10px] text-slate-600 font-mono">
                      PO Reference: <strong>{receiptData.po_number}</strong>
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-right">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Logistics &amp; Carrier Audit Trail
                  </div>
                  <div className="font-bold text-xs text-slate-900">
                    {receiptData.transporter_name || "Direct / Hand Delivery"}
                  </div>
                  {receiptData.lr_number && (
                    <div className="text-[10px] text-slate-600 font-mono">
                      LR / Bilty No: <strong>{receiptData.lr_number}</strong>
                      {receiptData.lr_date ? ` dated ${receiptData.lr_date}` : ""}
                    </div>
                  )}
                  {receiptData.vehicle_number && (
                    <div className="text-[10px] text-slate-600 font-mono">
                      Vehicle: <strong>{receiptData.vehicle_number}</strong>
                    </div>
                  )}
                  {(receiptData.cartons || receiptData.weight_cbm) && (
                    <div className="text-[10px] text-slate-600 font-mono">
                      Load: {receiptData.cartons ? `${receiptData.cartons} Cartons` : ""}{" "}
                      {receiptData.weight_cbm ? `| ${receiptData.weight_cbm}` : ""}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Verification Table */}
              <div className="mb-4">
                <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Physical Verification &amp; Inward Items ({items.length})</span>
                </div>
                <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <th className="p-1.5 border-r border-slate-300">#</th>
                      <th className="p-1.5 border-r border-slate-300">SKU / Code</th>
                      <th className="p-1.5 border-r border-slate-300">Item Description</th>
                      <th className="p-1.5 border-r border-slate-300 text-center">Size/Col</th>
                      <th className="p-1.5 border-r border-slate-300 text-right">Ordered</th>
                      <th className="p-1.5 border-r border-slate-300 text-right">Recv</th>
                      <th className="p-1.5 border-r border-slate-300 text-right text-rose-600">Dmg</th>
                      <th className="p-1.5 border-r border-slate-300 text-right font-extrabold text-emerald-800">
                        Accepted
                      </th>
                      <th className="p-1.5 border-r border-slate-300 text-right">Billed (₹)</th>
                      <th className="p-1.5 border-r border-slate-300 text-right text-indigo-700">Freight (₹)</th>
                      <th className="p-1.5 text-right font-extrabold text-indigo-900">Landed (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {items.map((item, idx) => {
                      const accepted = Math.max(0, Number(item.quantity_received || 0) - Number(item.quantity_damaged || 0));
                      const billedRate = Number(item.invoice_rate || item.cost_price || 0);
                      const landed = Number(item.landed_cost || billedRate);
                      const freightAlloc = Number(item.freight_allocated || 0);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-1.5 border-r border-slate-300 text-slate-500">{idx + 1}</td>
                          <td className="p-1.5 border-r border-slate-300 font-bold text-slate-900">
                            {item.code || item.sku || "--"}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 font-sans font-medium text-slate-800">
                            {item.name || "Item"}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-center text-slate-600">
                            {item.size || "--"}/{item.color || "--"}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-right text-slate-600">
                            {Number(item.quantity_ordered || 0)}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-right text-slate-900">
                            {Number(item.quantity_received || 0)}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-right text-rose-600">
                            {Number(item.quantity_damaged || 0)}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-right font-bold text-emerald-800">
                            {accepted}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-right">
                            {billedRate.toFixed(2)}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-right text-indigo-700">
                            {freightAlloc > 0 ? freightAlloc.toFixed(2) : "--"}
                          </td>
                          <td className="p-1.5 text-right font-bold text-indigo-900 bg-indigo-50/30">
                            {landed.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 font-mono font-bold border-t border-slate-300 text-[10px]">
                    <tr>
                      <td colSpan={4} className="p-1.5 border-r border-slate-300 text-right font-sans">
                        Total Quantities:
                      </td>
                      <td className="p-1.5 border-r border-slate-300 text-right">{totalOrdered}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right">{totalReceived}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right text-rose-600">{totalDamaged}</td>
                      <td className="p-1.5 border-r border-slate-300 text-right text-emerald-800 font-extrabold">
                        {totalAccepted}
                      </td>
                      <td colSpan={3} className="p-1.5 text-right font-sans text-slate-500 font-normal">
                        Net Units Accepted
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Capitalized Landed Cost Allocation Breakdown */}
              {costComponents.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Inward Landed Cost &amp; Freight Breakdown ({costComponents.length})</span>
                  </div>
                  <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="p-1.5 border-r border-slate-300">#</th>
                        <th className="p-1.5 border-r border-slate-300">Cost Component</th>
                        <th className="p-1.5 border-r border-slate-300">Description</th>
                        <th className="p-1.5 border-r border-slate-300 text-center">Allocation Basis</th>
                        <th className="p-1.5 border-r border-slate-300">Transporter / Doc No</th>
                        <th className="p-1.5 text-right font-extrabold text-slate-900">Capitalized Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {costComponents.map((c, i) => (
                        <tr key={i}>
                          <td className="p-1.5 border-r border-slate-300 text-slate-500">{i + 1}</td>
                          <td className="p-1.5 border-r border-slate-300 font-bold text-slate-900">
                            {c.component_type}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 font-sans text-slate-700">
                            {c.description || "--"}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 text-center text-slate-600">
                            {c.allocation_method || "VALUE"}
                          </td>
                          <td className="p-1.5 border-r border-slate-300 font-sans text-slate-600">
                            {c.transporter_name || "--"} {c.document_no ? `(${c.document_no})` : ""}
                          </td>
                          <td className="p-1.5 text-right font-bold text-slate-900">
                            {Number(c.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-mono font-bold border-t border-slate-300">
                      <tr>
                        <td colSpan={5} className="p-1.5 border-r border-slate-300 text-right font-sans">
                          Total Additional Landed Costs:
                        </td>
                        <td className="p-1.5 text-right text-indigo-700">
                          ₹{totalAddons.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Commercial & Valuation Reconciliation Ribbon */}
              <div className="grid grid-cols-4 gap-3 p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg text-center font-mono mb-4">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-sans block">Purchase Value</span>
                  <span className="font-bold text-xs text-slate-900">
                    ₹{totalMaterialsValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-sans block">Freight &amp; Addons</span>
                  <span className="font-bold text-xs text-indigo-700">
                    ₹{totalAddons.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-sans block">Final Inventory Cost</span>
                  <span className="font-extrabold text-xs text-emerald-800">
                    ₹{totalAcquisitionCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-sans block">Avg. Unit Landed Cost</span>
                  <span className="font-extrabold text-xs text-slate-900">
                    ₹{avgLandedCost.toFixed(2)}
                  </span>
                </div>
              </div>

              {receiptData.notes && (
                <div className="mb-4 p-2 bg-slate-50 border border-slate-200 rounded text-[10px]">
                  <span className="font-bold text-slate-700">Remarks / Inspection Notes: </span>
                  <span className="text-slate-600 font-sans">{receiptData.notes}</span>
                </div>
              )}
            </div>

            {/* Bottom Section: Signatories & Verification Branding */}
            <div>
              <div className="grid grid-cols-3 gap-6 pt-10 pb-4 text-center text-[10px]">
                <div className="border-t border-slate-800 pt-1.5">
                  <div className="font-bold text-slate-900">Store Keeper / Inward Clerk</div>
                  <div className="text-[9px] text-slate-500">Unloading &amp; Count Verified</div>
                </div>
                <div className="border-t border-slate-800 pt-1.5">
                  <div className="font-bold text-slate-900">Quality / Physical Inspector</div>
                  <div className="text-[9px] text-slate-500">Damage &amp; Specifications Checked</div>
                </div>
                <div className="border-t border-slate-800 pt-1.5">
                  <div className="font-bold text-slate-900">Authorized Commercial Signatory</div>
                  <div className="text-[9px] text-slate-500">Landed Cost &amp; WMS Inward Approved</div>
                </div>
              </div>

              {/* SMRITI Universal Statutory Compliance Footer */}
              <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span className="font-bold text-slate-800">SMRITI Retail OS</span>
                  <span>|</span>
                  <span>Statutory Inward Landed Cost Engine v3.33.1</span>
                </div>
                <div>
                  <span>Generated: {new Date().toISOString()} • SMRITIBooks.com Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
