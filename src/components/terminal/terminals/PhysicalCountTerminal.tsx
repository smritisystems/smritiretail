/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { TerminalPluginProps } from "../TerminalPlugin";
import { SMRITIGrid } from "../SMRITIGrid";
import { StandardDocumentToolbar } from "../StandardDocumentToolbar";

export const PhysicalCountTerminal: React.FC<TerminalPluginProps> = ({
  onNotification
}) => {
  const [auditBatchNo, setAuditBatchNo] = useState("AUD-2026-Q3");
  const [cart, setCart] = useState<any[]>([]);

  const handlePostAudit = () => {
    onNotification("Physical Audit Posted", `Stock count batch ${auditBatchNo} verified and ledger variance posted.`, "success");
    setCart([]);
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 font-sans select-none overflow-hidden">
      <StandardDocumentToolbar
        onNew={() => setCart([])}
        canCheckout={cart.length > 0}
        onCheckout={handlePostAudit}
      />

      <div className="flex-1 flex overflow-hidden p-4 space-y-4 flex-col">
        <div className="flex items-center justify-between bg-[#1e293b] p-3 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-3">
            <span className="material-symbols-outlined text-amber-400">fact_check</span>
            <h2 className="text-sm font-bold uppercase tracking-wide font-display text-white">
              Physical Stock Audit & Handheld Counting Terminal
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-400">AUDIT BATCH NO:</label>
            <input
              type="text"
              value={auditBatchNo}
              onChange={(e) => setAuditBatchNo(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs px-3 py-1 rounded font-mono"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <SMRITIGrid
            cart={cart}
            onUpdateQuantity={(id, q) => setCart(prev => prev.map(i => i.product.id === id ? { ...i, quantity: q } : i))}
            onRemoveItem={(id) => setCart(prev => prev.filter(i => i.product.id !== id))}
          />
        </div>
      </div>
    </div>
  );
};
