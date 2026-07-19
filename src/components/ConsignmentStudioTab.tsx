/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.27.0
 * Created      : 2026-07-19
 * Modified     : 2026-07-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1, recordAuditAction } from "../lib/apiFetch.ts";
import { Product } from "../types.ts";
import { motion, AnimatePresence } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { 
  Building2, ArrowRightLeft, FileSpreadsheet, CreditCard, 
  RotateCcw, Landmark, Users, PackageCheck, Plus, AlertCircle, CheckCircle2 
} from "lucide-react";

interface ConsignmentStudioTabProps {
  currentUser?: any;
  products: Product[];
}

export const ConsignmentStudioTab: React.FC<ConsignmentStudioTabProps> = ({
  currentUser,
  products
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"partners" | "transfers" | "reports" | "settlements" | "returns">("partners");
  const [partners, setPartners] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);

  // Create modals state
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [showAddTransfer, setShowAddTransfer] = useState(false);
  const [showAddReport, setShowAddReport] = useState(false);
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  const [showAddReturn, setShowAddReturn] = useState(false);

  // Form states
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerCode, setNewPartnerCode] = useState("");
  const [newPartnerGst, setNewPartnerGst] = useState("");
  const [newPartnerBilling, setNewPartnerBilling] = useState("");
  const [newPartnerShipping, setNewPartnerShipping] = useState("");

  const [newTransferPartner, setNewTransferPartner] = useState("");
  const [newTransferItems, setNewTransferItems] = useState<{ productId: string; qty: number; rate: number }[]>([]);
  const [transferProdInput, setTransferProdInput] = useState("");
  const [transferQtyInput, setTransferQtyInput] = useState("");
  const [transferRateInput, setTransferRateInput] = useState("");

  const [newReportPartner, setNewReportPartner] = useState("");
  const [newReportItems, setNewReportItems] = useState<{ transferItemId: string; productId: string; qty: number; rate: number }[]>([]);
  const [reportTransItemInput, setReportTransItemInput] = useState("");
  const [reportQtyInput, setReportQtyInput] = useState("");

  const [newSettlementPartner, setNewSettlementPartner] = useState("");
  const [settlementDue, setSettlementDue] = useState("");
  const [settlementDeductions, setSettlementDeductions] = useState("");
  const [settlementDeductionDetails, setSettlementDeductionDetails] = useState("");
  const [settlementPaid, setSettlementPaid] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");

  const [newReturnPartner, setNewReturnPartner] = useState("");
  const [newReturnItems, setNewReturnItems] = useState<{ transferItemId: string; productId: string; qty: number; rate: number }[]>([]);
  const [returnTransItemInput, setReturnTransItemInput] = useState("");
  const [returnQtyInput, setReturnQtyInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const parts = await apiFetchV1("/consignment/partners");
      setPartners(parts || []);

      const trans = await apiFetchV1("/consignment/transfers");
      setTransfers(trans || []);

      const reps = await apiFetchV1("/consignment/sale-reports");
      setReports(reps || []);

      const sets = await apiFetchV1("/consignment/settlements");
      setSettlements(sets || []);

      const rets = await apiFetchV1("/consignment/returns");
      setReturns(rets || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    if (!newPartnerName.trim() || !newPartnerCode.trim()) {
      setErrors(["Partner Name and Code are required."]);
      return;
    }
    try {
      const res = await apiFetchV1("/consignment/partners", {
        method: "POST",
        body: JSON.stringify({
          name: newPartnerName.trim(),
          code: newPartnerCode.trim(),
          gst_number: newPartnerGst.trim() || undefined,
          status: "Active",
          billing_address: newPartnerBilling.trim() || undefined,
          shipping_address: newPartnerShipping.trim() || undefined
        })
      });
      recordAuditAction("CREATE", "consignment_partners", res.id, `Created consignment partner: ${res.name}`);
      setShowAddPartner(false);
      setNewPartnerName("");
      setNewPartnerCode("");
      setNewPartnerGst("");
      setNewPartnerBilling("");
      setNewPartnerShipping("");
      loadAllData();
    } catch (err: any) {
      setErrors([err.message || "Failed to create partner"]);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    if (!newTransferPartner) {
      setErrors(["Please select a partner."]);
      return;
    }
    if (newTransferItems.length === 0) {
      setErrors(["Please add at least one product line."]);
      return;
    }
    try {
      const res = await apiFetchV1("/consignment/transfers", {
        method: "POST",
        body: JSON.stringify({
          partner_id: newTransferPartner,
          notes: "Dispatched from warehouse",
          items: newTransferItems.map(item => {
            const p = products.find(prod => prod.id === item.productId);
            return {
              product_id: item.productId,
              code: p?.code || "",
              name: p?.name || "",
              hsn_code: (p as any)?.hsnCode || "84713010",
              qty_sent: item.qty,
              rate: item.rate,
              gst_rate: (p as any)?.gstPercentage || 18.00
            };
          })
        })
      });
      recordAuditAction("CREATE", "consignment_transfers", res.id, `Created consignment transfer proposal: ${res.transfer_no}`);
      setShowAddTransfer(false);
      setNewTransferPartner("");
      setNewTransferItems([]);
      loadAllData();
    } catch (err: any) {
      setErrors([err.message || "Failed to create transfer"]);
    }
  };

  const handleDispatchTransfer = async (transferId: string) => {
    try {
      const res = await apiFetchV1(`/consignment/transfers/${transferId}/dispatch`, { method: "POST" });
      recordAuditAction("UPDATE", "consignment_transfers", transferId, `Dispatched consignment stock & generated invoice: ${res.transfer_no}`);
      loadAllData();
    } catch (err: any) {
      alert(err.message || "Failed to dispatch consignment stock");
    }
  };

  const handleProcessSaleReport = async (reportId: string) => {
    try {
      const res = await apiFetchV1(`/consignment/sale-reports/${reportId}/process`, { method: "POST" });
      recordAuditAction("UPDATE", "consignment_sale_reports", reportId, `Processed consignment sales report: ${res.report_no}`);
      loadAllData();
    } catch (err: any) {
      alert(err.message || "Failed to process sale report");
    }
  };

  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    if (!newSettlementPartner || !settlementPaid) {
      setErrors(["Partner and Paid Amount are required."]);
      return;
    }
    try {
      const res = await apiFetchV1("/consignment/settlements", {
        method: "POST",
        body: JSON.stringify({
          partner_id: newSettlementPartner,
          total_amount_due: parseFloat(settlementDue) || 0,
          total_deductions: parseFloat(settlementDeductions) || 0,
          net_amount_payable: (parseFloat(settlementDue) || 0) - (parseFloat(settlementDeductions) || 0),
          paid_amount: parseFloat(settlementPaid),
          deduction_details: settlementDeductionDetails.trim() || undefined,
          notes: settlementNotes.trim() || undefined
        })
      });
      recordAuditAction("CREATE", "consignment_settlements", res.id, `Reconciled consignment settlement: ${res.settlement_no}`);
      setShowAddSettlement(false);
      setNewSettlementPartner("");
      setSettlementDue("");
      setSettlementDeductions("");
      setSettlementDeductionDetails("");
      setSettlementPaid("");
      setSettlementNotes("");
      loadAllData();
    } catch (err: any) {
      setErrors([err.message || "Failed to submit settlement"]);
    }
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    if (!newReturnPartner) {
      setErrors(["Partner selection required."]);
      return;
    }
    if (newReturnItems.length === 0) {
      setErrors(["Please specify return items."]);
      return;
    }
    try {
      const res = await apiFetchV1("/consignment/returns", {
        method: "POST",
        body: JSON.stringify({
          partner_id: newReturnPartner,
          notes: "Returned unsold stock back to warehouse",
          items: newReturnItems.map(item => ({
            transfer_item_id: item.transferItemId,
            product_id: item.productId,
            qty_returned: item.qty,
            rate: item.rate
          }))
        })
      });
      recordAuditAction("CREATE", "consignment_returns", res.id, `Processed consignment stock return: ${res.return_no}`);
      setShowAddReturn(false);
      setNewReturnPartner("");
      setNewReturnItems([]);
      loadAllData();
    } catch (err: any) {
      setErrors([err.message || "Failed to process stock return"]);
    }
  };

  const addTransferLine = () => {
    if (!transferProdInput || !transferQtyInput) return;
    const qty = parseFloat(transferQtyInput);
    const rate = parseFloat(transferRateInput) || 0;
    if (qty <= 0) return;
    setNewTransferItems([...newTransferItems, { productId: transferProdInput, qty, rate }]);
    setTransferProdInput("");
    setTransferQtyInput("");
    setTransferRateInput("");
  };

  // Helper to gather all pending transfer items for return/reporting
  const getTransferItemsForPartner = (partnerId: string) => {
    const list: any[] = [];
    transfers
      .filter(t => t.partner_id === partnerId && t.status === "Dispatched")
      .forEach(t => {
        if (t.items) {
          t.items.forEach((item: any) => {
            if (item.qty_on_hand > 0) {
              list.push(item);
            }
          });
        }
      });
    return list;
  };

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
      {/* Tab Header */}
      <div className="border-b border-theme-divider bg-theme-surface-2 px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight">
            Modern Trade / Consignment Studio
          </h2>
          <p className="text-xs text-theme-muted mt-1">
            Track stock transfers, sales reports, payments, and stock returns with chain store networks.
          </p>
        </div>

        {/* Sub-tab selection */}
        <div className="flex bg-theme-surface-3 border border-theme-divider rounded-lg p-0.5 text-[10px] uppercase font-bold tracking-wider">
          <button
            onClick={() => setActiveSubTab("partners")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === "partners" ? "bg-blue-600 text-white" : "text-theme-muted hover:text-theme-body"
            }`}
          >
            <Users size={11} />
            Partners
          </button>
          <button
            onClick={() => setActiveSubTab("transfers")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === "transfers" ? "bg-blue-600 text-white" : "text-theme-muted hover:text-theme-body"
            }`}
          >
            <ArrowRightLeft size={11} />
            Transfers (DISPATCH)
          </button>
          <button
            onClick={() => setActiveSubTab("reports")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === "reports" ? "bg-blue-600 text-white" : "text-theme-muted hover:text-theme-body"
            }`}
          >
            <FileSpreadsheet size={11} />
            Sales Reports
          </button>
          <button
            onClick={() => setActiveSubTab("settlements")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === "settlements" ? "bg-blue-600 text-white" : "text-theme-muted hover:text-theme-body"
            }`}
          >
            <CreditCard size={11} />
            Settlements
          </button>
          <button
            onClick={() => setActiveSubTab("returns")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeSubTab === "returns" ? "bg-blue-600 text-white" : "text-theme-muted hover:text-theme-body"
            }`}
          >
            <RotateCcw size={11} />
            Returns
          </button>
        </div>
      </div>

      {/* Main view scroll area */}
      <SmritiScrollArea className="flex-1 p-6 bg-theme-base">
        {loading && <p className="text-theme-muted italic text-xs">Syncing with Smriti Network...</p>}

        {activeSubTab === "partners" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
                Consignment Partner Profiles
              </h3>
              <button
                onClick={() => setShowAddPartner(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Add Partner
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {partners.map(p => (
                <div key={p.id} className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-theme-body">{p.name}</h4>
                      <span className="text-[10px] font-mono text-blue-400 block mt-0.5">{p.code}</span>
                    </div>
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                      {p.status}
                    </span>
                  </div>
                  {p.gst_number && (
                    <div className="text-[10px] font-mono">
                      <span className="text-theme-muted">GSTIN: </span>{p.gst_number}
                    </div>
                  )}
                  <div className="text-[10px] space-y-1 text-theme-muted font-sans border-t border-theme-divider/50 pt-2">
                    <span className="font-bold uppercase tracking-wider block text-[8px]">Locations</span>
                    <p className="line-clamp-1">Bill: {p.billing_address || "—"}</p>
                    <p className="line-clamp-1">Ship: {p.shipping_address || "—"}</p>
                  </div>
                </div>
              ))}
              {partners.length === 0 && (
                <p className="col-span-3 text-center text-theme-muted italic text-[11px] py-12">
                  No Modern Trade partners registered. Add one to start consignment transfers.
                </p>
              )}
            </div>
          </div>
        )}

        {activeSubTab === "transfers" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
                Consignment Dispatches &amp; Transfers
              </h3>
              <button
                onClick={() => setShowAddTransfer(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> New Dispatch Proposal
              </button>
            </div>

            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                    <th className="px-6 py-4 font-semibold">Document No</th>
                    <th className="px-6 py-4 font-semibold">Partner</th>
                    <th className="px-6 py-4 font-semibold">Transfer Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Grand Total</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                    <th className="px-6 py-4 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-theme-divider">
                  {transfers.map(t => {
                    const partner = partners.find(p => p.id === t.partner_id);
                    return (
                      <tr key={t.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-blue-400">{t.transfer_no}</td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-theme-body">{partner?.name || t.partner_id}</span>
                        </td>
                        <td className="px-6 py-4 font-mono">{t.transfer_date}</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">
                          ₹{parseFloat(t.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            t.status === "Draft" ? "bg-amber-950 text-amber-400 border border-amber-500/20" :
                            t.status === "Dispatched" ? "bg-blue-950 text-blue-400 border border-blue-500/20" :
                            "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {t.status === "Draft" ? (
                            <button
                              onClick={() => handleDispatchTransfer(t.id)}
                              className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1 px-2.5 rounded text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Dispatch Stock
                            </button>
                          ) : (
                            <span className="text-[10px] text-theme-muted font-mono">
                              Invoice: {t.invoice_id ? "Linked" : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {transfers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-theme-muted italic">
                        No consignment dispatches recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === "reports" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
                Consignment Sales Reporting
              </h3>
              <button
                onClick={() => setShowAddReport(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Submit Weekly Report
              </button>
            </div>

            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                    <th className="px-6 py-4 font-semibold">Report No</th>
                    <th className="px-6 py-4 font-semibold">Partner</th>
                    <th className="px-6 py-4 font-semibold">Report Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Reported Sales</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                    <th className="px-6 py-4 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-theme-divider">
                  {reports.map(r => {
                    const partner = partners.find(p => p.id === r.partner_id);
                    return (
                      <tr key={r.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-blue-400">{r.report_no}</td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-theme-body">{partner?.name || r.partner_id}</span>
                        </td>
                        <td className="px-6 py-4 font-mono">{r.report_date}</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">
                          ₹{parseFloat(r.total_sales_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            r.status === "Submitted" ? "bg-amber-950 text-amber-400 border border-amber-500/20" :
                            "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {r.status === "Submitted" ? (
                            <button
                              onClick={() => handleProcessSaleReport(r.id)}
                              className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1 px-2.5 rounded text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Process Report
                            </button>
                          ) : (
                            <span className="text-[10px] text-theme-muted font-mono flex items-center justify-center gap-1 text-emerald-400 font-bold">
                              <CheckCircle2 size={12} /> Sales Recognized
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-theme-muted italic">
                        No sales reports recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === "settlements" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
                Modern Trade Settlements &amp; Ledger Reconciliations
              </h3>
              <button
                onClick={() => setShowAddSettlement(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> New Payment Settlement
              </button>
            </div>

            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                    <th className="px-6 py-4 font-semibold">Settlement No</th>
                    <th className="px-6 py-4 font-semibold">Partner</th>
                    <th className="px-6 py-4 font-semibold">Reconciliation Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Amount Due</th>
                    <th className="px-6 py-4 font-semibold text-right">Deductions</th>
                    <th className="px-6 py-4 font-semibold text-right">Net Paid</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-theme-divider">
                  {settlements.map(s => {
                    const partner = partners.find(p => p.id === s.partner_id);
                    return (
                      <tr key={s.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-blue-400">{s.settlement_no}</td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-theme-body">{partner?.name || s.partner_id}</span>
                        </td>
                        <td className="px-6 py-4 font-mono">{s.settlement_date}</td>
                        <td className="px-6 py-4 text-right font-mono">
                          ₹{parseFloat(s.total_amount_due).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-rose-400">
                          ₹{parseFloat(s.total_deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">
                          ₹{parseFloat(s.paid_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {settlements.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-theme-muted italic">
                        No settlements recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === "returns" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
                Consignment Stock Returns (Warehouse Receipt)
              </h3>
              <button
                onClick={() => setShowAddReturn(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Record Return Delivery
              </button>
            </div>

            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                    <th className="px-6 py-4 font-semibold">Return No</th>
                    <th className="px-6 py-4 font-semibold">Partner</th>
                    <th className="px-6 py-4 font-semibold">Return Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Returned Value</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-theme-divider">
                  {returns.map(r => {
                    const partner = partners.find(p => p.id === r.partner_id);
                    return (
                      <tr key={r.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-blue-400">{r.return_no}</td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-theme-body">{partner?.name || r.partner_id}</span>
                        </td>
                        <td className="px-6 py-4 font-mono">{r.return_date}</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">
                          ₹{parseFloat(r.total_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 font-mono">
                            <CheckCircle2 size={12} /> Stock Restored
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {returns.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-theme-muted italic">
                        No returns recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SmritiScrollArea>

      {/* --- ADD PARTNER MODAL --- */}
      <AnimatePresence>
        {showAddPartner && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-theme-surface-2 border border-theme-divider rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-theme-primary uppercase tracking-wider font-mono border-b border-theme-divider pb-2 flex items-center gap-2">
                <Building2 className="text-blue-400" size={18} />
                Register Modern Trade Partner
              </h3>

              {errors.length > 0 && (
                <div className="bg-rose-950/50 border border-rose-500/30 p-2.5 rounded-lg text-rose-400 text-xs flex gap-2">
                  <AlertCircle size={16} />
                  <span>{errors[0]}</span>
                </div>
              )}

              <form onSubmit={handleCreatePartner} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Partner Name *</label>
                    <input
                      type="text"
                      value={newPartnerName}
                      onChange={e => setNewPartnerName(e.target.value)}
                      placeholder="e.g. Reliance Retail"
                      className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Store Network Code *</label>
                    <input
                      type="text"
                      value={newPartnerCode}
                      onChange={e => setNewPartnerCode(e.target.value)}
                      placeholder="e.g. RR-01"
                      className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">GSTIN Registration</label>
                  <input
                    type="text"
                    value={newPartnerGst}
                    onChange={e => setNewPartnerGst(e.target.value)}
                    placeholder="15-character GST ID"
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Billing Address</label>
                  <textarea
                    value={newPartnerBilling}
                    onChange={e => setNewPartnerBilling(e.target.value)}
                    rows={2}
                    placeholder="Head office billing location details..."
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Shipping Address</label>
                  <textarea
                    value={newPartnerShipping}
                    onChange={e => setNewPartnerShipping(e.target.value)}
                    rows={2}
                    placeholder="Chain store delivery point address details..."
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-theme-divider/50 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddPartner(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-theme-body font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Save Partner
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ADD TRANSFER MODAL --- */}
      <AnimatePresence>
        {showAddTransfer && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-theme-surface-2 border border-theme-divider rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-theme-primary uppercase tracking-wider font-mono border-b border-theme-divider pb-2 flex items-center gap-2">
                <ArrowRightLeft className="text-blue-400" size={18} />
                Create Stock Dispatch Proposal (Consignment)
              </h3>

              {errors.length > 0 && (
                <div className="bg-rose-950/50 border border-rose-500/30 p-2.5 rounded-lg text-rose-400 text-xs flex gap-2">
                  <AlertCircle size={16} />
                  <span>{errors[0]}</span>
                </div>
              )}

              <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Select Consignment Partner *</label>
                  <select
                    value={newTransferPartner}
                    onChange={e => setNewTransferPartner(e.target.value)}
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none"
                  >
                    <option value="">-- Select Chain Network Partner --</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>

                {/* Add Line Item sub-container */}
                <div className="bg-theme-surface-3 border border-theme-divider rounded-xl p-3 space-y-3">
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block">Add Product Line</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[8px] text-theme-muted font-bold">Product</label>
                      <select
                        value={transferProdInput}
                        onChange={e => {
                          setTransferProdInput(e.target.value);
                          const p = products.find(prod => prod.id === e.target.value);
                          if (p) setTransferRateInput(p.price.toString());
                        }}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-1.5 text-theme-body focus:outline-none"
                      >
                        <option value="">-- Select Product --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (Qty: {p.stock})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] text-theme-muted font-bold">Quantity</label>
                      <input
                        type="number"
                        value={transferQtyInput}
                        onChange={e => setTransferQtyInput(e.target.value)}
                        placeholder="Qty"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-1.5 text-theme-body focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] text-theme-muted font-bold">Consignment Rate</label>
                      <input
                        type="number"
                        value={transferRateInput}
                        onChange={e => setTransferRateInput(e.target.value)}
                        placeholder="Rate"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-1.5 text-theme-body focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={addTransferLine}
                      className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1.5 px-3 rounded-lg text-[9px] uppercase tracking-wider cursor-pointer"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* Added Items table */}
                {newTransferItems.length > 0 && (
                  <div className="border border-theme-divider rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-theme-surface-3 text-[8px] uppercase tracking-wider text-theme-muted">
                        <tr>
                          <th className="p-2">Product Name</th>
                          <th className="p-2 text-right">Quantity</th>
                          <th className="p-2 text-right">Consignment Rate</th>
                          <th className="p-2 text-right">Taxable Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newTransferItems.map((item, idx) => {
                          const p = products.find(prod => prod.id === item.productId);
                          const total = item.qty * item.rate;
                          return (
                            <tr key={idx} className="border-t border-theme-divider/50">
                              <td className="p-2 font-bold">{p?.name}</td>
                              <td className="p-2 text-right font-mono">{item.qty}</td>
                              <td className="p-2 text-right font-mono">₹{item.rate}</td>
                              <td className="p-2 text-right font-mono text-emerald-400 font-semibold">₹{total.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-theme-divider/50 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddTransfer(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-theme-body font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Create proposal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ADD SALES REPORT MODAL --- */}
      <AnimatePresence>
        {showAddReport && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-theme-surface-2 border border-theme-divider rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-theme-primary uppercase tracking-wider font-mono border-b border-theme-divider pb-2 flex items-center gap-2">
                <FileSpreadsheet className="text-blue-400" size={18} />
                Submit Modern Trade Sales Report
              </h3>

              {errors.length > 0 && (
                <div className="bg-rose-950/50 border border-rose-500/30 p-2.5 rounded-lg text-rose-400 text-xs flex gap-2">
                  <AlertCircle size={16} />
                  <span>{errors[0]}</span>
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErrors([]);
                  if (!newReportPartner) return;
                  if (newReportItems.length === 0) {
                    setErrors(["Please specify sold lines."]);
                    return;
                  }
                  try {
                    const res = await apiFetchV1("/consignment/sale-reports", {
                      method: "POST",
                      body: JSON.stringify({
                        partner_id: newReportPartner,
                        notes: "Report parsed & generated from client sales log",
                        items: newReportItems
                      })
                    });
                    recordAuditAction("CREATE", "consignment_sale_reports", res.id, `Submitted weekly consignment sales report: ${res.report_no}`);
                    setShowAddReport(false);
                    setNewReportPartner("");
                    setNewReportItems([]);
                    loadAllData();
                  } catch (err: any) {
                    setErrors([err.message || "Failed to submit report"]);
                  }
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Partner Network *</label>
                  <select
                    value={newReportPartner}
                    onChange={e => {
                      setNewReportPartner(e.target.value);
                      setNewReportItems([]);
                    }}
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none"
                  >
                    <option value="">-- Select Partner --</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {newReportPartner && (
                  <div className="bg-theme-surface-3 border border-theme-divider rounded-xl p-3 space-y-3">
                    <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block">Add Sold Line</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-theme-muted font-bold">Transfer Item</label>
                        <select
                          value={reportTransItemInput}
                          onChange={e => setReportTransItemInput(e.target.value)}
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-1.5 text-theme-body focus:outline-none"
                        >
                          <option value="">-- Select Line --</option>
                          {getTransferItemsForPartner(newReportPartner).map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} (Dispatched: {item.qty_sent}, Remaining: {item.qty_on_hand})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] text-theme-muted font-bold">Quantity Sold *</label>
                        <input
                          type="number"
                          value={reportQtyInput}
                          onChange={e => setReportQtyInput(e.target.value)}
                          placeholder="Qty"
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-1.5 text-theme-body focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (!reportTransItemInput || !reportQtyInput) return;
                          const qty = parseFloat(reportQtyInput);
                          if (qty <= 0) return;
                          const tItem = getTransferItemsForPartner(newReportPartner).find(i => i.id === reportTransItemInput);
                          if (!tItem) return;
                          setNewReportItems([...newReportItems, {
                            transferItemId: reportTransItemInput,
                            productId: tItem.product_id,
                            qty,
                            rate: tItem.rate
                          }]);
                          setReportTransItemInput("");
                          setReportQtyInput("");
                        }}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1.5 px-3 rounded-lg text-[9px] uppercase tracking-wider cursor-pointer"
                      >
                        + Add Reported Line
                      </button>
                    </div>
                  </div>
                )}

                {newReportItems.length > 0 && (
                  <div className="border border-theme-divider rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-theme-surface-3 text-[8px] uppercase tracking-wider text-theme-muted">
                        <tr>
                          <th className="p-2">Item</th>
                          <th className="p-2 text-right">Quantity Sold</th>
                          <th className="p-2 text-right">Rate</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newReportItems.map((item, idx) => {
                          const tItem = getTransferItemsForPartner(newReportPartner).find(i => i.id === item.transferItemId);
                          return (
                            <tr key={idx} className="border-t border-theme-divider/50">
                              <td className="p-2 font-bold">{tItem?.name || item.productId}</td>
                              <td className="p-2 text-right font-mono">{item.qty}</td>
                              <td className="p-2 text-right font-mono">₹{item.rate}</td>
                              <td className="p-2 text-right font-mono text-emerald-400 font-semibold">₹{(item.qty * item.rate).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-theme-divider/50 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddReport(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-theme-body font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ADD SETTLEMENT MODAL --- */}
      <AnimatePresence>
        {showAddSettlement && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-theme-surface-2 border border-theme-divider rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-theme-primary uppercase tracking-wider font-mono border-b border-theme-divider pb-2 flex items-center gap-2">
                <CreditCard className="text-blue-400" size={18} />
                Reconcile Consignment Payment Settlement
              </h3>

              {errors.length > 0 && (
                <div className="bg-rose-950/50 border border-rose-500/30 p-2.5 rounded-lg text-rose-400 text-xs flex gap-2">
                  <AlertCircle size={16} />
                  <span>{errors[0]}</span>
                </div>
              )}

              <form onSubmit={handleCreateSettlement} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Partner Network *</label>
                  <select
                    value={newSettlementPartner}
                    onChange={e => setNewSettlementPartner(e.target.value)}
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none"
                  >
                    <option value="">-- Select Partner --</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Total Sales Due *</label>
                    <input
                      type="number"
                      value={settlementDue}
                      onChange={e => setSettlementDue(e.target.value)}
                      placeholder="e.g. 150000"
                      className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Listing/Marketing Deductions</label>
                    <input
                      type="number"
                      value={settlementDeductions}
                      onChange={e => setSettlementDeductions(e.target.value)}
                      placeholder="e.g. 20000"
                      className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Deduction Details (Audit Narration)</label>
                  <input
                    type="text"
                    value={settlementDeductionDetails}
                    onChange={e => setSettlementDeductionDetails(e.target.value)}
                    placeholder="e.g. 10% listing slotting fees + damage claims"
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Net Paid Amount *</label>
                  <input
                    type="number"
                    value={settlementPaid}
                    onChange={e => setSettlementPaid(e.target.value)}
                    placeholder="Amount deposited to bank"
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none font-mono focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-theme-divider/50 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddSettlement(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-theme-body font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Commit Settlement
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ADD RETURN MODAL --- */}
      <AnimatePresence>
        {showAddReturn && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-theme-surface-2 border border-theme-divider rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-theme-primary uppercase tracking-wider font-mono border-b border-theme-divider pb-2 flex items-center gap-2">
                <RotateCcw className="text-blue-400" size={18} />
                Record Unsold Consignment Stock Return
              </h3>

              {errors.length > 0 && (
                <div className="bg-rose-950/50 border border-rose-500/30 p-2.5 rounded-lg text-rose-400 text-xs flex gap-2">
                  <AlertCircle size={16} />
                  <span>{errors[0]}</span>
                </div>
              )}

              <form onSubmit={handleCreateReturn} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-1">Partner Network *</label>
                  <select
                    value={newReturnPartner}
                    onChange={e => {
                      setNewReturnPartner(e.target.value);
                      setNewReturnItems([]);
                    }}
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none"
                  >
                    <option value="">-- Select Partner --</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {newReturnPartner && (
                  <div className="bg-theme-surface-3 border border-theme-divider rounded-xl p-3 space-y-3">
                    <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block">Add Return Item Line</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-theme-muted font-bold">Transfer Item</label>
                        <select
                          value={returnTransItemInput}
                          onChange={e => setReturnTransItemInput(e.target.value)}
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-1.5 text-theme-body focus:outline-none"
                        >
                          <option value="">-- Select Line --</option>
                          {getTransferItemsForPartner(newReturnPartner).map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} (Dispatched: {item.qty_sent}, On Hand: {item.qty_on_hand})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] text-theme-muted font-bold">Quantity Returned *</label>
                        <input
                          type="number"
                          value={returnQtyInput}
                          onChange={e => setReturnQtyInput(e.target.value)}
                          placeholder="Qty"
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-1.5 text-theme-body focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (!returnTransItemInput || !returnQtyInput) return;
                          const qty = parseFloat(returnQtyInput);
                          if (qty <= 0) return;
                          const tItem = getTransferItemsForPartner(newReturnPartner).find(i => i.id === returnTransItemInput);
                          if (!tItem) return;
                          setNewReturnItems([...newReturnItems, {
                            transferItemId: returnTransItemInput,
                            productId: tItem.product_id,
                            qty,
                            rate: tItem.rate
                          }]);
                          setReturnTransItemInput("");
                          setReturnQtyInput("");
                        }}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1.5 px-3 rounded-lg text-[9px] uppercase tracking-wider cursor-pointer"
                      >
                        + Add Returned Line
                      </button>
                    </div>
                  </div>
                )}

                {newReturnItems.length > 0 && (
                  <div className="border border-theme-divider rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-theme-surface-3 text-[8px] uppercase tracking-wider text-theme-muted">
                        <tr>
                          <th className="p-2">Item</th>
                          <th className="p-2 text-right">Quantity Returned</th>
                          <th className="p-2 text-right">Rate</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newReturnItems.map((item, idx) => {
                          const tItem = getTransferItemsForPartner(newReturnPartner).find(i => i.id === item.transferItemId);
                          return (
                            <tr key={idx} className="border-t border-theme-divider/50">
                              <td className="p-2 font-bold">{tItem?.name || item.productId}</td>
                              <td className="p-2 text-right font-mono">{item.qty}</td>
                              <td className="p-2 text-right font-mono">₹{item.rate}</td>
                              <td className="p-2 text-right font-mono text-rose-400 font-semibold">₹{(item.qty * item.rate).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-theme-divider/50 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddReturn(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-theme-body font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Process Return
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
