/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.87.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import GiftCardEngine, { GiftCard, GiftCardRedemptionRequest } from "../../utils/giftCardEngine";

interface GiftCardLifecycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

type ActiveTab = "ISSUE" | "TOPUP" | "REDEEM" | "LEDGER" | "BREAKAGE";

const SAMPLE_CARDS_INITIAL: GiftCard[] = [
  GiftCardEngine.issue({ cardNumber: "7841200430054521", issuedTo: "CUST-001", amount: 5000, branchCode: "BR-MUM-01", operatorId: "SYSTEM", validityDays: 365 }),
  GiftCardEngine.issue({ cardNumber: "7841200430057788", issuedTo: "CUST-002", amount: 2000, branchCode: "BR-DEL-02", operatorId: "SYSTEM", validityDays: 180 }),
];

export const GiftCardLifecycleModal: React.FC<GiftCardLifecycleModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("ISSUE");
  const [cards, setCards] = useState<GiftCard[]>(SAMPLE_CARDS_INITIAL);

  // â”€â”€ Issue Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [issueAmount, setIssueAmount] = useState("1000");
  const [issueCustomer, setIssueCustomer] = useState("");

  // â”€â”€ Top-Up Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [topUpCardNum, setTopUpCardNum] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("500");

  // â”€â”€ Redeem Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [redeemCardNum, setRedeemCardNum] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("500");
  const [redeemOtp, setRedeemOtp] = useState("");
  const [redeemVoucher, setRedeemVoucher] = useState("INV-2026-DEMO");

  const breakageAnalysis = useMemo(() => GiftCardEngine.analyzeBreakage(cards), [cards]);

  if (!isOpen) return null;

  const handleIssue = () => {
    const amt = parseInt(issueAmount);
    if (!issueCustomer || isNaN(amt) || amt < 100) {
      onNotification?.("Validation Error", "Customer ID and a minimum amount of â‚¹100 are required.", "error");
      return;
    }
    const cardNum = `GC${Date.now()}`.slice(-16).padStart(16, "0");
    const newCard = GiftCardEngine.issue({ cardNumber: cardNum, issuedTo: issueCustomer, amount: amt, branchCode: "BR-MUM-01", operatorId: "OPR-001", validityDays: 365 });
    setCards((prev) => [newCard, ...prev]);
    onNotification?.("Gift Card Issued", `Card ${newCard.maskedNumber} issued for â‚¹${amt} to ${issueCustomer}.`, "success");
    setIssueCustomer("");
  };

  const handleTopUp = () => {
    const card = cards.find((c) => c.cardNumber.endsWith(topUpCardNum.slice(-4)));
    if (!card) { onNotification?.("Card Not Found", "No active card found for the entered number.", "error"); return; }
    try {
      const topped = GiftCardEngine.topUp(card, parseInt(topUpAmount), "OPR-001");
      setCards((prev) => prev.map((c) => c.cardNumber === card.cardNumber ? topped : c));
      onNotification?.("Top-Up Successful", `â‚¹${topUpAmount} added to ${card.maskedNumber}. New balance: â‚¹${topped.currentBalance}`, "success");
    } catch (e: any) {
      onNotification?.("Top-Up Failed", e.message, "error");
    }
  };

  const handleRedeem = () => {
    const card = cards.find((c) => c.cardNumber.endsWith(redeemCardNum.slice(-4)));
    if (!card) { onNotification?.("Card Not Found", "No card found for the entered number.", "error"); return; }
    const req: GiftCardRedemptionRequest = { cardNumber: card.cardNumber, otp: redeemOtp, redemptionAmount: parseInt(redeemAmount), salesVoucher: redeemVoucher, operatorId: "OPR-001" };
    const { card: updated, result } = GiftCardEngine.redeem(card, req);
    if (result.success) {
      setCards((prev) => prev.map((c) => c.cardNumber === card.cardNumber ? updated : c));
      onNotification?.("Redemption Successful", `â‚¹${result.amountRedeemed} redeemed. Remaining balance: â‚¹${result.balanceAfter}`, "success");
    } else {
      onNotification?.("Redemption Failed", result.errorMessage ?? "Unknown error.", "error");
    }
  };

  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: "ISSUE", label: "Issue Card", icon: "add_card" },
    { id: "TOPUP", label: "Top-Up", icon: "account_balance_wallet" },
    { id: "REDEEM", label: "Redeem", icon: "redeem" },
    { id: "LEDGER", label: "Ledger", icon: "receipt_long" },
    { id: "BREAKAGE", label: "Breakage Analysis", icon: "analytics" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <span className="material-symbols-outlined text-2xl">card_giftcard</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Gift Card & Voucher Lifecycle Manager</h2>
              <p className="text-xs text-slate-400">Issue Â· Top-Up Â· OTP-Secured Redemption Â· Breakage Revenue</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-slate-800 bg-slate-950/30 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-all border-b-2 ${
                activeTab === t.id
                  ? "text-emerald-400 border-emerald-500 bg-emerald-500/10"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* â”€â”€ ISSUE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "ISSUE" && (
            <div className="space-y-4 max-w-md">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Issue a New Gift Card</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Customer ID *</label>
                  <input value={issueCustomer} onChange={(e) => setIssueCustomer(e.target.value)} placeholder="CUST-0001"
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Amount (â‚¹) *</label>
                  <input type="number" value={issueAmount} onChange={(e) => setIssueAmount(e.target.value)} min={100}
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div className="flex gap-2">
                  {[500, 1000, 2000, 5000].map((p) => (
                    <button key={p} onClick={() => setIssueAmount(String(p))}
                      className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-600 hover:border-emerald-500/50 transition-all font-mono">
                      â‚¹{p.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
                <button onClick={handleIssue} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20">
                  Issue Gift Card
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ TOP-UP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "TOPUP" && (
            <div className="space-y-4 max-w-md">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top-Up an Existing Card</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Last 4 digits of card *</label>
                  <input value={topUpCardNum} onChange={(e) => setTopUpCardNum(e.target.value)} placeholder="e.g. 4521"
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Top-Up Amount (â‚¹) *</label>
                  <input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} min={100}
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <button onClick={handleTopUp} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">
                  Add Balance
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ REDEEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "REDEEM" && (
            <div className="space-y-4 max-w-md">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">OTP-Secured Gift Card Redemption</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Last 4 digits of card *</label>
                  <input value={redeemCardNum} onChange={(e) => setRedeemCardNum(e.target.value)} placeholder="e.g. 4521"
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">OTP (sent to registered mobile) *</label>
                  <input value={redeemOtp} onChange={(e) => setRedeemOtp(e.target.value)} placeholder="6-digit OTP" maxLength={6}
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800 border border-slate-700 font-mono outline-none focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Redemption Amount (â‚¹) *</label>
                  <input type="number" value={redeemAmount} onChange={(e) => setRedeemAmount(e.target.value)} min={1}
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Sales Voucher Ref</label>
                  <input value={redeemVoucher} onChange={(e) => setRedeemVoucher(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-800 border border-slate-700 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <button onClick={handleRedeem} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 transition-all shadow-lg shadow-amber-500/20">
                  Validate OTP & Redeem
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ LEDGER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "LEDGER" && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gift Cards â€” Stored-Value Ledger</h3>
              {cards.map((card) => (
                <div key={card.cardNumber} className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-950/40 border-b border-slate-800">
                    <div>
                      <span className="text-sm font-bold text-slate-200 font-mono">{card.maskedNumber}</span>
                      <span className="ml-3 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{card.status}</span>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-slate-400">Balance</div>
                      <div className="text-emerald-400 font-bold font-mono">â‚¹{card.currentBalance.toLocaleString("en-IN")}</div>
                    </div>
                  </div>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="text-slate-500 uppercase text-[10px] bg-slate-950/20">
                        <th className="py-1.5 px-3">Type</th><th className="py-1.5 px-3 text-right">Amount</th><th className="py-1.5 px-3 text-right">Balance Before</th><th className="py-1.5 px-3 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {card.transactions.map((txn) => (
                        <tr key={txn.txnId}>
                          <td className="py-1.5 px-3 text-slate-300">{txn.txnType}</td>
                          <td className="py-1.5 px-3 text-right text-amber-400">â‚¹{txn.amount}</td>
                          <td className="py-1.5 px-3 text-right text-slate-400">â‚¹{txn.balanceBefore}</td>
                          <td className="py-1.5 px-3 text-right text-emerald-400 font-bold">â‚¹{txn.balanceAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* â”€â”€ BREAKAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeTab === "BREAKAGE" && (
            <div className="space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Breakage Revenue Recognition Analysis</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Issued", value: `â‚¹${breakageAnalysis.totalIssuedValue.toLocaleString("en-IN")}`, color: "text-slate-300" },
                  { label: "Total Redeemed", value: `â‚¹${breakageAnalysis.totalRedeemedValue.toLocaleString("en-IN")}`, color: "text-emerald-400" },
                  { label: "Breakage Revenue", value: `â‚¹${breakageAnalysis.breakageRevenue.toLocaleString("en-IN")}`, color: "text-amber-400" },
                  { label: "Breakage %", value: `${breakageAnalysis.breakagePct}%`, color: "text-rose-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                    <div className={`text-lg font-bold font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">{m.label}</div>
                  </div>
                ))}
              </div>
              {breakageAnalysis.cards.length > 0 ? (
                <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4">
                  <p className="text-xs text-rose-300 font-bold mb-3">Expired Cards with Unredeemed Balances</p>
                  {breakageAnalysis.cards.map((c) => (
                    <div key={c.cardNumber} className="flex justify-between text-xs font-mono text-slate-300 py-1 border-b border-slate-800/50 last:border-0">
                      <span>{c.maskedNumber}</span>
                      <span className="text-rose-400 font-bold">â‚¹{c.balance.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-xs text-slate-500 py-6">No expired cards with unredeemed balances in the current period.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GiftCardLifecycleModal;

