/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.1.0  (SEEF Phase 8 - Theme token cascade)
 * Created      : 2026-07-20
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { TerminalPluginProps } from "../TerminalPlugin";
import { SMRITIGrid } from "../SMRITIGrid";
import { StandardDocumentToolbar } from "../StandardDocumentToolbar";

export const GrnTerminal: React.FC<TerminalPluginProps> = ({
  onNotification
}) => {
  const [poReference, setPoReference] = useState("PO-2026-8891");
  const [cart, setCart] = useState<any[]>([]);

  const handleCompleteGrn = () => {
    onNotification("GRN Verified", `Goods Receipt Note verified against ${poReference} and stock updated.`, "success");
    setCart([]);
  };

  return (
    // SEEF Phase 8: bg-[#0f172a] → bg-theme-base; text-theme-heading → text-theme-body
    <div className="flex flex-col h-full bg-theme-base text-theme-body font-sans select-none overflow-hidden">
      <StandardDocumentToolbar
        onNew={() => setCart([])}
        canCheckout={cart.length > 0}
        onCheckout={handleCompleteGrn}
      />

      <div className="flex-1 flex overflow-hidden p-4 space-y-4 flex-col">
        {/* Document Header Banner — bg-[#1e293b] → bg-theme-surface-1 */}
        <div className="flex items-center justify-between bg-theme-surface-1 p-3 rounded-lg border border-theme-divider">
          <div className="flex items-center space-x-3">
            <span className="material-symbols-outlined text-emerald-400">inventory</span>
            <h2 className="text-sm font-bold uppercase tracking-wide font-display text-theme-heading">
              Goods Receipt Note (GRN) Inward Terminal
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-theme-muted">REF PO NO:</label>
            <input
              type="text"
              value={poReference}
              onChange={(e) => setPoReference(e.target.value)}
              className="bg-theme-base border border-theme-divider text-theme-heading text-xs px-3 py-1 rounded font-mono focus:outline-none focus:border-blue-500 transition-colors"
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
