/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.12.0
 * Created      : 2026-08-24
 * Modified     : 2026-09-07
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import {
  Receipt,
  MapPin,
  Clock,
  HelpCircle,
  Users,
  Package,
  BarChart3,
  Tag,
  Settings,
  Plus,
  Save,
  Trash2,
  Printer,
  Search,
  LogOut,
  Loader2
} from "lucide-react";
import { ExportButton } from "../../export/ExportButton.tsx";
import { ExportColumnDefinition } from "../../export/types.ts";

export interface TaxHeaderBarolbarProps {
  onNew: () => void;
  onSave: () => void;
  onDelete: () => void;
  onPrint: () => void;
  onFind: () => void;
  onExit: () => void;
  isSaving?: boolean;
  canDelete?: boolean;
  exportColumns: ExportColumnDefinition[];
  exportData: any[];
  currentUser?: { role: string; name: string } | null;
}

export const TaxHeaderBar: React.FC<TaxHeaderBarolbarProps> = ({
  onNew,
  onSave,
  onDelete,
  onPrint,
  onFind,
  onExit,
  isSaving = false,
  canDelete = false,
  exportColumns,
  exportData,
  currentUser,
}) => {
  const [currentDateTime, setCurrentDateTime] = useState({
    date: new Date().toLocaleDateString("en-GB"),
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentDateTime({
        date: now.toLocaleDateString("en-GB"),
        time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const cashierName = currentUser?.name || "John Doe";
  const cashierInitials = cashierName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="bg-[#0b2444] text-white flex-none border-b border-[#133763] shadow-sm z-30 select-none" data-purpose="app-shell-header">
      <div className="flex items-center justify-between px-3 h-12 w-full">
        {/* Left: Brand and Core Module Tabs */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5">
            {/* SMRITI Logo Symbol */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black tracking-tighter text-white text-base shadow-sm">
              <span>S</span>
            </div>
            <div>
              <span className="text-base font-black tracking-wider uppercase bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent leading-none block">
                SMRITI
              </span>
              <span className="text-[9px] block tracking-widest text-cyan-300 font-semibold uppercase leading-tight">
                RETAIL OS
              </span>
            </div>
          </div>

          {/* Main Navigation Bar */}
          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center space-x-1">
            <button
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#0066cc] text-white font-medium text-xs shadow-inner cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>Billing</span>
            </button>
            <button
              type="button"
              onClick={onFind}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-medium text-xs cursor-pointer"
            >
              <Users className="w-4 h-4 text-slate-400" />
              <span>Customers (F2)</span>
            </button>
            <button
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-medium text-xs cursor-pointer"
            >
              <Package className="w-4 h-4 text-slate-400" />
              <span>Products</span>
            </button>
            <button
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-medium text-xs cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span>Reports</span>
            </button>
            <button
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-medium text-xs cursor-pointer"
            >
              <Tag className="w-4 h-4 text-slate-400" />
              <span>Promotions</span>
            </button>
            <button
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-medium text-xs cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Right: Operational Status & Current User Meta */}
        <div className="flex items-center space-x-4 text-xs">
          {/* Store / Location Context */}
          <div className="hidden sm:flex items-center space-x-1.5 text-slate-300 border-r border-slate-700/60 pr-3">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <div className="leading-tight">
              <span className="font-medium text-slate-200 block">Reliance Demo Co.</span>
              <span className="text-[10px] text-slate-400 block">Mumbai HO</span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="hidden md:flex items-center space-x-1.5 text-slate-300 border-r border-slate-700/60 pr-3 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <div className="leading-tight">
              <div className="text-slate-200">{currentDateTime.date}</div>
              <div className="text-[10px] text-slate-400">{currentDateTime.time}</div>
            </div>
          </div>

          {/* Shift Badge */}
          <div className="flex items-center space-x-1.5 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-full text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium text-[11px]">
              Shift Active <span className="font-mono font-bold">REG-01</span>
            </span>
          </div>

          {/* User Profile Avatar */}
          <div className="flex items-center space-x-2 border-l border-slate-700/60 pl-3">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs shadow">
              {cashierInitials}
            </div>
            <div className="hidden xl:block leading-none text-left">
              <div className="font-medium text-slate-200">{cashierName}</div>
              <div className="text-[10px] text-slate-400 font-mono">EMP001</div>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center space-x-1 border-l border-slate-700/60 pl-2">
            <button
              type="button"
              onClick={onNew}
              title="New Invoice (Ctrl+N)"
              className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              title="Save Invoice (Ctrl+S / F8)"
              className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-white/10 rounded transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onPrint}
              title="Print (Ctrl+P)"
              className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Clear Draft"
              className="p-1 text-rose-400 hover:text-rose-300 hover:bg-white/10 rounded transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <ExportButton
              columns={exportColumns}
              data={exportData}
              moduleTitle="Smriti Distributor Tax Invoice"
            />
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                title="Exit (Esc)"
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
