/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS & SMRITI Systems
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.18.0
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Description  : Define Bill Prefix & Prefix Management Studio Modal (Shoper 9 Parity & GST Rule 46b Compliance)
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  SmritiBillPrefixService,
  BillPrefixDefinition,
  TransactionGroup,
  validateGstRule46b,
  formatBillPreview
} from "../../services/smritiBillPrefixService.ts";

interface SmritiDefineBillPrefixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  terminalId?: string;
  companyCode?: string;
}

export const SmritiDefineBillPrefixModal: React.FC<SmritiDefineBillPrefixModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  terminalId = "COMMON",
  companyCode = "SMRITI"
}) => {
  const [selectionType, setSelectionType] = useState<"GROUP" | "TRANSACTION">("GROUP");
  const [selectedGroup, setSelectedGroup] = useState<TransactionGroup>("SALES");
  const [selectedTerminal, setSelectedTerminal] = useState<string>(terminalId || "COMMON");
  const [useCompanyCode, setUseCompanyCode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Year End Rollover Dialog state
  const [showYearEndDialog, setShowYearEndDialog] = useState<boolean>(false);
  const [newFyInput, setNewFyInput] = useState<string>("2026-2027");
  const [newYearSuffixInput, setNewYearSuffixInput] = useState<string>("26-27");
  const [resetToStartNumber, setResetToStartNumber] = useState<boolean>(true);

  // Prefix definitions state
  const [definitions, setDefinitions] = useState<BillPrefixDefinition[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    loadPrefixes();
  }, [isOpen, selectedTerminal]);

  const loadPrefixes = async () => {
    setIsLoading(true);
    try {
      const data = await SmritiBillPrefixService.getAllPrefixes({ terminalId: selectedTerminal });
      if (data && data.length > 0) {
        setDefinitions(data);
      } else {
        setDefinitions(SmritiBillPrefixService.getDefaultDefinitions(selectedTerminal, selectedTerminal === "COMMON", useCompanyCode ? companyCode : ""));
      }
    } catch {
      setDefinitions(SmritiBillPrefixService.getDefaultDefinitions(selectedTerminal, selectedTerminal === "COMMON", useCompanyCode ? companyCode : ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowChange = (index: number, field: keyof BillPrefixDefinition, value: any) => {
    setDefinitions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const filteredDefinitions = useMemo(() => {
    if (selectionType === "GROUP") {
      return definitions.filter(d => d.transactionGroup === selectedGroup);
    }
    return definitions;
  }, [definitions, selectionType, selectedGroup]);

  const handleSave = async () => {
    // Validate GST Rule 46(b) for all rows
    for (const item of definitions) {
      const padded = (item.startNumber || 1).toString().padStart(item.runningLength || 4, "0");
      const gst = validateGstRule46b(item.prefix, padded, item.suffix);
      if (!gst.isValid) {
        setToastMessage({
          text: `Cannot save: ${item.name} violates GST Rule 46(b): ${gst.error}`,
          type: "error"
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      await SmritiBillPrefixService.saveBatch({
        terminalId: selectedTerminal,
        isCommonAcrossTerminals: selectedTerminal === "COMMON",
        companyCodeAsPrefix: useCompanyCode,
        items: definitions
      });
      setToastMessage({ text: "Bill prefix configurations saved successfully.", type: "success" });
      onSaved?.();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setToastMessage({ text: err?.message || "Failed to save bill prefix definitions.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyCompanyCodeToggle = (checked: boolean) => {
    setUseCompanyCode(checked);
    const prefixToAdd = `${companyCode}/`;
    setDefinitions(prev =>
      prev.map(d => {
        let cleanPfx = d.prefix || "";
        if (checked && !cleanPfx.startsWith(prefixToAdd)) {
          cleanPfx = `${prefixToAdd}${cleanPfx}`;
        } else if (!checked && cleanPfx.startsWith(prefixToAdd)) {
          cleanPfx = cleanPfx.slice(prefixToAdd.length);
        }
        return { ...d, prefix: cleanPfx };
      })
    );
  };

  const handleExecuteYearEnd = async () => {
    try {
      await SmritiBillPrefixService.executeYearEndRollover({
        newFinancialYear: newFyInput,
        newYearSuffix: newYearSuffixInput,
        resetToStartNumber
      });
      setShowYearEndDialog(false);
      setToastMessage({ text: `Year End Process completed. Rollover to FY ${newFyInput} applied.`, type: "success" });
      await loadPrefixes();
      onSaved?.();
    } catch (err: any) {
      setToastMessage({ text: err?.message || "Year End Process failed.", type: "error" });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-label="Prefix Management"
        className="bg-white dark:bg-[#1e2022] text-[#191c1e] dark:text-[#e1e2e5] border border-[#c4c5d5] dark:border-[#444653] rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c5d5] dark:border-[#444653] bg-[#f3f4f5] dark:bg-[#2d3133]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#00288e] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              #
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Prefix Management</h2>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">
                Define document prefixes, starting sequence numbers, and GST Rule 46(b) serialization
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowYearEndDialog(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-[#4b5563] text-white hover:bg-[#374151] transition shadow-sm"
              title="Supervisory Functions: Year End Financial Rollover"
            >
              Year End Process
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#565e74] hover:text-[#191c1e] dark:text-[#bec6e0] dark:hover:text-white rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="px-6 py-3 border-b border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#232628] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            {/* Selection Type */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#565e74] dark:text-[#bec6e0]">Selection:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="selectionType"
                  checked={selectionType === "GROUP"}
                  onChange={() => setSelectionType("GROUP")}
                  className="accent-[#00288e]"
                />
                Group Wise
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="selectionType"
                  checked={selectionType === "TRANSACTION"}
                  onChange={() => setSelectionType("TRANSACTION")}
                  className="accent-[#00288e]"
                />
                Transaction Wise
              </label>
            </div>

            {/* Group Tabs */}
            {selectionType === "GROUP" && (
              <div className="flex items-center rounded-lg border border-[#c4c5d5] dark:border-[#444653] overflow-hidden">
                {(["SALES", "CASH", "SLIPS"] as TransactionGroup[]).map(grp => (
                  <button
                    key={grp}
                    onClick={() => setSelectedGroup(grp)}
                    className={`px-3 py-1 font-semibold transition ${
                      selectedGroup === grp
                        ? "bg-[#00288e] text-white"
                        : "bg-white dark:bg-[#1e2022] text-[#565e74] dark:text-[#bec6e0] hover:bg-black/5"
                    }`}
                  >
                    {grp === "SALES" ? "Sales Group" : grp === "CASH" ? "Cash Group" : "Slip Group"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Terminal Node Selector */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#565e74] dark:text-[#bec6e0]">Terminal:</span>
              <select
                value={selectedTerminal}
                onChange={e => setSelectedTerminal(e.target.value)}
                className="border border-[#c4c5d5] dark:border-[#444653] rounded px-2 py-1 bg-white dark:bg-[#1e2022] font-semibold"
              >
                <option value="COMMON">All Terminals (Common)</option>
                <option value="POS-01">Terminal 01 (POS-01)</option>
                <option value="POS-02">Terminal 02 (POS-02)</option>
                <option value="POS-03">Terminal 03 (POS-03)</option>
              </select>
            </div>

            {/* Company Code Prefix Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useCompanyCode}
                onChange={e => handleApplyCompanyCodeToggle(e.target.checked)}
                className="accent-[#00288e] rounded"
              />
              <span>Company Code as part of Prefix</span>
            </label>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="px-6 py-2 bg-[#dde1ff]/40 dark:bg-[#00288e]/20 border-b border-[#c4c5d5] dark:border-[#444653] flex items-center justify-between text-[11px] text-[#00288e] dark:text-[#a8b8ff]">
          <span>
            <strong>Statutory GST Rule 46(b) Guard:</strong> Serial numbers must not exceed 16 characters and contain only [A-Za-z0-9/-].
          </span>
          <span>{filteredDefinitions.length} prefix schemes loaded</span>
        </div>

        {/* Data Grid */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-sm text-[#565e74]">
              Loading prefix definitions...
            </div>
          ) : (
            <div className="border border-[#c4c5d5] dark:border-[#444653] rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f3f4f5] dark:bg-[#2d3133] text-[#565e74] dark:text-[#bec6e0] uppercase text-[10px] tracking-wider border-b border-[#c4c5d5] dark:border-[#444653]">
                  <tr>
                    <th className="px-3 py-2.5 font-bold">Transaction Name</th>
                    <th className="px-3 py-2.5 font-bold">Prefix</th>
                    <th className="px-3 py-2.5 font-bold">Suffix (Year No.)</th>
                    <th className="px-2 py-2.5 font-bold text-center">Start No</th>
                    <th className="px-2 py-2.5 font-bold text-center">Padding</th>
                    <th className="px-3 py-2.5 font-bold">Combined Preview</th>
                    <th className="px-2 py-2.5 font-bold text-center">Rule 46(b)</th>
                    <th className="px-2 py-2.5 font-bold text-center">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c4c5d5] dark:divide-[#444653]">
                  {Array.from(
                    new Map(filteredDefinitions.map(r => [r.documentType, r])).values()
                  ).map((row) => {
                    const actualIdx = definitions.findIndex(d => d.documentType === row.documentType);
                    const padded = (row.startNumber || 1).toString().padStart(row.runningLength || 4, "0");
                    const preview = formatBillPreview(row.prefix, row.startNumber || 1, row.suffix, row.runningLength || 4);
                    const gst = validateGstRule46b(row.prefix, padded, row.suffix);

                    return (
                      <tr key={row.id ?? row.documentType} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                        <td className="px-3 py-2 font-medium">
                          <div>{row.name}</div>
                          <div className="text-[10px] text-[#565e74] dark:text-[#bec6e0] font-mono">
                            {row.documentType}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.prefix}
                            onChange={e => handleRowChange(actualIdx, "prefix", e.target.value.toUpperCase())}
                            className="w-24 border border-[#c4c5d5] dark:border-[#444653] rounded px-2 py-1 font-mono text-xs bg-white dark:bg-[#1e2022] outline-none focus:border-[#00288e]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.suffix}
                            onChange={e => handleRowChange(actualIdx, "suffix", e.target.value)}
                            className="w-24 border border-[#c4c5d5] dark:border-[#444653] rounded px-2 py-1 font-mono text-xs bg-white dark:bg-[#1e2022] outline-none focus:border-[#00288e]"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={row.startNumber}
                            onChange={e => handleRowChange(actualIdx, "startNumber", parseInt(e.target.value) || 1)}
                            className="w-16 border border-[#c4c5d5] dark:border-[#444653] rounded px-1 py-1 font-mono text-xs bg-white dark:bg-[#1e2022] text-center outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <select
                            value={row.runningLength}
                            onChange={e => handleRowChange(actualIdx, "runningLength", parseInt(e.target.value))}
                            className="border border-[#c4c5d5] dark:border-[#444653] rounded px-1 py-1 text-xs bg-white dark:bg-[#1e2022]"
                          >
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                            <option value={5}>5</option>
                            <option value={6}>6</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-mono font-bold text-[#00288e] dark:text-[#a8b8ff] text-xs">
                            {preview}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              gst.isValid
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                            title={gst.error || "Valid GST Rule 46(b) document sequence"}
                          >
                            {gst.length}/16 {gst.isValid ? "✓" : "✗"}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={row.isActive}
                            onChange={e => handleRowChange(actualIdx, "isActive", e.target.checked)}
                            className="accent-[#00288e] rounded"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Toast / Notification Banner */}
        {toastMessage && (
          <div
            className={`px-6 py-2 text-xs font-semibold flex items-center justify-between ${
              toastMessage.type === "success"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : toastMessage.type === "error"
                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
            }`}
          >
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="text-xs">✕</button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#232628]">
          <button
            onClick={() => setDefinitions(SmritiBillPrefixService.getDefaultDefinitions(selectedTerminal, selectedTerminal === "COMMON", useCompanyCode ? companyCode : ""))}
            className="px-4 py-2 rounded text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              Exit
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 rounded text-xs font-bold bg-[#00288e] text-white hover:bg-[#002075] transition shadow-md disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Prefixes"}
            </button>
          </div>
        </div>

        {/* Year End Rollover Sub-dialog */}
        {showYearEndDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-[#1e2022] border border-[#c4c5d5] dark:border-[#444653] rounded-xl shadow-2xl p-6 max-w-md w-full space-y-4">
              <h3 className="text-sm font-bold text-[#191c1e] dark:text-white">
                Supervisory Year End Process
              </h3>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">
                This option increments document suffixes to the new financial year and resets starting document numbers to 1.
              </p>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-[#565e74] dark:text-[#bec6e0] block mb-1">
                    New Financial Year
                  </label>
                  <input
                    type="text"
                    value={newFyInput}
                    onChange={e => setNewFyInput(e.target.value)}
                    placeholder="2026-2027"
                    className="w-full border border-[#c4c5d5] dark:border-[#444653] rounded px-3 py-1.5 bg-white dark:bg-[#191c1e] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#565e74] dark:text-[#bec6e0] block mb-1">
                    New Year Suffix
                  </label>
                  <input
                    type="text"
                    value={newYearSuffixInput}
                    onChange={e => setNewYearSuffixInput(e.target.value)}
                    placeholder="26-27"
                    className="w-full border border-[#c4c5d5] dark:border-[#444653] rounded px-3 py-1.5 bg-white dark:bg-[#191c1e] outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={resetToStartNumber}
                    onChange={e => setResetToStartNumber(e.target.checked)}
                    className="accent-[#00288e] rounded"
                  />
                  <span>Reset Document Numbers to Start Number (1)</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowYearEndDialog(false)}
                  className="px-3 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteYearEnd}
                  className="px-4 py-1.5 bg-[#00288e] text-white rounded text-xs font-bold hover:bg-[#002075]"
                >
                  Confirm Rollover
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
