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
import { FileText, Package, ArrowUpRight, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { withCapability } from "../../../types/architecture";

interface VendorProcurementTabProps {
  vendor: VendorDetail;
}

const VendorProcurementTabBase: React.FC<VendorProcurementTabProps> = ({ vendor }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
          <h3 className="text-sm font-bold text-white">Purchase Orders & Goods Inward Register</h3>
          <p className="text-xs text-slate-400">Order lifecycle, delivery status, and GRN receipts for {vendor.legalName}</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading procurement records...</div>
      ) : orders.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-2">
          <Package size={32} className="mx-auto text-slate-600" />
          <div className="text-sm font-semibold text-slate-300">No Purchase Orders Issued Yet</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once a purchase order is generated via the PO Generator tab for this vendor, order metrics and goods receipts will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-bold">
              <tr>
                <th className="p-3">PO Number</th>
                <th className="p-3">Order Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Items</th>
                <th className="p-3 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {orders.map((po, idx) => (
                <tr key={po.id || idx} className="hover:bg-slate-800/30">
                  <td className="p-3 font-bold text-white flex items-center space-x-1.5">
                    <FileText size={13} className="text-indigo-400" />
                    <span>{po.order_no || po.id}</span>
                  </td>
                  <td className="p-3 text-slate-400">{po.created_at ? new Date(po.created_at).toLocaleDateString("en-GB") : "—"}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {po.status || "CONFIRMED"}
                    </span>
                  </td>
                  <td className="p-3 text-right">{po.items?.length || 0}</td>
                  <td className="p-3 text-right font-bold text-emerald-400">
                    ₹{Number(po.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

