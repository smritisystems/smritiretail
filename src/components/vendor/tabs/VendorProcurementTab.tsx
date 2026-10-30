/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { AlertCircle, FileText, Package, Printer, RefreshCw } from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { withCapability } from "../../../types/architecture";
import { POPrintPreviewModal } from "../../purchase/POPrintPreviewModal";
import type { PurchaseOrderHeader, PurchaseOrderLineItem, PurchaseOrderSizePivotRow } from "../../purchase/types";
import { fetchVendorPurchaseOrders } from "./vendorPurchaseOrders";

/**
 * Robust footwear SKU and barcode attribute parser.
 * Extracts Article/Style, Color/Shade, Size, and Brand from barcode pattern {style}-{color}-{size}
 * or direct item properties.
 */
export function parseFootwearSku(item: any): {
  style: string;
  color: string;
  size: string;
  brand: string;
} {
  const code = String(item.code || item.barcode || item.stockNo || "").trim();
  let style = String(item.style || item.style_code || "").trim();
  let color = String(item.color || item.shade || item.colourBase || "").trim();
  let size = String(item.size || "").trim();
  const brand = String(item.brand || "Tattly Threads").trim();

  // If any attribute is missing, extract from standard footwear barcode structure {style}-{color}-{size}
  if ((!style || !color || !size) && code.includes("-")) {
    const parts = code.split("-");
    if (parts.length >= 3) {
      const candidateSize = parts[parts.length - 1];
      const candidateColor = parts[parts.length - 2];
      const candidateStyle = parts.slice(0, parts.length - 2).join("-");

      if (!size && candidateSize) size = candidateSize;
      if (!color && candidateColor) color = candidateColor;
      if (!style && candidateStyle) style = candidateStyle;
    }
  }

  if (!style) style = code || item.name || "Footwear Article";
  if (!color) color = "Standard";

  return { style, color, size, brand };
}

interface VendorProcurementTabProps {
  vendor: VendorDetail;
}

const VendorProcurementTabBase: React.FC<VendorProcurementTabProps> = ({ vendor }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lookupWarning, setLookupWarning] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [reprintOrder, setReprintOrder] = useState<any | null>(null);
  const [reprintLoadingId, setReprintLoadingId] = useState<string | null>(null);

  const openReprint = async (order: any) => {
    setReprintLoadingId(order.id);
    try {
      const fullOrder = await apiFetchV1(`/purchase/orders/${encodeURIComponent(order.id)}`);
      setReprintOrder({ ...order, ...fullOrder });
    } catch {
      setReprintOrder(order);
    } finally {
      setReprintLoadingId(null);
    }
  };

  const buildHeader = (order: any): PurchaseOrderHeader => {
    const orderNo = String(order.order_no || order.id || "PO");
    const separator = orderNo.lastIndexOf("-");
    const rawOrderDate =
      (order.order_date ? String(order.order_date).slice(0, 10) : "") ||
      (order.notes?.match(/dated ([0-9-]+)/)?.[1]) ||
      (order.delivery_date ? String(order.delivery_date).slice(0, 10) : "") ||
      (order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : "");

    return {
      documentType: "Purchase Order",
      prefix: separator > 0 ? orderNo.slice(0, separator) : "PO",
      orderNumber: separator > 0 ? orderNo.slice(separator + 1) : orderNo,
      orderDate: rawOrderDate,
      supplierId: vendor.code || vendor.id,
      supplierName: vendor.legalName || vendor.tradeName || "Selected Supplier",
      billTo: "",
      deliveryDate: order.delivery_date || "",
      leadTimeDays: 0,
      deliveryLocation: order.delivery_location || "Main Store (MAIN)",
      commonTaxPercent: Number(order.items?.[0]?.gst_rate !== undefined ? order.items[0].gst_rate : 5),
      paymentTerms: order.commercial_terms?.payment_terms || order.payment_terms || "120 Days",
      freightCharges: order.commercial_terms?.freight_terms || order.freight_charges || "Paid by Supplier",
      specialInstructions: order.notes || "",
      supplierReference: order.supplier_reference || order.vendor_bill_no || "",
      buyer: order.created_by || "admin",
      department: "Footwear Sourcing & Procurement",
      status: order.status || "CONFIRMED",
      documentStatus: order.status || "CONFIRMED",
    };
  };

  const buildLines = (order: any): PurchaseOrderLineItem[] =>
    (order.items || []).map((item: any, index: number) => {
      const quantity = Number(item.quantity || 0);
      const rate = Number(item.cost_price || 0);
      const taxPercent = Number(item.gst_rate !== undefined ? item.gst_rate : 5);
      const value = Number(item.line_total || quantity * rate);
      const { style, color, size, brand } = parseFootwearSku(item);

      return {
        id: String(item.id || `${order.id}-line-${index}`),
        sNo: index + 1,
        stockNo: item.code || item.product_id || "",
        barcode: item.code || "",
        product: item.name || item.code || "Item",
        brand,
        style,
        shade: color,
        size,
        fibre: "",
        colourBase: color,
        styling: "",
        rate,
        orderQty: quantity,
        unit: item.unit || "Pair",
        value,
        stockOnHand: Number(item.stock_on_hand || 0),
        taxPercent,
        taxAmount: Number(item.tax_amount || (value * taxPercent) / 100),
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: value + Number(item.tax_amount || (value * taxPercent) / 100),
        heelType: item.heel_type,
        upperMaterial: item.upper_material,
        outsoleMaterial: item.outsole_material,
        imageUrl: item.image_url,
      };
    });

  const buildPivotRows = (lines: PurchaseOrderLineItem[]): PurchaseOrderSizePivotRow[] => {
    const pivotMap = new Map<string, PurchaseOrderSizePivotRow>();
    lines.forEach((l) => {
      const art = l.style || l.stockNo || l.product || "Footwear Article";
      const col = l.shade || "Standard";
      const key = `${art.toUpperCase()}:::${col.toUpperCase()}`;
      const qty = Number(l.orderQty) || 0;
      const rate = Number(l.rate) || 0;
      const sz = l.size ? l.size.trim() : "Standard";
      const taxRate = l.taxPercent !== undefined ? l.taxPercent : 5;
      const lineTaxable = l.value !== undefined ? l.value : qty * rate;
      const lineTax = l.taxAmount !== undefined ? l.taxAmount : (lineTaxable * taxRate) / 100;

      if (!pivotMap.has(key)) {
        pivotMap.set(key, {
          id: `${key}-pivot`,
          sNo: pivotMap.size + 1,
          articleNo: art,
          product: l.product || art,
          brand: l.brand || "Tattly Threads",
          style: art,
          color: col,
          sizeQuantities: { [sz]: qty },
          totalQty: qty,
          gstPercent: taxRate,
          rate: rate,
          totalValue: lineTaxable,
          taxAmount: lineTax,
        });
      } else {
        const existing = pivotMap.get(key)!;
        existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + qty;
        existing.totalQty += qty;
        existing.totalValue += lineTaxable;
        existing.taxAmount = (existing.taxAmount || 0) + lineTax;
      }
    });
    return Array.from(pivotMap.values());
  };

  useEffect(() => {
    let cancelled = false;
    const fetchPOs = async () => {
      setLoading(true);
      setLoadError("");
      setLookupWarning("");
      try {
        const result = await fetchVendorPurchaseOrders(vendor, (supplierId) =>
          apiFetchV1(`/purchase/orders/?supplier_id=${encodeURIComponent(supplierId)}`),
        );
        if (cancelled) return;
        setOrders(result.orders);
        if (result.failedIdentifiers.length === result.identifierCount) {
          setLoadError("Purchase orders could not be loaded. Check your connection and try again.");
        } else if (result.failedIdentifiers.length > 0) {
          setLookupWarning("Some vendor ID lookups failed. The list may not include every purchase order.");
        }
      } catch {
        if (cancelled) return;
        setOrders([]);
        setLoadError("Purchase orders could not be loaded. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchPOs();
    return () => {
      cancelled = true;
    };
  }, [vendor.id, vendor.code, vendor.legacySupplierId, reloadKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Purchase Orders & Goods Inward Register</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Order lifecycle, delivery status, and GRN receipts for {vendor.legalName}</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">Loading procurement records...</div>
      ) : loadError ? (
        <div role="alert" className="p-6 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center space-y-3">
          <AlertCircle size={24} className="mx-auto text-amber-600 dark:text-amber-400" />
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">{loadError}</div>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <>
          {lookupWarning ? (
            <div role="alert" className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center justify-between gap-3">
                <span>{lookupWarning}</span>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="font-bold underline">Retry</button>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-white dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
              <Package size={32} className="mx-auto text-slate-400 dark:text-slate-600" />
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Purchase Orders Issued Yet</div>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                No purchase orders were found for this vendor across its known supplier IDs.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
        {lookupWarning && (
          <div role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {lookupWarning}
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-bold">
              <tr>
                <th className="p-3">PO Number</th>
                <th className="p-3">Order Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Items</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {orders.map((po, idx) => (
                <tr key={po.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <FileText size={13} className="text-indigo-600 dark:text-indigo-400" />
                    <span>{po.order_no || po.id}</span>
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">
                    {po.order_date
                      ? (typeof po.order_date === "string" && po.order_date.includes("-")
                          ? po.order_date.split("T")[0].split("-").reverse().join("/")
                          : new Date(po.order_date).toLocaleDateString("en-GB"))
                      : (po.created_at ? new Date(po.created_at).toLocaleDateString("en-GB") : "—")}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                      {po.status || "CONFIRMED"}
                    </span>
                  </td>
                  <td className="p-3 text-right text-slate-600 dark:text-slate-300">{po.items?.length || 0}</td>
                  <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{Number(po.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => openReprint(po)}
                      disabled={reprintLoadingId === po.id}
                      title="Reprint purchase order"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-[11px] font-bold disabled:opacity-50"
                    >
                      <Printer size={13} />
                      <span>{reprintLoadingId === po.id ? "Loading..." : "Reprint PO"}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {reprintOrder && (() => {
        const lines = buildLines(reprintOrder);
        const pivotRows = buildPivotRows(lines);
        return (
          <POPrintPreviewModal
            isOpen={true}
            onClose={() => setReprintOrder(null)}
            header={buildHeader(reprintOrder)}
            lineItems={lines}
            sizePivotRows={pivotRows}
            activeTab="pivot"
            vendor={{
              id: vendor.id,
              name: vendor.legalName,
              code: vendor.code,
              address: vendor.addresses?.[0]?.addressLine1,
              gstin: vendor.gstin,
              phone: vendor.contacts?.[0]?.phone,
              state: vendor.state,
            }}
            reprintMode
          />
        );
      })()}
    </div>
  );
};

export const VendorProcurementTab = withCapability(VendorProcurementTabBase, {
  entity: "vendor",
  capability: "vendor.procurement",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorProcurementTab;
