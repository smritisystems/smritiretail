/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.88.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import LoyaltyEngine, {
  LoyaltyCustomer,
  TIER_DEFINITIONS,
  TIER_ORDER,
  LoyaltyTier,
} from "../../utils/loyaltyEngine";

interface Customer360LoyaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const TIER_COLORS: Record<LoyaltyTier, { bg: string; border: string; text: string; badge: string }> = {
  BRONZE:   { bg: "bg-orange-950/20",  border: "border-orange-700/50",  text: "text-orange-300",  badge: "bg-orange-700/30 text-orange-300 border-orange-600/50" },
  SILVER:   { bg: "bg-slate-800/40",   border: "border-slate-500/50",   text: "text-slate-300",   badge: "bg-slate-600/30 text-slate-300 border-slate-500/50" },
  GOLD:     { bg: "bg-amber-950/20",   border: "border-amber-600/50",   text: "text-amber-300",   badge: "bg-amber-600/30 text-amber-300 border-amber-500/50" },
  PLATINUM: { bg: "bg-cyan-950/20",    border: "border-cyan-600/50",    text: "text-cyan-300",    badge: "bg-cyan-600/30 text-cyan-300 border-cyan-500/50" },
  DIAMOND:  { bg: "bg-violet-950/20",  border: "border-violet-600/50",  text: "text-violet-300",  badge: "bg-violet-600/30 text-violet-300 border-violet-500/50" },
};

function makeSampleCustomers(): LoyaltyCustomer[] {
  const base = (id: string, name: string, mobile: string, spend: number, pts: number, tier: LoyaltyTier, bMonth?: number): LoyaltyCustomer => ({
    customerId: id, name, mobile, currentTier: tier,
    lifetimeSpend: spend, availablePoints: pts,
    totalEarnedPoints: pts + Math.floor(pts * 0.3),
    totalRedeemedPoints: Math.floor(pts * 0.3),
    birthdayMonth: bMonth,
    enrolledAt: "2024-01-15T00:00:00.000Z",
    lastTransactionAt: new Date().toISOString(),
    pointsHistory: [],
  });
  return [
    base("CUST-001", "Priya Mehta",       "9820001234", 175000, 4800, "PLATINUM", 8),
    base("CUST-002", "Arjun Sharma",      "9900112233", 520000, 15200, "DIAMOND"),
    base("CUST-003", "Neha Gupta",        "9711234567", 48000,  820, "GOLD", 3),
    base("CUST-004", "Rohan Verma",       "9833456789", 9200,   95, "BRONZE", 11),
    base("CUST-005", "Ananya Krishnan",   "9876543210", 62000,  1940, "GOLD"),
  ];
}

export const Customer360LoyaltyModal: React.FC<Customer360LoyaltyModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>(makeSampleCustomers);
  const [selectedId, setSelectedId] = useState<string>("CUST-001");
  const [purchaseAmount, setPurchaseAmount] = useState("2000");
  const [redeemPoints, setRedeemPoints] = useState("100");

  const selectedCustomer = customers.find((c) => c.customerId === selectedId)!;
  const tierDef = TIER_DEFINITIONS[selectedCustomer.currentTier];
  const tierColor = TIER_COLORS[selectedCustomer.currentTier];
  const progression = useMemo(() => LoyaltyEngine.getTierProgression(selectedCustomer), [selectedCustomer]);

  if (!isOpen) return null;

  const handleEarn = () => {
    const amt = parseFloat(purchaseAmount);
    if (isNaN(amt) || amt <= 0) return;
    const { customer: updated, event, progression: prog } = LoyaltyEngine.earnPoints(selectedCustomer, amt, `INV-${Date.now()}`, new Date());
    setCustomers((prev) => prev.map((c) => c.customerId === selectedId ? updated : c));
    const msg = prog.tierChanged
      ? `Earned ${event.points} pts! Congratulations â€” upgraded to ${prog.newTier}! (+${prog.upgradeBonus?.points ?? 0} upgrade bonus)`
      : `Earned ${event.points} pts. Balance: ${updated.availablePoints} pts`;
    onNotification?.("Points Earned", msg, "success");
  };

  const handleRedeem = () => {
    const pts = parseInt(redeemPoints);
    if (isNaN(pts) || pts <= 0) return;
    const { customer: updated, result } = LoyaltyEngine.redeemPoints(selectedCustomer, pts, `REDEEM-${Date.now()}`);
    if (result.success) {
      setCustomers((prev) => prev.map((c) => c.customerId === selectedId ? updated : c));
      onNotification?.("Points Redeemed", `${pts} pts redeemed for â‚¹${result.cashEquivalent}. Remaining: ${result.balanceAfter} pts`, "success");
    } else {
      onNotification?.("Redemption Failed", result.errorMessage ?? "Unknown error", "error");
    }
  };

  const progressPct = progression.nextTier
    ? Math.min(100, Math.round(
        ((selectedCustomer.lifetimeSpend - TIER_DEFINITIONS[selectedCustomer.currentTier].minLifetimeSpend) /
          (TIER_DEFINITIONS[progression.nextTier].minLifetimeSpend - TIER_DEFINITIONS[selectedCustomer.currentTier].minLifetimeSpend)) * 100
      ))
    : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <span className="material-symbols-outlined text-2xl">workspace_premium</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Customer 360 & Loyalty Tier Progression Matrix</h2>
              <p className="text-xs text-slate-400">5-Tier VIP Program Â· Dynamic Points Earn Â· Birthday Multipliers Â· Auto-Redemption</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Customer List */}
          <div className="w-64 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Customers</p>
            {customers.map((c) => {
              const tc = TIER_COLORS[c.currentTier];
              return (
                <button
                  key={c.customerId}
                  onClick={() => setSelectedId(c.customerId)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                    selectedId === c.customerId
                      ? `${tc.bg} ${tc.border} shadow-lg`
                      : "border-transparent hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-200 truncate">{c.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${tc.badge}`}>{c.currentTier}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{c.mobile}</div>
                  <div className={`text-[10px] font-bold mt-0.5 ${tc.text}`}>{c.availablePoints.toLocaleString("en-IN")} pts</div>
                </button>
              );
            })}
          </div>

          {/* Right: Customer 360 View */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Tier Card */}
            <div className={`rounded-2xl border p-5 ${tierColor.bg} ${tierColor.border}`}>
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-2xl font-black ${tierColor.text}`}>{selectedCustomer.currentTier}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierColor.badge}`}>MEMBER</span>
                  </div>
                  <p className="text-lg font-bold text-slate-100">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-400">{selectedCustomer.mobile}</p>
                  {selectedCustomer.birthdayMonth && (
                    <p className="text-[10px] text-pink-400 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">cake</span>
                      Birthday month: {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][selectedCustomer.birthdayMonth - 1]}
                      {" "}Â· {tierDef.birthdayMultiplier}x bonus active this month
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-black font-mono ${tierColor.text}`}>{selectedCustomer.availablePoints.toLocaleString("en-IN")}</div>
                  <div className="text-xs text-slate-400">Available Points</div>
                  <div className="text-xs text-slate-500 mt-1">Cash Value: <span className="text-emerald-400 font-bold">â‚¹{(selectedCustomer.availablePoints * tierDef.redemptionRate).toLocaleString("en-IN")}</span></div>
                </div>
              </div>

              {/* Tier Progress Bar */}
              {progression.nextTier && (
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
                    <span>{selectedCustomer.currentTier}</span>
                    <span>Next: {progression.nextTier} (â‚¹{progression.lifetimeSpendToNextTier.toLocaleString("en-IN")} more)</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${tierColor.text.replace("text-", "bg-").replace("-300", "-500")}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 text-right">{progressPct}% to {progression.nextTier}</div>
                </div>
              )}
              {!progression.nextTier && (
                <div className="mt-3 text-xs text-violet-300 font-bold text-center py-2 bg-violet-500/10 rounded-xl border border-violet-500/30">
                  Diamond â€” Highest Tier Achieved
                </div>
              )}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Lifetime Spend", value: `â‚¹${selectedCustomer.lifetimeSpend.toLocaleString("en-IN")}`, icon: "payments" },
                { label: "Total Earned", value: `${selectedCustomer.totalEarnedPoints.toLocaleString("en-IN")} pts`, icon: "star" },
                { label: "Total Redeemed", value: `${selectedCustomer.totalRedeemedPoints.toLocaleString("en-IN")} pts`, icon: "redeem" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex items-center gap-3">
                  <span className={`material-symbols-outlined text-xl ${tierColor.text}`}>{m.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-slate-200">{m.value}</div>
                    <div className="text-[10px] text-slate-500">{m.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tier Benefits Grid */}
            <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Current Tier Benefits</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
                {[
                  { label: "Points Earn Rate", value: `${tierDef.pointsEarnRate} pt/â‚¹100` },
                  { label: "Redemption Rate", value: `â‚¹${tierDef.redemptionRate}/pt` },
                  { label: "Birthday Multiplier", value: `${tierDef.birthdayMultiplier}x` },
                  { label: "Upgrade Bonus", value: tierDef.bonusUpgradePoints > 0 ? `${tierDef.bonusUpgradePoints} pts` : "â€”" },
                ].map((b) => (
                  <div key={b.label} className="bg-slate-900/60 rounded-xl py-3 px-2">
                    <div className={`text-lg font-black ${tierColor.text}`}>{b.value}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{b.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-emerald-400">add_circle</span>
                  Record Purchase & Earn Points
                </p>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Purchase Amount (â‚¹)</label>
                  <input type="number" value={purchaseAmount} data-field-key="customer_mobile"
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-900 border border-slate-700 outline-none focus:border-emerald-500 transition-colors font-mono" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[500, 1000, 2000, 5000].map((a) => (
                    <button key={a} onClick={() => setPurchaseAmount(String(a))} className="px-2 py-1 text-[10px] rounded-lg bg-slate-700 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-600 hover:border-emerald-500/50 transition-all font-mono">â‚¹{a.toLocaleString("en-IN")}</button>
                  ))}
                </div>
                <button onClick={handleEarn} className="w-full py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20">
                  Earn Points
                </button>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-400">redeem</span>
                  Redeem Points for Cash Discount
                </p>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Points to Redeem</label>
                  <input type="number" value={redeemPoints} data-field-key="customer_mobile"
                    onChange={(e) => setRedeemPoints(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 bg-slate-900 border border-slate-700 outline-none focus:border-amber-500 transition-colors font-mono" />
                </div>
                <div className="text-[10px] text-slate-400 bg-slate-900/60 rounded-lg px-3 py-2 font-mono">
                  Cash Equivalent: <span className="text-amber-400 font-bold">â‚¹{Math.round(parseInt(redeemPoints || "0") * tierDef.redemptionRate * 100) / 100}</span>
                </div>
                <div className="text-[10px] text-slate-500 pb-1">Min redemption: 50 pts Â· Available: {selectedCustomer.availablePoints} pts</div>
                <button onClick={handleRedeem} className="w-full py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-all shadow-lg shadow-amber-500/20">
                  Redeem Points
                </button>
              </div>
            </div>

            {/* All Tiers Reference */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Tier Structure</p>
              <div className="grid grid-cols-5 gap-2">
                {TIER_ORDER.map((tier) => {
                  const def = TIER_DEFINITIONS[tier];
                  const tc = TIER_COLORS[tier];
                  const isCurrentTier = tier === selectedCustomer.currentTier;
                  return (
                    <div key={tier} className={`p-3 rounded-xl border text-center transition-all ${tc.bg} ${tc.border} ${isCurrentTier ? "shadow-lg scale-105" : "opacity-60"}`}>
                      <div className={`text-sm font-black ${tc.text}`}>{def.label}</div>
                      <div className="text-[10px] text-slate-400 mt-1">â‚¹{(def.minLifetimeSpend / 1000).toFixed(0)}K+</div>
                      <div className={`text-[10px] font-bold ${tc.text} mt-1`}>{def.pointsEarnRate} pt/â‚¹100</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
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

export default Customer360LoyaltyModal;

