/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.28.0
 * Created      : 2026-07-13
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Loyalty & Rewards Studio (Fiori Horizon Inspired Light Theme)
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { WalletManager } from "./loyalty/WalletManager.tsx";
import { TierManager } from "./loyalty/TierManager.tsx";
import { Wallet } from "../services/loyaltyService.ts";
import { 
  Award, 
  Wallet as WalletIcon, 
  Crown, 
  Sliders, 
  ShieldAlert, 
  Download, 
  Plus,
  Coins
} from "lucide-react";

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
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-body font-sans space-y-5 p-6">
      
      {/* Read Only Warning */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl flex items-center space-x-2 text-amber-800 text-xs shadow-xs">
          <ShieldAlert size={16} className="text-amber-600 shrink-0" />
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Point balances and wallet tiering are frozen.</span>
        </div>
      )}

      {/* Top Workspace Subheader */}
      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-theme-body tracking-tight">Loyalty &amp; Rewards Engine</h2>
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">
              Program Active
            </span>
          </div>
          <p className="text-xs text-theme-muted font-mono mt-0.5">
            CRM &amp; Loyalty &gt; Loyalty Studio &gt; Wallets &amp; Rewards
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button 
            onClick={() => recordAuditAction("EXPORT", "loyalty", "export", "Exported loyalty ledger report")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover font-semibold transition-colors cursor-pointer"
          >
            <Download size={13} className="text-theme-muted" />
            <span>Export Ledgers</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Pills Bar */}
      <div className="flex items-center border-b border-theme-divider gap-1">
        {(["dashboard", "wallets", "tiers", "rules"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-all cursor-pointer ${
              activeSubTab === tab
                ? "border-theme-primary text-theme-primary bg-theme-surface-2 font-bold"
                : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover"
            }`}
          >
            {tab === "dashboard" && "Loyalty Dashboard"}
            {tab === "wallets" && "Membership Wallets"}
            {tab === "tiers" && "Membership Tiers"}
            {tab === "rules" && "Point Rules"}
          </button>
        ))}
      </div>

      {/* Main Content Workspace */}
      <SmritiScrollArea className="flex-1">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === "dashboard" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center text-theme-muted text-xs">
                    <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Total Points Awarded</span>
                    <Coins size={16} className="text-amber-600" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-theme-body font-mono">1,845,000</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">82% redemption</span>
                  </div>
                </div>

                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center text-theme-muted text-xs">
                    <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Platinum VIP Members</span>
                    <Crown size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-indigo-700 font-mono">124 Members</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">+8 upgrades</span>
                  </div>
                </div>

                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center text-theme-muted text-xs">
                    <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Coupon Liabilities</span>
                    <Award size={16} className="text-rose-600" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-theme-body font-mono">42 Active</span>
                    <span className="text-[10px] text-theme-muted font-mono">₹14,500 Val</span>
                  </div>
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
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-theme-body uppercase tracking-wider font-mono">
                Point Calculation Parameters
              </h3>
              <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-5 max-w-lg shadow-xs">
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-theme-muted mb-1 font-bold">Earn Multiplier (Points per ₹1 Spent)</label>
                    <input
                      type="number"
                      value={pointsRate}
                      onChange={(e) => handleUpdateRules(parseFloat(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className={`w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2.5 text-theme-body font-mono font-bold text-sm focus:outline-none focus:border-theme-primary ${
                        isReadOnly ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    />
                  </div>
                  <p className="text-[11px] text-theme-muted font-mono leading-relaxed">
                    This determines global points credit parameters evaluated automatically on POS invoice checkout completion.
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
