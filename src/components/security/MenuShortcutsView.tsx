/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.45.2  |  Created: 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Source Module: Security — Menu Shortcuts View
 * Storage      : localStorage["smriti_menu_shortcuts"] (client-only)
 */
import React, { useState, useEffect } from "react";
import { Star, Trash2, GripVertical, Plus, Save, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "smriti_menu_shortcuts";

interface Shortcut {
  id: string;
  label: string;
  tabId: string;
  icon: string;
}

const PRESET_TABS = [
  { tabId: "pos",                label: "Point of Sale",            icon: "point_of_sale" },
  { tabId: "sales-history",      label: "Sales History",            icon: "receipt_long" },
  { tabId: "inventory-browser",  label: "Inventory Browser",        icon: "inventory_2" },
  { tabId: "purchase-studio",    label: "Purchase Studio",          icon: "shopping_cart" },
  { tabId: "grn-studio",         label: "GRN Studio",               icon: "local_shipping" },
  { tabId: "barcode-studio",     label: "Barcode Studio",           icon: "qr_code" },
  { tabId: "report-designer",    label: "Report Designer",          icon: "insert_chart" },
  { tabId: "crm-studio",         label: "CRM Studio",               icon: "people" },
  { tabId: "security-management",label: "Security & Access",        icon: "security" },
  { tabId: "dispatch-studio",    label: "Dispatch Studio",          icon: "local_shipping" },
];

interface Notification { type: "success" | "error" | "warning"; message: string; }
interface Props { onNotification?: (n: Notification) => void; }

export const MenuShortcutsView: React.FC<Props> = ({ onNotification }) => {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setShortcuts(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const add = (tab: typeof PRESET_TABS[0]) => {
    if (shortcuts.some(s => s.tabId === tab.tabId)) return;
    setShortcuts(prev => [
      ...prev,
      { id: `${tab.tabId}-${Date.now()}`, label: tab.label, tabId: tab.tabId, icon: tab.icon },
    ]);
    setSaved(false);
  };

  const remove = (id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
    setSaved(false);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setShortcuts(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
    setSaved(false);
  };

  const moveDown = (idx: number) => {
    setShortcuts(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    setSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
      setSaved(true);
      onNotification?.({ type: "success", message: "Menu shortcuts saved successfully." });
      setTimeout(() => setSaved(false), 3000);
    } catch {
      onNotification?.({ type: "error", message: "Failed to save shortcuts." });
    }
  };

  const available = PRESET_TABS.filter(t => !shortcuts.some(s => s.tabId === t.tabId));

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a] font-display">Menu Shortcuts</h2>
            <p className="text-xs text-[#64748b] mt-0.5">Configure quick-access shortcuts that appear in your launchpad</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className={"flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] " + (saved ? "bg-emerald-600 text-white" : "bg-[#1e40af] hover:bg-[#1d4ed8] text-white")}
          >
            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? "Saved" : "Save Shortcuts"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Current shortcuts */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
              <p className="text-xs font-bold text-[#0f172a]">Your Shortcuts</p>
              <span className="text-[10px] font-mono text-[#94a3b8]">{shortcuts.length} active</span>
            </div>
            {shortcuts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                <Star size={28} className="mb-2 text-[#cbd5e1]" />
                <p className="text-xs">No shortcuts added yet.</p>
                <p className="text-[10px] mt-0.5">Add from the list on the right.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#f1f5f9]">
                {shortcuts.map((s, idx) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f8fafc] transition">
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0}
                        className="text-[#cbd5e1] hover:text-[#64748b] disabled:opacity-30 leading-none focus:outline-none" aria-label="Move up">
                        <span className="text-[9px]">▲</span>
                      </button>
                      <button type="button" onClick={() => moveDown(idx)} disabled={idx === shortcuts.length - 1}
                        className="text-[#cbd5e1] hover:text-[#64748b] disabled:opacity-30 leading-none focus:outline-none" aria-label="Move down">
                        <span className="text-[9px]">▼</span>
                      </button>
                    </div>
                    <GripVertical size={13} className="text-[#cbd5e1] shrink-0" />
                    <span className="material-symbols-outlined text-base text-[#1e40af]">{s.icon}</span>
                    <span className="flex-1 text-xs font-semibold text-[#0f172a]">{s.label}</span>
                    <button type="button" onClick={() => remove(s.id)} aria-label={`Remove ${s.label}`}
                      className="p-1.5 rounded-lg text-[#94a3b8] hover:text-rose-600 hover:bg-rose-50 transition focus:outline-none">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Available shortcuts */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-[#f1f5f9]">
              <p className="text-xs font-bold text-[#0f172a]">Available Modules</p>
            </div>
            {available.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
                <CheckCircle2 size={28} className="mb-2 text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-700">All modules added</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#f1f5f9]">
                {available.map(tab => (
                  <li key={tab.tabId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f8fafc] transition">
                    <span className="material-symbols-outlined text-base text-[#64748b]">{tab.icon}</span>
                    <span className="flex-1 text-xs font-semibold text-[#334155]">{tab.label}</span>
                    <button type="button" onClick={() => add(tab)} aria-label={`Add ${tab.label}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af] rounded-lg hover:bg-[#dbeafe] transition focus:outline-none">
                      <Plus size={11} /> Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="text-[10px] text-[#94a3b8] text-center">
          Shortcuts are stored in your browser profile and apply to your account only.
        </p>
      </div>
    </div>
  );
};

export default MenuShortcutsView;
