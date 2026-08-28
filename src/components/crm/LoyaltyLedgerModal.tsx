/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.96.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import LoyaltyLedgerEngine, {
  LoyaltyLedgerEntry,
  LoyaltyBalance,
  LOYALTY_CONFIG,
} from "../../../utils/loyaltyLedgerEngine";

interface LoyaltyLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const EVENT_COLORS: Record<string, string> = {
  EARN_PURCHASE:          "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  EARN_SIGNUP_BONUS:      "text-sky-300 bg-sky-500/20 border-sky-500/30",
  EARN_REFERRAL:          "text-violet-300 bg-violet-500/20 border-violet-500/30",
  EARN_BIRTHDAY:          "text-pink-300 bg-pink-500/20 border-pink-500/30",
  EARN_MANUAL_CREDIT:     "text-teal-300 bg-teal-500/20 border-teal-500/30",
  BURN_REDEMPTION:        "text-rose-300 bg-rose-500/20 border-rose-500/30",
  BURN_VOUCHER_CONVERSION:"text-orange-300 bg-orange-500/20 border-orange-500/30",
  BURN_EXPIRY_WRITEOFF:   "text-slate-400 bg-slate-700/30 border-slate-600/30",
  ADJUSTMENT_DEBIT:       "text-red-300 bg-red-500/20 border-red-500/30",
  ADJUSTMENT_CREDIT:      "text-cyan-300 bg-cyan-500/20 border-cyan-500/30",
};

const BASE_TIME = new Date("2026-08-28T00:00:00.000Z");

function buildSampleLedger(): LoyaltyLedgerEntry[] {
  const entries: LoyaltyLedgerEntry[] = [];
  // Signup bonus
  entries.push(LoyaltyLedgerEngine.earnBonus({ customerId: "CUST-001", eventType: "EARN_SIGNUP_BONUS", referenceNo: "SIGNUP-2026-001", earnedAt: "2026-01-15T09:00:00.000Z" }));
  // Purchases
  entries.push(LoyaltyLedgerEngine.earnFromPurchase({ customerId: "CUST-001", invoiceNo: "INV-2026-0012", invoiceValue: 3500, earnedAt: "2026-02-10T11:00:00.000Z" }));
  entries.push(LoyaltyLedgerEngine.earnFromPurchase({ customerId: "CUST-001", invoiceNo: "INV-2026-0089", invoiceValue: 8200, earnedAt: "2026-04-22T14:30:00.000Z" }));
  entries.push(LoyaltyLedgerEngine.earnFromPurchase({ customerId: "CUST-001", invoiceNo: "INV-2026-0245", invoiceValue: 5100, earnedAt: "2026-07-18T10:15:00.000Z" }));
  // Birthday bonus
  entries.push(LoyaltyLedgerEngine.earnBonus({ customerId: "CUST-001", eventType: "EARN_BIRTHDAY", referenceNo: "BDAY-2026-CUST001", earnedAt: "2026-06-05T00:00:00.000Z" }));
  // Redemption
  const balance = LoyaltyLedgerEngine.computeBalance(entries, "CUST-001", BASE_TIME);
  const redemption = LoyaltyLedgerEngine.processRedemption({
    customerId: "CUST-001", invoiceNo: "INV-2026-0245", invoiceValue: 5100,
    pointsRequested: 800, balance, redeemedAt: "2026-07-18T10:20:00.000Z",
  });
  if (redemption.burnEntry) entries.push(redemption.burnEntry);
  return entries;
}

export const LoyaltyLedgerModal: React.FC<LoyaltyLedgerModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [ledger, setLedger] = useState<LoyaltyLedgerEntry[]>(buildSampleLedger);
  const [redeemPts, setRedeemPts] = useState("500");
  const [redeemInvoice, setRedeemInvoice] = useState("INV-2026-0300");
  const [redeemValue, setRedeemValue] = useState("3000");
  const [activeTab, setActiveTab] = useState<"LEDGER" | "REDEEM" | "EXPIRY">("LEDGER");

  const balance: LoyaltyBalance = useMemo(() => LoyaltyLedgerEngine.computeBalance(ledger, "CUST-001", BASE_TIME), [ledger]);

  if (!isOpen) return null;

  const handleRedeem = () => {
    const pts = parseInt(redeemPts);
    const val = parseFloat(redeemValue);
    if (isNaN(pts) || pts <= 0) { onNotification?.("Invalid", "Enter valid points to redeem.", "error"); return; }
    const result = LoyaltyLedgerEngine.processRedemption({
      customerId: "CUST-001", invoiceNo: redeemInvoice, invoiceValue: val,
      pointsRequested: pts, balance, redeemedAt: new Date().toISOString(),
    });
    if (!result.approved) {
      onNotification?.("Redemption Rejected", result.rejectionReason ?? "Cannot process redemption.", "error");
    } else {
      setLedger((prev) => [...prev, result.burnEntry!]);
      onNotification?.("Redeemed!", `${result.pointsToRedeem} pts → ₹${result.monetaryValue} credited on ${redeemInvoice}`, "success");
    }
  };

  const expirySweep = useMemo(() => LoyaltyLedgerEngine.runExpirySweep(ledger, BASE_TIME), [ledger]);

  const earnEntries = ledger.filter((e) => e.points > 0).sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
  const burnEntries = ledger.filter((e) => e.points < 0).sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
              <span className="material-symbols-outlined text-2xl">loyalty</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Dynamic Loyalty Points Burn & Earn Ledger</h2>
              <p className="text-xs text-slate-400">Double-Entry Ledger · Expiry Scheduling · Redemption Caps · Real-Time Balance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["LEDGER", "REDEEM", "EXPIRY"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Balance Strip */}
        <div className="grid grid-cols-4 gap-0 border-b border-slate-800 divide-x divide-slate-800 bg-slate-950/30">
          {[
            { label: "Available Balance", value: balance.availableBalance.toLocaleString("en-IN"), color: "text-yellow-400", unit: "pts" },
            { label: "Total Earned", value: balance.totalEarned.toLocaleString("en-IN"), color: "text-emerald-400", unit: "pts" },
            { label: "Total Redeemed", value: balance.totalBurned.toLocaleString("en-IN"), color: "text-rose-400", unit: "pts" },
            { label: "Expiring (30d)", value: balance.expiringIn30Days.toLocaleString("en-IN"), color: balance.expiringIn30Days > 0 ? "text-amber-400" : "text-slate-500", unit: "pts" },
          ].map((m) => (
            <div key={m.label} className="px-5 py-3 text-center">
              <div className={`text-xl font-black font-mono ${m.color}`}>{m.value} <span className="text-xs font-normal">{m.unit}</span></div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</div>
            </div>
          ))}
        </div>

        {activeTab === "LEDGER" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Earn entries */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Earn Entries ({earnEntries.length})</p>
              <div className="space-y-2">
                {earnEntries.map((e) => (
                  <div key={e.entryId} className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/40 rounded-xl text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${EVENT_COLORS[e.eventType] ?? "text-slate-400 bg-slate-700/30 border-slate-600/30"}`}>
                        {e.eventType.replace(/_/g, " ")}
                      </span>
                      <div>
                        <p className="font-mono text-slate-200">{e.referenceNo}</p>
                        <p className="text-slate-500 text-[10px]">{new Date(e.earnedAt).toLocaleDateString("en-IN")}{e.expiresAt && ` · Exp: ${new Date(e.expiresAt).toLocaleDateString("en-IN")}`}</p>
                      </div>
                    </div>
                    <span className="font-black font-mono text-emerald-400 text-sm">+{e.points.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Burn entries */}
            {burnEntries.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Burn Entries ({burnEntries.length})</p>
                <div className="space-y-2">
                  {burnEntries.map((e) => (
                    <div key={e.entryId} className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/40 rounded-xl text-xs">
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${EVENT_COLORS[e.eventType] ?? "text-slate-400 bg-slate-700/30 border-slate-600/30"}`}>
                          {e.eventType.replace(/_/g, " ")}
                        </span>
                        <div>
                          <p className="font-mono text-slate-200">{e.referenceNo}</p>
                          <p className="text-slate-500 text-[10px]">{new Date(e.earnedAt).toLocaleDateString("en-IN")}</p>
                          {e.note && <p className="text-slate-500 text-[10px]">{e.note}</p>}
                        </div>
                      </div>
                      <span className="font-black font-mono text-rose-400 text-sm">{e.points.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "REDEEM" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="bg-yellow-950/20 border border-yellow-500/30 rounded-xl p-5 space-y-4">
              <p className="text-xs font-bold text-yellow-300 uppercase tracking-wide">Redeem Points at POS</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wide">Invoice No</label>
                  <input value={redeemInvoice} onChange={(e) => setRedeemInvoice(e.target.value)}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-yellow-500/60" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wide">Invoice Value (₹)</label>
                  <input value={redeemValue} onChange={(e) => setRedeemValue(e.target.value)} type="number"
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-yellow-500/60" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wide">Points to Redeem</label>
                  <input value={redeemPts} onChange={(e) => setRedeemPts(e.target.value)} type="number"
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-yellow-500/60" />
                </div>
              </div>
              {/* Preview */}
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[
                  { label: "Max Redeemable (20% cap)", value: `${Math.floor((parseFloat(redeemValue || "0") * LOYALTY_CONFIG.maxRedemptionPct) / LOYALTY_CONFIG.rupeePerPoint)} pts` },
                  { label: "Monetary Value", value: `₹${Math.round(Math.min(parseInt(redeemPts || "0"), balance.availableBalance) * LOYALTY_CONFIG.rupeePerPoint * 100) / 100}` },
                  { label: "Balance After Redemption", value: `${Math.max(0, balance.availableBalance - parseInt(redeemPts || "0"))} pts` },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800/40">
                    <div className="text-sm font-black font-mono text-yellow-400">{m.value}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>
              <button onClick={handleRedeem} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-yellow-600 hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-500/20">
                🎁 Process Redemption
              </button>
            </div>
            {/* Policy reference */}
            <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Redemption Policy</p>
              {[
                { label: "Earn Rate", value: `${LOYALTY_CONFIG.pointsPerRupee} pt per ₹1 spent` },
                { label: "Redeem Rate", value: `₹${LOYALTY_CONFIG.rupeePerPoint} per point` },
                { label: "Max per Invoice", value: `${LOYALTY_CONFIG.maxRedemptionPct * 100}% of invoice value` },
                { label: "Minimum Balance Retained", value: `${LOYALTY_CONFIG.minBalanceAfterBurn} pts` },
                { label: "Points Expiry", value: `${LOYALTY_CONFIG.pointsExpiryDays} days from earn date` },
              ].map((p) => (
                <div key={p.label} className="flex justify-between text-xs border-b border-slate-800/40 last:border-0 py-1.5">
                  <span className="text-slate-400">{p.label}</span>
                  <span className="font-bold text-slate-200">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "EXPIRY" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Expiry Sweep Results</p>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${expirySweep.totalExpiredPoints > 0 ? "text-amber-300 bg-amber-500/20 border-amber-500/30" : "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"}`}>
                {expirySweep.totalExpiredPoints > 0 ? `${expirySweep.totalExpiredPoints} pts expired` : "No expired points"}
              </span>
            </div>
            {expirySweep.expiredEntries.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">No entries have expired as of the reference date.</div>
            ) : (
              <>
                <div className="space-y-2">
                  {expirySweep.expiredEntries.map((e) => (
                    <div key={e.entryId} className="flex items-center justify-between p-3 bg-slate-800/30 border border-amber-500/20 rounded-xl text-xs">
                      <div>
                        <p className="font-mono text-slate-200">{e.referenceNo}</p>
                        <p className="text-amber-400 text-[10px]">Expired: {new Date(e.expiresAt!).toLocaleDateString("en-IN")}</p>
                      </div>
                      <span className="font-black font-mono text-amber-400">{e.points} pts</span>
                    </div>
                  ))}
                </div>
                <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4">
                  <p className="text-xs font-bold text-rose-300 mb-2">Write-Off Entries Generated</p>
                  {expirySweep.writeOffEntries.map((e) => (
                    <div key={e.entryId} className="flex justify-between text-xs text-slate-300 py-1">
                      <span className="font-mono">{e.referenceNo}</span>
                      <span className="font-bold text-rose-400 font-mono">{e.points} pts</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyLedgerModal;
