/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.2.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { X, Keyboard, Command } from "lucide-react";

interface SmritiKeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmritiKeyboardShortcutsModal: React.FC<SmritiKeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: "Tab Navigation",
      items: [
        { key: "Alt + 1", desc: "Open View Configuration Tab" },
        { key: "Alt + 2", desc: "Open Item Details Entry Tab" },
        { key: "Alt + 3", desc: "Open Bulk Paste / Import Studio" },
        { key: "Alt + 4", desc: "Open Attributes Catalog" },
        { key: "Alt + 5", desc: "Open Image Path Config" },
        { key: "Alt + 6", desc: "Open Variant Templates" }
      ]
    },
    {
      title: "Grid & Data Editing",
      items: [
        { key: "F1", desc: "Show Keyboard Shortcuts Guide" },
        { key: "F2", desc: "Open Select Codes & SKU/Barcode Generator" },
        { key: "Ctrl + S / Ok", desc: "Save / Commit Items to PostgreSQL Database" },
        { key: "Ctrl + F / Replace", desc: "Open Find & Replace Data Utility" },
        { key: "Ctrl + V", desc: "Paste Multiple Rows from Excel / CSV" },
        { key: "Esc", desc: "Close Active Modal / Cancel Operation" }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#131b2e] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-[#191c1e] dark:text-[#eff1f3]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#eceef0] dark:border-[#2d3133] bg-[#f2f4f6] dark:bg-[#191c1e]">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[#0052cc]" />
            <h3 className="text-sm font-bold">Item Master Keyboard Shortcuts Guide</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#76777d] hover:text-[#191c1e] dark:hover:text-white p-1 rounded-md transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          {shortcutGroups.map((grp, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <h4 className="font-mono font-bold text-[11px] uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff]">
                {grp.title}
              </h4>
              <div className="bg-[#f7f9fb] dark:bg-[#191c1e] border border-[#eceef0] dark:border-[#2d3133] rounded-lg divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                {grp.items.map((item, iIdx) => (
                  <div key={iIdx} className="p-2.5 flex items-center justify-between">
                    <span className="font-semibold text-[#515f74] dark:text-[#bec6e0]">{item.desc}</span>
                    <kbd className="px-2 py-1 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold text-[11px] text-[#0052cc] dark:text-[#dae2ff] shadow-xs">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#eceef0] dark:border-[#2d3133] bg-[#f2f4f6] dark:bg-[#191c1e] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded font-bold text-xs shadow-xs transition"
          >
            Close (Esc)
          </button>
        </div>

      </div>
    </div>
  );
};

export default SmritiKeyboardShortcutsModal;
