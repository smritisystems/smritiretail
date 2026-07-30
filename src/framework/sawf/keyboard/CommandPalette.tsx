/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Command Palette (Ctrl+K) Modal Component
 */

import React, { useState, useEffect } from "react";
import { Search, X, Command, User, Plus, CreditCard, Barcode, Printer, Save, FileText, CheckCircle2 } from "lucide-react";
import { SAWFCommandItem } from "../types/sawf.ts";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: SAWFCommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150">
      <div className="bg-[#161E2E] border border-[#1E293B] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-200">
        
        {/* Search input header */}
        <div className="p-4 border-b border-[#1E293B] flex items-center space-x-3 bg-[#121824]">
          <Search size={18} className="text-indigo-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type command or press shortcut (e.g. F2 Customer, F4 Payment, F6 Barcode)..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Commands List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching workspace commands found.
            </div>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className="w-full px-3 py-2.5 rounded-xl hover:bg-indigo-950/60 hover:border-indigo-800 border border-transparent flex items-center justify-between text-xs text-left transition cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[10px] font-mono text-slate-400 uppercase">
                    {cmd.category}
                  </span>
                  <span className="font-medium text-slate-100">{cmd.label}</span>
                </div>
                {cmd.shortcut && (
                  <span className="font-mono text-[10px] bg-[#1E293B] border border-slate-700 px-2 py-0.5 rounded text-indigo-300 font-bold">
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-[#121824] border-t border-[#1E293B] text-[10px] text-slate-500 flex justify-between items-center font-mono">
          <span>SAWF Command Palette</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
