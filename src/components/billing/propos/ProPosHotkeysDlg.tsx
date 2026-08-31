/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { X, Keyboard, Check, Command } from "lucide-react";

interface SmritiProPosHotkeysDlgProps {
  onClose: () => void;
}

const HOTKEY_GROUPS = [
  {
    category: "POS Core Activities",
    items: [
      { key: "Alt + 1", desc: "Create a new bill (reset terminal / new transaction)" },
      { key: "Alt + 2", desc: "Void / Cancel a bill generated earlier" },
      { key: "Alt + 3", desc: "Record sales return WITH reference to earlier invoice" },
      { key: "Alt + 5", desc: "Record sales return WITHOUT reference (blind return)" },
      { key: "Alt + 6", desc: "Reprint an existing bill or sales return document" },
      { key: "Alt + H", desc: "Show Hotkeys and shortcuts reference guide" }
    ]
  },
  {
    category: "Payment & Settlement",
    items: [
      { key: "F7", desc: "Exact Cash settlement and immediate confirmation" },
      { key: "F8", desc: "Open Multi-Tender Settlement modal (Split payment)" },
      { key: "F9", desc: "Display and toggle bill total values breakdown" },
      { key: "F10", desc: "Instant Settle & Print Tax Invoice receipt" }
    ]
  },
  {
    category: "Header & Customer Search",
    items: [
      { key: "F2", desc: "Open Customer Browse & Search Window" },
      { key: "Alt + S", desc: "Hold / Suspend current active cart to queue" },
      { key: "Alt + R", desc: "Recall suspended bills or sales advice slips" },
      { key: "Alt + I", desc: "Open PDT Import window (File or Transaction)" }
    ]
  },
  {
    category: "Direct Entry Grid Navigation",
    items: [
      { key: "Enter", desc: "Accept item from Direct Entry Grid into Item Details Grid" },
      { key: "Tab", desc: "Advance focus between Stock No, Qty, Rate, and Disc cells" }
    ]
  }
];

export const SmritiProPosHotkeysDlg: React.FC<SmritiProPosHotkeysDlgProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#c4c5d5] dark:border-[#444653] max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#00288e] text-white rounded-lg">
              <Keyboard size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#191c1d] dark:text-white">POS Hot Keys &amp; Shortcuts [Alt+H]</h3>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">Standard Shoper 9 retail keyboard shortcuts &amp; quick action triggers.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-[#565e74] hover:bg-[#f3f4f5] p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {HOTKEY_GROUPS.map((grp, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#00288e] dark:text-[#a8b8ff] pb-1 border-b border-[#eceef0] dark:border-[#2d3133]">
                {grp.category}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {grp.items.map((item, iIdx) => (
                  <div 
                    key={iIdx} 
                    className="flex items-center justify-between p-2 rounded-lg bg-[#f8f9fa] dark:bg-[#131b2e] border border-[#eceef0] dark:border-[#2d3133]"
                  >
                    <span className="text-xs text-[#191c1d] dark:text-white">{item.desc}</span>
                    <kbd className="px-2 py-0.5 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] rounded text-xs font-mono font-bold text-[#00288e] dark:text-[#a8b8ff] shadow-2xs">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-[#00288e] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] transition"
          >
            Close [Esc]
          </button>
        </div>

      </div>
    </div>
  );
};

export default SmritiProPosHotkeysDlg;
