/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Version      : 3.119.2
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.119.2 (2026-10-04):
 *   - Replaced giftVoucherEngine mock with live apiFetchV1 calls:
 *     GET /gift-cards-engine/gift-vouchers, POST /gift-cards-engine/gift-vouchers,
 *     POST /gift-cards-engine/gift-vouchers/{id}/redeem,
 *     POST /gift-cards-engine/gift-vouchers/{id}/cancel.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface GiftVoucher {
  id: string;
  voucher_no: string;
  voucher_type: string;
  status: string;
  face_value: number;
  pct_discount?: number;
  min_order_value?: number;
  issued_to?: string;
  valid_from?: string;
  valid_to?: string;
  used_at?: string;
}

interface GiftVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:    "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  USED:      "text-violet-300 bg-violet-500/15 border-violet-500/25",
  EXPIRED:   "text-slate-400  bg-slate-800/30  border-slate-700/30",
  CANCELLED: "text-rose-300   bg-rose-500/15   border-rose-500/25",
};
const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN")}`;

export const GiftVoucherModal: React.FC<GiftVoucherModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [vouchers, setVouchers]     = useState<GiftVoucher[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<"LIST" | "ISSUE">("LIST");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [issueForm, setIssueForm]   = useState({ voucher_type: "FIXED", face_value: "250", pct_discount: "", min_order_value: "", issued_to: "", valid_to: "" });
  const [redeemVoucherId, setRedeemVoucherId] = useState("");
  const [redeemInvoiceNo, setRedeemInvoiceNo] = useState("");
  const [redeemOrderValue, setRedeemOrderValue] = useState("0");

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const qs = filterStatus !== "ALL" ? `?status=${filterStatus}` : "";
      const data = await apiFetchV1<GiftVoucher[]>(`/gift-cards-engine/gift-vouchers${qs}`);
      setVouchers(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load vouchers."); }
    finally { setLoading(false); }
  }, [isOpen, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleIssue = async () => {
    setSubmitting(true);
    try {
      const v = await apiFetchV1<GiftVoucher>("/gift-cards-engine/gift-vouchers", {
        method: "POST",
        body: JSON.stringify({
          voucher_type: issueForm.voucher_type,
          face_value: parseFloat(issueForm.face_value) || 0,
          pct_discount: issueForm.pct_discount ? parseFloat(issueForm.pct_discount) : undefined,
          min_order_value: issueForm.min_order_value ? parseFloat(issueForm.min_order_value) : undefined,
          issued_to: issueForm.issued_to || undefined,
          valid_to: issueForm.valid_to || undefined,
        }),
      });
      if (v) { setVouchers((p) => [v, ...p]); onNotification?.("Voucher Issued", `${v.voucher_no}`, "success"); setActiveTab("LIST"); }
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Issue failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const handleRedeem = async () => {
    if (!redeemVoucherId || !redeemInvoiceNo) { onNotification?.("Validation", "Voucher ID and Invoice No required.", "info"); return; }
    setSubmitting(true);
    try {
      const v = await apiFetchV1<GiftVoucher>(`/gift-cards-engine/gift-vouchers/${redeemVoucherId}/redeem`, {
        method: "POST",
        body: JSON.stringify({ invoice_no: redeemInvoiceNo, order_value: parseFloat(redeemOrderValue) || 0 }),
      });
      if (v) { setVouchers((p) => p.map((x) => x.id === v.id ? v : x)); onNotification?.("Voucher Redeemed", `${v.voucher_no}`, "success"); }
      setRedeemVoucherId(""); setRedeemInvoiceNo(""); setRedeemOrderValue("0");
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Redeem failed.", "error"); }
    finally { setSubmitting(false); }
  };

  const handleCancel = async (id: string) => {
    try {
      const v = await apiFetchV1<GiftVoucher>(`/gift-cards-engine/gift-vouchers/${id}/cancel`, { method: "POST" });
      if (v) setVouchers((p) => p.map((x) => x.id === v.id ? v : x));
      onNotification?.("Cancelled", "Voucher has been cancelled.", "success");
    } catch (e: any) { onNotification?.("Error", e?.message ?? "Cancel failed.", "error"); }
  };

  const displayed = filterStatus === "ALL" ? vouchers : vouchers.filter((v) => v.status === filterStatus);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-400 text-2xl">redeem</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Gift Voucher Studio</h2>
              <p className="text-xs text-slate-400">Issue · Redeem · Cancel value-based vouchers</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(["LIST", "ISSUE"] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === t ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {t === "LIST" ? "Vouchers" : "Issue New"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex-1 overflow-y-auto">
          {activeTab === "LIST" && (
            <>
              <div className="flex items-center gap-3 px-6 py-2.5 border-b border-slate-800 bg-slate-950/30 text-xs">
                {["ALL", "ACTIVE", "USED", "EXPIRED", "CANCELLED"].map((s) => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${filterStatus === s ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl text-xs">
                  <input value={redeemVoucherId} onChange={(e) => setRedeemVoucherId(e.target.value)} placeholder="Voucher ID to redeem"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500/60" />
                  <input value={redeemInvoiceNo} onChange={(e) => setRedeemInvoiceNo(e.target.value)} placeholder="Invoice No"
                    className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500/60" />
                  <input type="number" value={redeemOrderValue} onChange={(e) => setRedeemOrderValue(e.target.value)} placeholder="Order Value"
                    className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500/60" />
                  <button onClick={handleRedeem} disabled={submitting}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-40 transition-all">
                    {submitting ? "..." : "Redeem"}
                  </button>
                </div>
                {displayed.length === 0 && !loading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                    <span className="material-symbols-outlined text-4xl">redeem</span>
                    <p className="text-sm">No vouchers found.</p>
                  </div>
                ) : displayed.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs gap-4">
                    <div>
                      <p className="font-bold text-slate-100 font-mono">{v.voucher_no}</p>
                      <p className="text-slate-500 mt-0.5">{v.voucher_type} · {v.issued_to ?? "—"} · Valid to: {v.valid_to ?? "Open"}</p>
                      {v.pct_discount && <p className="text-orange-400 text-[10px]">{v.pct_discount}% off</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black font-mono text-orange-400">{fmt(v.face_value)}</span>
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[v.status] ?? ""}`}>{v.status}</span>
                      {v.status === "ACTIVE" && (
                        <button onClick={() => handleCancel(v.id)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-rose-400 hover:bg-rose-950/30 border border-rose-800/30 transition-all">Cancel</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "ISSUE" && (
            <div className="p-6 space-y-4 text-xs max-w-md">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Issue New Gift Voucher</p>
              <div className="flex gap-2">
                {["FIXED", "PCT"].map((t) => (
                  <button key={t} onClick={() => setIssueForm((p) => ({ ...p, voucher_type: t }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${issueForm.voucher_type === t ? "bg-orange-500/20 text-orange-300 border-orange-500/30" : "text-slate-500 border-slate-700"}`}>
                    {t === "FIXED" ? "Fixed Value" : "Percentage"}
                  </button>
                ))}
              </div>
              {[
                { label: issueForm.voucher_type === "FIXED" ? "Face Value (₹)" : "Discount (%)", key: issueForm.voucher_type === "FIXED" ? "face_value" : "pct_discount", type: "number" },
                { label: "Min Order Value (₹)", key: "min_order_value", type: "number", placeholder: "0" },
                { label: "Issued To",           key: "issued_to",      placeholder: "Name / mobile" },
                { label: "Valid Until",          key: "valid_to",       type: "date" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">{f.label}</label>
                  <input type={f.type ?? "text"} value={(issueForm as any)[f.key]}
                    onChange={(e) => setIssueForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-orange-500/60" />
                </div>
              ))}
              <button onClick={handleIssue} disabled={submitting}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-40 transition-all">
                {submitting ? "Issuing..." : "Issue Voucher"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default GiftVoucherModal;
