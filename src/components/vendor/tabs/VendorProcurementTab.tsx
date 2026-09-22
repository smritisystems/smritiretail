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
import { FileText, Package, Printer } from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { withCapability } from "../../../types/architecture";
import { POPrintPreviewModal } from "../../purchase/POPrintPreviewModal";
import type { PurchaseOrderHeader, PurchaseOrderLineItem } from "../../purchase/types";

interface VendorProcurementTabProps {
  vendor: VendorDetail;
}

const VendorProcurementTabBase: React.FC<VendorProcurementTabProps> = ({ vendor }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
    return {
      documentType: "Purchase Order",
      prefix: separator > 0 ? orderNo.slice(0, separator) : "PO",
      orderNumber: separator > 0 ? orderNo.slice(separator + 1) : orderNo,
      orderDate: order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : "",
      supplierId: vendor.id,
      supplierName: vendor.legalName,
      billTo: "",
      deliveryDate: order.delivery_date || "",
      leadTimeDays: 0,
      deliveryLocation: order.delivery_location || "Main Store (MAIN)",
      commonTaxPercent: Number(order.items?.[0]?.gst_rate || 0),
      paymentTerms: order.payment_terms || "30 Days",
      freightCharges: order.freight_charges || "",
      specialInstructions: order.notes || "",
      supplierReference: order.supplier_reference || "",
      buyer: order.created_by || "",
      department: "General Purchase",
    };
  };

  const buildLines = (order: any): PurchaseOrderLineItem[] =>
    (order.items || []).map((item: any, index: number) => {
      const quantity = Number(item.quantity || 0);
      const rate = Number(item.cost_price || 0);
      const taxPercent = Number(item.gst_rate || 0);
      const value = Number(item.line_total || quantity * rate);
      return {
        id: String(item.id || `${order.id}-line-${index}`),
        sNo: index + 1,
        stockNo: item.code || item.product_id || "",
        barcode: item.code || "",
        product: item.name || item.code || "Item",
        brand: "",
        style: "",
        shade: "",
        size: "",
        fibre: "",
        colourBase: "",
        styling: "",
        rate,
        orderQty: quantity,
        unit: "EA",
        value,
        stockOnHand: 0,
        taxPercent,
        taxAmount: Number(item.tax_amount || value * taxPercent / 100),
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: value + Number(item.tax_amount || value * taxPercent / 100),
      };
    });

  useEffect(() => {
    // Attempt fetch of POs filtered by supplier ID
    const fetchPOs = async () => {
      setLoading(true);
      try {
        const res = await apiFetchV1("/purchase/orders");
        const list = Array.isArray(res) ? res : res?.items || [];
        // Match either universal party id or code
        const filtered = list.filter((po: any) => 
          po.supplier_id === vendor.id || 
          po.party_id === vendor.id || 
          po.supplier_id === `sup-${vendor.code.toLowerCase()}`
        );
        setOrders(filtered);
      } catch (err) {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPOs();
  }, [vendor.id, vendor.code]);

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
      ) : orders.length === 0 ? (
        <div className="p-8 rounded-xl bg-white dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
          <Package size={32} className="mx-auto text-slate-400 dark:text-slate-600" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Purchase Orders Issued Yet</div>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
            Once a purchase order is generated via the PO Generator tab for this vendor, order metrics and goods receipts will appear here.
          </p>
        </div>
      ) : (
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
                  <td className="p-3 text-slate-500 dark:text-slate-400">{po.created_at ? new Date(po.created_at).toLocaleDateString("en-GB") : "—"}</td>
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
      )}

      {reprintOrder && (
        <POPrintPreviewModal
          isOpen={true}
          onClose={() => setReprintOrder(null)}
          header={buildHeader(reprintOrder)}
          lineItems={buildLines(reprintOrder)}
          sizePivotRows={[]}
          activeTab="generation"
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
      )}
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

