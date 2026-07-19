/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { WalletManager } from "./loyalty/WalletManager.tsx";
import { TierManager } from "./loyalty/TierManager.tsx";
import { Wallet } from "../services/loyaltyService.ts";

export interface LoyaltyStudioTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const LoyaltyStudioTab: React.FC<LoyaltyStudioTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "wallets" | "tiers" | "rules">("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [pointsRate, setPointsRate] = useState(1);

  // Seed Data
  const [wallets, setWallets] = useState<Wallet[]>([
    { id: "W-100", customer: "Priya Desai", points: 4500, tier: "Platinum" },
    { id: "W-101", customer: "Rahul Sharma", points: 1200, tier: "Gold" },
    { id: "W-102", customer: "Amit Kumar", points: 850, tier: "Gold" },
    { id: "W-103", customer: "Neha Gupta", points: 300, tier: "Silver" },
  ]);

  // Telemetry Audit log triggers
  useEffect(() => {
    recordAuditAction("VIEW", "loyalty", activeSubTab, `Switched Loyalty view to: ${activeSubTab}`);
  }, [activeSubTab]);

  const handleUpdateRules = (rate: number) => {
    if (isReadOnly) {
      alert("Access Denied: Read-only operators cannot modify point conversion parameters.");
      return;
    }
    setPointsRate(rate);
    recordAuditAction("UPDATE", "loyalty_rules", "points_rate", `Updated loyalty points earning rate to: 1 INR = ${rate} Points`);
  };

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Point balances and wallet tiering are frozen.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight">
            Loyalty & Rewards Studio
          </h2>
          <p className="text-xs text-theme-muted mt-1 max-w-2xl">
            Points wallet ledgers, reward earning rules, tiered membership criteria, and promotion coupons.
          </p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center px-6 bg-theme-surface-2 border-b border-theme-divider gap-2">
        {(["dashboard", "wallets", "tiers", "rules"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors ${
              activeSubTab === tab
                ? "border-blue-500 text-blue-400 bg-theme-surface-3"
                : "border-transparent text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
            }`}
          >
            {tab === "dashboard" && "Loyalty Dashboard"}
            {tab === "wallets" && "Membership Wallets"}
            {tab === "tiers" && "Membership Tiers"}
            {tab === "rules" && "Point Rules"}
          </button>
        ))}
      </div>

      <SmritiScrollArea className="flex-1 bg-theme-base p-6">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">Total Points Awarded (Life)</h4>
                  <div className="text-2xl font-bold text-theme-primary font-mono">1,845,000</div>
                  <div className="text-[10px] text-emerald-400 mt-1 font-mono">82% redemption rate</div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">Platinum VIP Tiers</h4>
                  <div className="text-2xl font-bold text-theme-primary font-mono">124 Members</div>
                  <div className="text-[10px] text-emerald-400 mt-1 font-mono">+8 premium tier upgrades</div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">Pending Coupon Liabilities</h4>
                  <div className="text-2xl font-bold text-theme-primary font-mono">42 active</div>
                  <div className="text-[10px] text-theme-muted mt-1 font-mono">Estimated value: ₹14,500</div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "wallets" && (
            <WalletManager wallets={wallets} isReadOnly={isReadOnly} />
          )}

          {activeSubTab === "tiers" && (
            <TierManager />
          )}

          {activeSubTab === "rules" && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">Point Calculation Parameters</h3>
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-6 max-w-lg shadow-lg">
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-theme-muted mb-1 font-bold">Earn Multiplier (Points per ₹1 Spent)</label>
                    <input
                      type="number"
                      value={pointsRate}
                      onChange={(e) => handleUpdateRules(parseFloat(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className={`w-full bg-theme-surface-3 border border-theme-divider rounded-lg p-3 text-theme-body font-mono text-sm focus:outline-none focus:border-blue-500 ${
                        isReadOnly ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    />
                  </div>
                  <p className="text-[10px] text-theme-muted font-mono leading-relaxed">
                    This determines global points credit parameters evaluated on invoice checkout checkout completion.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </SmritiScrollArea>
    </div>
  );
};
