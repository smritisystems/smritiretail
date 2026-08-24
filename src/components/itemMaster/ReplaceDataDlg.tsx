/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { X, Replace, Search } from "lucide-react";

interface SmritiReplaceDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplace: (targetField: string, findText: string, replaceText: string, matchCase: boolean) => void;
  fields: { key: string; label: string }[];
}

export const ReplaceDataDlg: React.FC<SmritiReplaceDataModalProps> = ({
  isOpen,
  onClose,
  onReplace,
  fields
}) => {
  const [targetField, setTargetField] = useState<string>("ALL");
  const [findText, setFindText] = useState<string>("");
  const [replaceText, setReplaceText] = useState<string>("");
  const [matchCase, setMatchCase] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!findText) return;
    onReplace(targetField, findText, replaceText, matchCase);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#131b2e] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-[#191c1e] dark:text-[#eff1f3]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#eceef0] dark:border-[#2d3133] bg-[#f2f4f6] dark:bg-[#191c1e]">
          <div className="flex items-center gap-2">
            <Replace size={18} className="text-[#0052cc]" />
            <h3 className="text-sm font-bold">Replace Data Utility</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#76777d] hover:text-[#191c1e] dark:hover:text-white p-1 rounded-md transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Target Column / Field</label>
            <select
              value={targetField}
              onChange={e => setTargetField(e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold text-xs outline-none focus:ring-1 focus:ring-[#0052cc]"
            >
              <option value="ALL">All Editable Columns &amp; Attributes</option>
              {fields.map(f => (
                <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Find Text*</label>
            <input
              type="text"
              required
              value={findText}
              onChange={e => setFindText(e.target.value)}
              placeholder="e.g. Cotton 100%, Old Brand, S"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs outline-none focus:ring-1 focus:ring-[#0052cc]"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Replace With</label>
            <input
              type="text"
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              placeholder="e.g. Organic Cotton, New Brand, M"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs outline-none focus:ring-1 focus:ring-[#0052cc]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={e => setMatchCase(e.target.checked)}
                className="rounded"
              />
              <span>Match Case Exactly</span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#eceef0] dark:border-[#2d3133] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#76777d] rounded font-semibold text-xs hover:bg-[#eceef0] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
            >
              <Replace size={14} />
              Replace All Matches
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default ReplaceDataDlg;
