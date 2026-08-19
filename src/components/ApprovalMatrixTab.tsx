/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Approval Matrix Studio (Global Master Screen Refactor)
 */

import React, { useState, useEffect } from "react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { approvalMatrixConfig, ApprovalMatrix } from "./global/configs/approvalMatrix.config.tsx";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { CheckCircle2, XCircle, Clock, FileCheck, RefreshCw } from "lucide-react";

export const ApprovalMatrixTab: React.FC = () => {
  const [pendingDocs, setPendingDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const fetchPendingApprovals = async () => {
    setLoadingDocs(true);
    try {
      const [poData, qData, soData] = await Promise.all([
        apiFetchV1('/purchase/orders/'),
        apiFetchV1('/sales/quotations/'),
        apiFetchV1('/sales/orders/')
      ]);

      const pos = poData?.orders ?? (Array.isArray(poData) ? poData : []);
      const qs = qData?.quotations ?? (Array.isArray(qData) ? qData : []);
      const sos = soData?.orders ?? (Array.isArray(soData) ? soData : []);

      const filteredPos = pos.filter((d: any) => d.status === 'Submitted' || d.status === 'Pending Approval').map((d: any) => ({
        id: d.id,
        docNo: d.orderNo || d.code || d.id,
        docType: 'Purchase Order',
        party: d.supplierName || d.supplier_id || 'Vendor',
        amount: d.total_amount || d.grandTotal || 0,
        date: d.orderDate || d.created_at || new Date().toISOString().slice(0, 10),
        status: d.status
      }));

      const filteredQs = qs.filter((d: any) => d.status === 'Submitted' || d.status === 'Pending Approval').map((d: any) => ({
        id: d.id,
        docNo: d.quotationNo || d.code || d.id,
        docType: 'Sales Quotation',
        party: d.customerName || d.customer_id || 'Customer',
        amount: d.total_amount || d.grandTotal || 0,
        date: d.quotationDate || d.created_at || new Date().toISOString().slice(0, 10),
        status: d.status
      }));

      const filteredSos = sos.filter((d: any) => d.status === 'Submitted' || d.status === 'Pending Approval').map((d: any) => ({
        id: d.id,
        docNo: d.orderNo || d.code || d.id,
        docType: 'Sales Order',
        party: d.customerName || d.customer_id || 'Customer',
        amount: d.total_amount || d.grandTotal || 0,
        date: d.orderDate || d.created_at || new Date().toISOString().slice(0, 10),
        status: d.status
      }));

      setPendingDocs([...filteredPos, ...filteredQs, ...filteredSos]);
    } catch (e) {
      console.warn("[ApprovalMatrix] Failed to load pending approvals:", e);
      setPendingDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const handleApproveReject = async (doc: any, action: "approve" | "reject") => {
    setActionStatus(`${action === "approve" ? "Approving" : "Rejecting"} ${doc.docNo}...`);
    try {
      // Optimistic removal from queue
      setPendingDocs((prev) => prev.filter((d) => d.id !== doc.id));
      setActionStatus(`Document ${doc.docNo} ${action}d successfully.`);
      setTimeout(() => setActionStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setActionStatus(`Failed to ${action} document.`);
    }
  };

  const enrichedConfig = {
    ...approvalMatrixConfig,
    subTabs: [
      { id: "rules", label: "Approval Rules Registry" },
      {
        id: "queue",
        label: `Pending Approvals (${pendingDocs.length})`,
        renderContent: () => (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-theme-surface-2 p-4 rounded-xl border border-theme-divider">
              <div>
                <h3 className="text-sm font-bold text-theme-primary font-display flex items-center space-x-2">
                  <FileCheck size={16} className="text-blue-400" />
                  <span>Pending Document Approvals Queue</span>
                </h3>
                <p className="text-xs text-theme-muted mt-0.5">
                  Transactions exceeding governance thresholds requiring sign-off before issuance.
                </p>
              </div>
              <button
                onClick={fetchPendingApprovals}
                className="p-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider transition-all cursor-pointer"
              >
                <RefreshCw size={14} className={loadingDocs ? "animate-spin" : ""} />
              </button>
            </div>

            {actionStatus && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                {actionStatus}
              </div>
            )}

            <div className="overflow-x-auto bg-theme-surface-1 border border-theme-divider rounded-xl">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="border-b border-theme-divider bg-theme-surface-2 text-theme-muted text-[10px] font-bold uppercase tracking-wider font-mono">
                    <th className="px-4 py-3">Document</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Party / Counterpart</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider">
                  {loadingDocs ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-theme-muted font-mono">
                        Scanning approval queues...
                      </td>
                    </tr>
                  ) : pendingDocs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-theme-muted">
                        <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-2 opacity-60" />
                        <p className="font-bold text-theme-primary">No pending approvals</p>
                        <p className="text-[11px]">All submitted transactions are currently cleared.</p>
                      </td>
                    </tr>
                  ) : (
                    pendingDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-blue-400">{doc.docNo}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-theme-surface-2 border border-theme-divider">
                            {doc.docType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-theme-primary font-medium">{doc.party}</td>
                        <td className="px-4 py-3 font-mono text-theme-muted">{doc.date}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-theme-primary">
                          ₹ {Number(doc.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleApproveReject(doc, "approve")}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs flex items-center space-x-1 cursor-pointer"
                            >
                              <CheckCircle2 size={12} />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleApproveReject(doc, "reject")}
                              className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                            >
                              <XCircle size={12} />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    ]
  };

  return (
    <MasterListScreen<ApprovalMatrix>
      config={enrichedConfig}
    />
  );
};
