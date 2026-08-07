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
    // POS Reference Header: taller, glassy, soft shadow (design freeze for POS)
    <div
      style={{ height: 56, background: 'var(--workspace-toolbar-bg)', backdropFilter: 'blur(6px)', boxShadow: '0 8px 20px rgba(2,8,20,0.45)' }}
      className="px-4 flex items-center justify-between shrink-0 font-sans select-none"
    >
      {/* Primary Actions */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onNew}
          className="flex items-center space-x-1.5 bg-[var(--sds-color-primary)] hover:bg-[var(--sds-color-primary-hover)] text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
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
          className="flex items-center space-x-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider text-theme-body text-xs font-semibold px-3 py-1.5 rounded transition-colors cursor-pointer"
          title="Universal Search"
        >
          <span className="material-symbols-outlined text-sm text-emerald-400">search</span>
          <span>Search</span>
        </button>
      </div>

      {/* Drawer Triggers */}
      {onToggleDrawer && (
        <div className="flex items-center space-x-2">
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
          style={{ boxShadow: canCheckout ? '0 8px 30px rgba(16,185,129,0.16)' : undefined }}
          className={`flex items-center space-x-1.5 text-sm font-bold uppercase px-4 py-2 rounded-lg transition-colors ${
            canCheckout
              ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              : "bg-theme-surface-2 text-theme-muted border border-theme-divider cursor-not-allowed"
          }`}
          title="Checkout & Pay (F12)"
        >
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>Checkout</span>
        </button>
      )}
    </div>
  );
};
