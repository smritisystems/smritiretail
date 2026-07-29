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

import React from "react";

interface StandardDocumentToolbarProps {
  onNew?: () => void;
  onSave?: () => void;
  onHold?: () => void;
  onRecall?: () => void;
  onImport?: () => void;
  onPrint?: () => void;
  onHistory?: () => void;
  onToggleDrawer?: (drawerId: string) => void;
  activeDrawerId?: string | null;
  onSearchClick?: () => void;
  canCheckout?: boolean;
  onCheckout?: () => void;
}

export const StandardDocumentToolbar: React.FC<StandardDocumentToolbarProps> = ({
  onNew,
  onSave,
  onHold,
  onRecall,
  onImport,
  onPrint,
  onHistory,
  onToggleDrawer,
  activeDrawerId,
  onSearchClick,
  canCheckout,
  onCheckout
}) => {
  return (
    // SEEF Phase 8: bg-[#1e293b] → bg-theme-surface-1; border-theme-divider → border-theme-divider
    <div className="h-12 bg-theme-surface-1 border-b border-theme-divider px-4 flex items-center justify-between shrink-0 font-sans select-none">
      {/* Primary Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onNew}
          className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
          title="New Document (ESC / Alt+N)"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>New</span>
        </button>

        {onHold && (
          <button
            onClick={onHold}
            className="flex items-center space-x-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider text-theme-body text-xs font-semibold px-3 py-1.5 rounded transition-colors"
            title="Hold Current Bill (F2)"
          >
            <span className="material-symbols-outlined text-sm text-amber-400">pause</span>
            <span>Hold</span>
          </button>
        )}

        {onRecall && (
          <button
            onClick={onRecall}
            className="flex items-center space-x-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider text-theme-body text-xs font-semibold px-3 py-1.5 rounded transition-colors"
            title="Recall Held Bill"
          >
            <span className="material-symbols-outlined text-sm text-blue-400">restore</span>
            <span>Recall</span>
          </button>
        )}

        <button
          onClick={onSearchClick}
          className="flex items-center space-x-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider text-theme-body text-xs font-semibold px-3 py-1.5 rounded transition-colors"
          title="Universal Search (Ctrl+K)"
        >
          <span className="material-symbols-outlined text-sm text-emerald-400">search</span>
          <span>Search</span>
          <kbd className="bg-theme-base px-1 py-0.5 rounded text-[9px] font-mono text-theme-muted border border-theme-divider">Ctrl+K</kbd>
        </button>
      </div>

      {/* Drawer Triggers */}
      {onToggleDrawer && (
        <div className="flex items-center space-x-1.5">
          {[
            { id: "transport",   icon: "local_shipping", label: "Transport",   title: "Transport & E-Way Bill Details" },
            { id: "gst",         icon: "receipt",        label: "GST",         title: "GSTIN & Tax Details" },
            { id: "coupons",     icon: "local_offer",    label: "Promos",      title: "Promotions & Loyalty Coupons" },
            { id: "salesperson", icon: "badge",          label: "Salesperson", title: "Salesperson & Commission Assignment" },
            { id: "remarks",     icon: "notes",          label: "Remarks",     title: "Remarks & Attachments" },
          ].map(({ id, icon, label, title }) => (
            <button
              key={id}
              onClick={() => onToggleDrawer(id)}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${
                activeDrawerId === id
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-theme-surface-2 border-theme-divider text-theme-muted hover:bg-theme-surface-3 hover:text-theme-body"
              }`}
              title={title}
            >
              <span className="material-symbols-outlined text-sm">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Checkout / Finish Action */}
      {onCheckout && (
        <button
          disabled={!canCheckout}
          onClick={onCheckout}
          className={`flex items-center space-x-1.5 text-xs font-bold uppercase px-4 py-1.5 rounded transition-colors ${
            canCheckout
              ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-900/30"
              : "bg-theme-surface-2 text-theme-muted border border-theme-divider cursor-not-allowed"
          }`}
          title="Checkout & Pay (F12)"
        >
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>Checkout (F12)</span>
        </button>
      )}
    </div>
  );
};
