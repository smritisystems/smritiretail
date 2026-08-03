/**
 * Project      : SMRITI Retail OS
 * Module       : Zone D â€” Quick Actions Bar Component
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { PlusCircle, ShoppingCart, Briefcase, Users, Building, Package, Truck, DollarSign, Printer, FileCode } from "lucide-react";
import { QuickActionRegistry } from "../registry/QuickActionRegistry.ts";

interface QuickActionsBarProps {
  onSelectTab: (tabId: string) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  ShoppingCart,
  Briefcase,
  Users,
  Building,
  Package,
  Truck,
  DollarSign,
  Printer,
  FileCode
};

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({ onSelectTab }) => {
  const actions = QuickActionRegistry.getAll();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-theme-divider pb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-[var(--c-seef-accent)] rounded-xs" />
          High-Frequency Quick Actions
        </h2>
        <span className="text-[11px] font-mono text-theme-muted">1-Click Operational Shortcuts</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-2">
        {actions.map((act) => {
          const IconComponent = ICON_MAP[act.iconName] || PlusCircle;
          return (
            <button
              key={act.id}
              onClick={() => {
                if (act.onClickAction) act.onClickAction();
                onSelectTab(act.targetTab);
              }}
              className="p-2.5 rounded-lg bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-divider hover:border-[var(--c-seef-accent)] text-xs font-medium text-theme-heading flex flex-col items-center justify-center gap-1.5 transition-all shadow-xs group cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-theme-surface-2 border border-theme-divider group-hover:scale-105 transition-transform text-[var(--c-seef-accent)]">
                <IconComponent className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-center truncate w-full">{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
