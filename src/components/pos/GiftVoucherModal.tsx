/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.114.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import GiftVoucherEngine, {
  GiftVoucher, VoucherType, VoucherStatus,
} from "../../utils/giftVoucherEngine";

interface GiftVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const TYPE_STYLE: Record<VoucherType, string> = {
  GIFT_VOUCHER:   "text-violet-300 bg-violet-500/15 border-violet-500/25",
  STORE_CREDIT:   "text-sky-300 bg-sky-500/15 border-sky-500/25",
  REFUND_CREDIT:  "text-teal-300 bg-teal-500/15 border-teal-500/25",
  PROMO_CREDIT:   "text-amber-300 bg-amber-500/15 border-amber-500/25",
};

const STATUS_STYLE: Record<VoucherStatus, string> = {
  ACTIVE:               "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  REDEEMED:             "text-slate-400 bg-slate-700/15 border-slate-600/25",
  PARTIALLY_REDEEMED:   "text-sky-300 bg-sky-500/15 border-sky-500/25",
  EXPIRED:              "text-rose-400 bg-rose-500/15 border-rose-500/25",
  CANCELLED:            "text-slate-500 bg-slate-800/15 border-slate-700/25",
};

const fmt = (n: number) => `â‚¹${n.toLocaleString("en-IN")}`;

function buildSampleVouchers(): GiftVoucher[] {
  const BASE = { issuedBy: "MGR-001", branchCode: "BR-MUM-01" };
  const v1 = GiftVoucherEngine.issueVoucher({ ...BASE, type: "GIFT_VOUCHER",  amount: 2000, issuedTo: "CUST-101", validDays: 365 });
  const v2 = GiftVoucherEngine.issueVoucher({ ...BASE, type: "STORE_CREDIT",  amount: 1500, issuedTo: "CUST-202", validDays: 180 });
  const v3 = GiftVoucherEngine.issueVoucher({ ...BASE, type: "PROMO_CREDIT",  amount: 500,  issuedTo: "CUST-303", validDays: 30  });
  const v3r = GiftVoucherEngine.redeemVoucher(v3, 200, "CASHIER-001").voucher;
  const v4 = GiftVoucherEngine.refundToCredit({ refundAmt: 750, customerId: "CUST-404", performedBy: "MGR-001", branchCode: "BR-MUM-01", saleRefNo: "SALE-0099" });
  return [v1, v2, v3r, v4];
}

export const GiftVoucherModal: React.FC<GiftVoucherModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [vouchers, setVouchers] = useState<GiftVoucher[]>(buildSampleVouchers);
  const [selectedId, setSelectedId] = useState(vouchers[0]?.voucherId ?? "");
  const [redeemAmt, setRedeemAmt] = useState("");
  const [refNo, setRefNo] = useState("");
  const [activeTab, setActiveTab] = useState<"DETAIL" | "LEDGER" | "SUMMARY">("DETAIL");

  const selected = vouchers.find((v) => v.voucherId === selectedId);
  const summary  = useMemo(() => GiftVoucherEngine.portfolioSummary(vouchers), [vouchers]);

  if (!isOpen) return null;

  const handleRedeem = () => {
    if (!selected || !redeemAmt) return;
    const amt = parseFloat(redeemAmt);
    if (isNaN(amt) || amt <= 0) return;
    try {
      const { voucher: updated, redeemedAmt, fullySettled } =
        GiftVoucherEngine.redeemVoucher(selected, amt, "CASHIER-001", refNo || undefined);
      setVouchers((prev) => prev.map((v) => v.voucherId === updated.voucherId ? updated : v));
      setRedeemAmt("");
      setRefNo("");
      onNotification?.(
        "Redemption Successful",
        `Redeemed ${fmt(redeemedAmt)} Â· Remaining: ${fmt(updated.balance)}${!fullySettled ? ` Â· Shortfall: ${fmt(amt - redeemedAmt)}` : ""}`,
        "success"
      );
    } catch (e: any) { onNotification?.("Redemption Error", e.message, "error"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-2xl">ðŸŽŸï¸</div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Gift Voucher & Store Credit Engine</h2>
              <p className="text-xs text-slate-400">Issuance Â· Partial Redemption Â· Refund Credit Â· Expiry Â· Portfolio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["DETAIL", "LEDGER", "SUMMARY"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "SUMMARY" ? "Portfolio" : tab === "LEDGER" ? "Ledger" : "Detail"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Voucher sidebar */}
          <div className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {vouchers.map((v) => (
              <button key={v.voucherId} onClick={() => { setSelectedId(v.voucherId); setActiveTab("DETAIL"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === v.voucherId ? "bg-violet-950/20 border-violet-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200">{v.voucherCode}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{v.issuedTo ?? "â€”"}</p>
                <p className={`text-sm font-black font-mono mt-1 ${v.balance > 0 ? "text-violet-400" : "text-slate-500"}`}>{fmt(v.balance)}</p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${TYPE_STYLE[v.type]}`}>{v.type.replace(/_/g, " ")}</span>
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${STATUS_STYLE[v.status]}`}>{v.status.replace(/_/g, " ")}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === "DETAIL" && selected && (
              <div className="space-y-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-black font-mono text-slate-100">{selected.voucherCode}</p>
                    <p className="text-xs text-slate-400">{selected.issuedTo ?? "Open Voucher"} Â· {selected.branchCode}</p>
                    <p className="text-[10px] text-slate-500">Expires: {new Date(selected.expiresAt).toLocaleDateString("en-IN")} Â· {selected.multiUse ? "Multi-use" : "Single-use"}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${TYPE_STYLE[selected.type]}`}>{selected.type.replace(/_/g, " ")}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status.replace(/_/g, " ")}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Issued Amt",  value: fmt(selected.issuedAmt),  color: "text-slate-400" },
                    { label: "Redeemed",    value: fmt(selected.issuedAmt - selected.balance), color: "text-rose-400" },
                    { label: "Balance",     value: fmt(selected.balance),     color: "text-violet-400 text-lg font-black" },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 text-center">
                      <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                {selected.status !== "REDEEMED" && selected.status !== "EXPIRED" && selected.status !== "CANCELLED" && (
                  <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Redeem</p>
                    <div className="flex items-center gap-3">
                      <input type="number" placeholder="Amount" value={redeemAmt} onChange={(e) => setRedeemAmt(e.target.value)}
                        className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500/60" />
                      <input type="text" placeholder="Invoice ref" value={refNo} onChange={(e) => setRefNo(e.target.value)}
                        className="w-40 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500/60" />
                      <button onClick={handleRedeem}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 transition-all">
                        Redeem
                      </button>
                    </div>
                    {redeemAmt && parseFloat(redeemAmt) > selected.balance && (
                      <p className="text-[10px] text-amber-400">âš  Requested {fmt(parseFloat(redeemAmt))} exceeds balance â€” will clamp to {fmt(selected.balance)}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "LEDGER" && selected && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Transaction Ledger â€” {selected.voucherCode}</p>
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                      <th className="py-2 px-3">Kind</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3 text-right">Balance After</th>
                      <th className="py-2 px-3">Note</th>
                      <th className="py-2 px-3">Time</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {[...selected.ledger].reverse().map((t) => (
                        <tr key={t.txnId}>
                          <td className="py-2 px-3">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                              t.kind === "ISSUE"   ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                              : t.kind === "REDEEM"  ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                              : t.kind === "ADJUST"  ? "text-sky-300 bg-sky-500/10 border-sky-500/20"
                              : t.kind === "EXPIRE"  ? "text-slate-400 bg-slate-700/10 border-slate-600/20"
                              : "text-amber-300 bg-amber-500/10 border-amber-500/20"
                            }`}>{t.kind}</span>
                          </td>
                          <td className={`py-2 px-3 text-right ${t.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{t.amount >= 0 ? "+" : ""}{fmt(t.amount)}</td>
                          <td className="py-2 px-3 text-right text-slate-300">{fmt(t.balanceAfter)}</td>
                          <td className="py-2 px-3 font-sans text-[10px] text-slate-400 max-w-[180px] truncate">{t.note}</td>
                          <td className="py-2 px-3 text-[10px] text-slate-500">{new Date(t.timestamp).toLocaleTimeString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "SUMMARY" && (
              <div className="space-y-5">
                <p className="text-sm font-bold text-slate-200">Portfolio Summary</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Issued",   value: fmt(summary.totalIssued),   color: "text-slate-300" },
                    { label: "Total Balance",  value: fmt(summary.totalBalance),  color: "text-violet-400 font-black" },
                    { label: "Expiring (30d)", value: `${summary.expiringSoon30d} voucher(s)`, color: "text-amber-400" },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 text-center">
                      <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Balance by Type</p>
                    {Object.entries(summary.byType).map(([type, amt]) => (
                      <div key={type} className="flex items-center justify-between px-3 py-2 border-b border-slate-800/40 text-xs">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${TYPE_STYLE[type as VoucherType]}`}>{type.replace(/_/g, " ")}</span>
                        <span className="font-mono text-slate-300">{fmt(amt)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Count by Status</p>
                    {Object.entries(summary.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between px-3 py-2 border-b border-slate-800/40 text-xs">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[status as VoucherStatus]}`}>{status.replace(/_/g, " ")}</span>
                        <span className="font-mono text-slate-300">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default GiftVoucherModal;

