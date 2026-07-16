/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";

export const TierManager: React.FC = () => {
  const tiers = [
    { name: "Silver Level", requirement: "Sign up registration", multiplier: "1.0x points", color: "border-slate-500" },
    { name: "Gold Level", requirement: "Spend above ₹25,000 yearly", multiplier: "1.2x points bonus", color: "border-amber-500" },
    { name: "Platinum Level", requirement: "Spend above ₹75,000 yearly", multiplier: "1.5x points bonus", color: "border-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">
        Membership Level Thresholds
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((t, i) => (
          <div key={i} className={`bg-theme-surface-2 border-t-4 ${t.color} border-l border-r border-b border-theme-divider rounded-xl p-5 shadow-lg`}>
            <div className="font-bold text-sm text-theme-primary font-display mb-3">
              {t.name}
            </div>
            <div className="text-xs text-theme-muted space-y-1 font-mono">
              <div>Qualification: {t.requirement}</div>
              <div>Earnings rate: {t.multiplier}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
