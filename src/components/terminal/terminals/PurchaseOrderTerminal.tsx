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
import { RightDrawerHost } from "../RightDrawerHost";
import { UniversalSearchModal } from "../UniversalSearchModal";

export const PurchaseOrderTerminal: React.FC<TerminalPluginProps> = ({
  currentUser,
  activeShift,
  activeProfile,
  onNotification,
  onClose
}) => {
  const [supplierName, setSupplierName] = useState("VRL Suppliers Ltd");
  const [cart, setCart] = useState<any[]>([]);
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleCheckout = () => {
    onNotification("Purchase Order Created", `PO successfully generated for ${supplierName}`, "success");
    setCart([]);
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100 font-sans select-none overflow-hidden">
      <StandardDocumentToolbar
        onNew={() => setCart([])}
        onSearchClick={() => setIsSearchOpen(true)}
        onToggleDrawer={(id) => setActiveDrawerId(prev => prev === id ? null : id)}
        activeDrawerId={activeDrawerId}
        canCheckout={cart.length > 0}
        onCheckout={handleCheckout}
      />

      <div className="flex-1 flex overflow-hidden p-4 space-y-4 flex-col">
        <div className="flex items-center justify-between bg-[#1e293b] p-3 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-3">
            <span className="material-symbols-outlined text-blue-400">shopping_cart</span>
            <h2 className="text-sm font-bold uppercase tracking-wide font-display text-white">
              Purchase Order Operational Terminal
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-400">SUPPLIER:</label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
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

      <UniversalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={[]}
        onSelectProduct={(p) => setCart(prev => [...prev, { product: p, quantity: 1 }])}
      />

      <RightDrawerHost
        activeDrawerId={activeDrawerId}
        onSave={() => setActiveDrawerId(null)}
        onClose={() => setActiveDrawerId(null)}
      />
    </div>
  );
};
