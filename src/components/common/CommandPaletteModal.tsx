/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : CommandPaletteModal (VS Code Style Ctrl+K Command Palette)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.5.0
 */

import React, { useState, useEffect } from "react";
import { Search, Command, ArrowRight, Zap, Box, User, CreditCard, ShoppingBag, Briefcase, FileText } from "lucide-react";
import { SUNEFKernel } from "../../navigation/SUNEFKernel.ts";

interface CommandItem {
  id: string;
  title: string;
  category: "Workspace" | "Action" | "Entity";
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");

  const commands: CommandItem[] = [
    {
      id: "cmd-pos",
      title: "Open Point of Sale (POS) Checkout Desk",
      category: "Workspace",
      icon: <CreditCard size={14} className="text-emerald-400" />,
      shortcut: "Ctrl+P",
      action: () => {
        SUNEFKernel.open({ type: "POS" });
        onClose();
      }
    },
    {
      id: "cmd-items",
      title: "Open Item Master & SKU Catalog Studio",
      category: "Workspace",
      icon: <Box size={14} className="text-blue-400" />,
      action: () => {
        SUNEFKernel.open({ type: "Item" });
        onClose();
      }
    },
    {
      id: "cmd-sales",
      title: "Open Sales Invoicing & Billing Studio",
      category: "Workspace",
      icon: <ShoppingBag size={14} className="text-amber-400" />,
      action: () => {
        SUNEFKernel.open({ type: "Invoice" });
        onClose();
      }
    },
    {
      id: "cmd-purchase",
      title: "Open Procurement & Purchase Orders",
      category: "Workspace",
      icon: <Briefcase size={14} className="text-purple-400" />,
      action: () => {
        SUNEFKernel.open({ type: "PurchaseOrder" });
        onClose();
      }
    },
    {
      id: "cmd-identity",
      title: "Open Identity 360 & Provisioning Studio",
      category: "Workspace",
      icon: <User size={14} className="text-cyan-400" />,
      action: () => {
        SUNEFKernel.open({ type: "Identity" });
        onClose();
      }
    },
    {
      id: "cmd-home",
      title: "Go to Home Launchpad Dashboard",
      category: "Action",
      icon: <Zap size={14} className="text-amber-300" />,
      shortcut: "Ctrl+H",
      action: () => {
        SUNEFKernel.goHome();
        onClose();
      }
    },
    {
      id: "cmd-refresh",
      title: "Execute Smart Refresh (Preserve Drafts)",
      category: "Action",
      icon: <FileText size={14} className="text-theme-body" />,
      shortcut: "Ctrl+R",
      action: () => {
        SUNEFKernel.smartRefresh();
        onClose();
      }
    }
  ];

  const filteredCommands = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) || c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-xl bg-theme-surface-2 border border-theme-divider rounded-2xl shadow-2xl overflow-hidden font-sans text-theme-heading animate-in fade-in zoom-in-95 duration-150">
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme-divider bg-theme-surface-3">
          <Command size={18} className="text-blue-400" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command, workspace, or entity search (e.g. POS, Items, Identity)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 font-medium"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-theme-surface-2 text-theme-muted rounded border border-theme-divider">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-theme-muted text-xs font-mono">
              No matching commands or workspaces found for "{query}".
            </div>
          ) : (
            filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-theme-surface-2 transition-all flex items-center justify-between group cursor-pointer border border-transparent hover:border-theme-divider"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-theme-surface-2 group-hover:bg-theme-surface-hover transition-colors">
                    {cmd.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-theme-heading group-hover:text-white transition-colors">
                      {cmd.title}
                    </div>
                    <div className="text-[10px] font-mono text-theme-muted capitalize">{cmd.category}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cmd.shortcut && (
                    <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-theme-surface-2 text-theme-muted rounded border border-theme-divider">
                      {cmd.shortcut}
                    </kbd>
                  )}
                  <ArrowRight size={14} className="text-theme-muted group-hover:text-blue-400 transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-theme-divider bg-theme-surface-3 flex items-center justify-between text-[11px] text-theme-muted font-mono">
          <span>SMRITI Command Palette v3.5</span>
          <span>Press ↑↓ to navigate, ENTER to select</span>
        </div>
      </div>
    </div>
  );
};
