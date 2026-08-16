/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, AlertTriangle, HelpCircle, XCircle, ArrowRight,
  BookmarkPlus, Save, Trash2, X, Check, Tag, Eye
} from "lucide-react";
import { SmritiFieldDefinition, ColumnMappingResult, HeaderMappingEngineResult, SavedMappingProfile } from "../lib/headerMapping/types";
import { SMRITI_ITEM_MASTER_FIELDS, addCustomAlias, removeCustomAlias, getCustomAliases } from "../lib/headerMapping/HeaderAliasRegistry";
import { defaultHeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine";

interface HeaderMappingPreviewModalProps {
  isOpen: boolean;
  mappingResult: HeaderMappingEngineResult | null;
  availableFields?: SmritiFieldDefinition[];
  sampleRows?: string[][];
  onConfirm: (finalMappings: ColumnMappingResult[]) => void;
  onClose: () => void;
}

export const HeaderMappingPreviewModal: React.FC<HeaderMappingPreviewModalProps> = ({
  isOpen,
  mappingResult,
  availableFields = SMRITI_ITEM_MASTER_FIELDS,
  sampleRows = [],
  onConfirm,
  onClose
}) => {
  const fields = availableFields;
  const [columns, setColumns] = useState<ColumnMappingResult[]>([]);
  const [savedProfiles, setSavedProfiles] = useState<SavedMappingProfile[]>([]);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  const [savedAliasNotice, setSavedAliasNotice] = useState<string | null>(null);
  const [rememberAliasesCheckbox, setRememberAliasesCheckbox] = useState(true);

  const handleConfirmMapping = () => {
    if (rememberAliasesCheckbox) {
      columns.forEach(col => {
        if (col.mappedFieldKey && col.sourceHeader) {
          addCustomAlias(col.mappedFieldKey, col.sourceHeader);
        }
      });
    }
    onConfirm(columns);
  };

  const handleSaveAliasForField = (sourceHeader: string, targetFieldKey: string) => {
    addCustomAlias(targetFieldKey, sourceHeader);
    const targetField = fields.find(f => f.key === targetFieldKey);
    const targetLabel = targetField ? targetField.label : targetFieldKey;

    setColumns(prev => prev.map(col => {
      if (col.sourceHeader === sourceHeader) {
        return {
          ...col,
          confidence: 'HIGH',
          confidenceScore: 95,
          isOverridden: true
        };
      }
      return col;
    }));

    setSavedAliasNotice(`Saved "${sourceHeader}" as permanent alias for ${targetLabel}`);
    setTimeout(() => setSavedAliasNotice(null), 4000);
  };

  useEffect(() => {
    if (mappingResult) {
      setColumns(mappingResult.columns);
    }
  }, [mappingResult]);

  useEffect(() => {
    if (isOpen) {
      setSavedProfiles(defaultHeaderMappingEngine.getSavedProfiles());
    }
  }, [isOpen]);

  if (!isOpen || !mappingResult) return null;

  const handleFieldSelect = (sourceIndex: number, newFieldKey: string) => {
    setColumns(prev => prev.map(col => {
      if (col.sourceIndex !== sourceIndex) return col;
      if (!newFieldKey) {
        return {
          ...col,
          mappedFieldKey: null,
          mappedFieldLabel: null,
          confidence: 'UNMAPPED',
          confidenceScore: 0,
          isAmbiguous: false,
          isOverridden: true
        };
      }

      const field = fields.find(f => f.key === newFieldKey);
      return {
        ...col,
        mappedFieldKey: newFieldKey,
        mappedFieldLabel: field ? field.label : newFieldKey,
        confidence: 'EXACT',
        confidenceScore: 100,
        isAmbiguous: false,
        isOverridden: true
      };
    }));
  };

  const handleSelectAmbiguousCandidate = (sourceIndex: number, candidateKey: string) => {
    handleFieldSelect(sourceIndex, candidateKey);
  };

  const handleSaveProfile = () => {
    if (!profileNameInput.trim()) return;
    const profile = defaultHeaderMappingEngine.saveProfile(profileNameInput, columns);
    setSavedProfiles(defaultHeaderMappingEngine.getSavedProfiles());
    setProfileNameInput("");
    setShowSaveProfile(false);
  };

  const handleLoadProfile = (profileId: string) => {
    const profile = savedProfiles.find(p => p.id === profileId);
    if (!profile) return;
    
    setColumns(prev => prev.map(col => {
      const normalizedHeader = col.sourceHeader.trim().toLowerCase().replace(/[-_.]/g, " ").replace(/\s+/g, " ");
      const mappedKey = profile.mappings[normalizedHeader];
      if (mappedKey) {
        const field = SMRITI_ITEM_MASTER_FIELDS.find(f => f.key === mappedKey);
        return {
          ...col,
          mappedFieldKey: mappedKey,
          mappedFieldLabel: field ? field.label : mappedKey,
          confidence: 'EXACT',
          confidenceScore: 100,
          isAmbiguous: false,
          isOverridden: true
        };
      }
      return col;
    }));
  };

  const handleDeleteProfile = (profileId: string) => {
    defaultHeaderMappingEngine.deleteProfile(profileId);
    setSavedProfiles(defaultHeaderMappingEngine.getSavedProfiles());
  };

  const usedFieldKeys = new Set(columns.map(c => c.mappedFieldKey).filter(Boolean));
  const missingRequired = fields.filter(f => f.required && !usedFieldKeys.has(f.key));
  const hasAmbiguous = columns.some(c => c.isAmbiguous);

  const exactCount = columns.filter(c => c.confidence === 'EXACT').length;
  const highCount = columns.filter(c => c.confidence === 'HIGH').length;
  const mediumCount = columns.filter(c => c.confidence === 'MEDIUM' || c.confidence === 'LOW').length;
  const ambiguousCount = columns.filter(c => c.isAmbiguous).length;
  const unmappedCount = columns.filter(c => c.confidence === 'UNMAPPED').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-wide font-display">HEADER AUTO-MAPPING PREVIEW</h3>
              <p className="text-xs text-slate-300">
                SMRITI detected {columns.length} columns from your Excel paste. Verify column mappings before loading data into the grid.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Confidence Badges Summary Bar */}
        <div className="bg-slate-100 p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
              ✓ {exactCount} Exact
            </span>
            <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
              ✓ {highCount} High (Alias)
            </span>
            {mediumCount > 0 && (
              <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
                ✓ {mediumCount} Medium / Low
              </span>
            )}
            {ambiguousCount > 0 && (
              <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
                ? {ambiguousCount} Ambiguous (Action Required)
              </span>
            )}
            {unmappedCount > 0 && (
              <span className="bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
                ○ {unmappedCount} Unmapped
              </span>
            )}
          </div>

          {savedAliasNotice && (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-2 animate-fade-in">
              <Check size={14} className="text-indigo-600" />
              <span>{savedAliasNotice}</span>
            </div>
          )}

          {/* Profile Selector */}
          <div className="flex items-center space-x-2">
            {savedProfiles.length > 0 && (
              <select
                onChange={(e) => handleLoadProfile(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Load Saved Vendor Profile --</option>
                {savedProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowSaveProfile(s => !s)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
            >
              <BookmarkPlus size={13} />
              <span>Save Profile</span>
            </button>
          </div>
        </div>

        {/* Save Profile Input Sub-bar */}
        {showSaveProfile && (
          <div className="bg-blue-50 p-3 border-b border-blue-200 flex items-center space-x-3">
            <input
              type="text"
              placeholder="Enter profile name (e.g. Supplier Excel Profile)"
              value={profileNameInput}
              onChange={(e) => setProfileNameInput(e.target.value)}
              className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <button
              onClick={handleSaveProfile}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Save size={13} />
              <span>Save</span>
            </button>
          </div>
        )}

        {/* Missing Required Fields Alert Banner */}
        {missingRequired.length > 0 && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 flex items-start space-x-2.5 text-xs">
            <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Required Item Master columns not detected:</span>{" "}
              {missingRequired.map(f => f.label).join(", ")}. Please map these fields manually below before confirming.
            </div>
          </div>
        )}

        {/* Mapping Preview Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-2.5">Source Excel Header</th>
                <th className="p-2.5">Confidence</th>
                <th className="p-2.5 text-center">Direction</th>
                <th className="p-2.5">Target SMRITI Field</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {columns.map((col) => {
                let badgeClass = "bg-slate-100 text-slate-700 border-slate-300";
                let badgeLabel: string = col.confidence;

                if (col.confidence === "EXACT") {
                  badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  badgeLabel = "✓ Exact";
                } else if (col.confidence === "HIGH") {
                  badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                  badgeLabel = "✓ High (Alias)";
                } else if (col.confidence === "MEDIUM" || col.confidence === "LOW") {
                  badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                  badgeLabel = `✓ ${col.confidenceScore}% Fuzzy`;
                } else if (col.isAmbiguous) {
                  badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
                  badgeLabel = "? Ambiguous";
                } else if (col.confidence === "UNMAPPED") {
                  badgeClass = "bg-slate-100 text-slate-500 border-slate-300";
                  badgeLabel = "○ Unmapped";
                }

                return (
                  <tr key={col.sourceIndex} className="hover:bg-slate-50 transition-colors">
                    {/* Source Header */}
                    <td className="p-2.5 font-bold font-mono text-slate-800">
                      {col.sourceHeader}
                    </td>

                    {/* Confidence Badge */}
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center space-x-1 ${badgeClass}`}>
                        <span>{badgeLabel}</span>
                      </span>
                    </td>

                    {/* Arrow */}
                    <td className="p-2.5 text-center text-slate-400">
                      <ArrowRight size={14} className="inline-block" />
                    </td>

                    {/* Target SMRITI Field Selection */}
                    <td className="p-2.5">
                      {col.isAmbiguous && col.ambiguousCandidates ? (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-purple-700">Select target field for "{col.sourceHeader}":</div>
                          <div className="flex flex-wrap gap-1.5">
                            {col.ambiguousCandidates.map(cand => (
                              <button
                                key={cand.key}
                                onClick={() => handleSelectAmbiguousCandidate(col.sourceIndex, cand.key)}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded shadow-2xs transition-colors cursor-pointer"
                              >
                                [ {cand.label} ]
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <select
                            value={col.mappedFieldKey || ""}
                            onChange={(e) => handleFieldSelect(col.sourceIndex, e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="">-- Ignore / Not Mapped --</option>
                            {fields.map(f => (
                              <option key={f.key} value={f.key}>
                                {f.label} {f.required ? "*" : ""}
                              </option>
                            ))}
                          </select>
                          {col.mappedFieldKey && (
                            <button
                              onClick={() => handleSaveAliasForField(col.sourceHeader, col.mappedFieldKey!)}
                              className="inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                              title={`Save "${col.sourceHeader}" as a permanent header alias for SMRITI field ${col.mappedFieldLabel || col.mappedFieldKey}`}
                            >
                              <BookmarkPlus size={11} />
                              <span>Save as Permanent Alias</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Live Sample Data Preview (Spec #18) */}
        {sampleRows && sampleRows.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={14} className="text-blue-600" />
                Live Data Mapping Preview (Sample Rows 1–{sampleRows.length})
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">Preserving raw string values & leading zeros</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-slate-50 p-2 max-h-[160px]">
              <table className="w-full text-left text-[11px] font-sans border-collapse">
                <thead>
                  <tr className="bg-slate-200/80 text-slate-700 font-bold border-b border-slate-300 text-[10px]">
                    <th className="p-1.5 text-center w-8 border-r border-slate-300">#</th>
                    {columns.map(col => (
                      <th key={col.sourceIndex} className="p-1.5 border-r border-slate-300 min-w-[110px] whitespace-nowrap">
                        <div className="text-[9px] text-slate-500 line-through font-normal">{col.sourceHeader}</div>
                        <div className="text-blue-700 font-bold font-mono">
                          {col.mappedFieldLabel || "(Ignored)"}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {sampleRows.map((sRow, sIdx) => (
                    <tr key={sIdx} className="hover:bg-blue-50/50">
                      <td className="p-1.5 text-center text-slate-500 font-bold bg-slate-100/50">{sIdx + 1}</td>
                      {columns.map(col => {
                        const rawVal = sRow[col.sourceIndex] || "";
                        return (
                          <td key={col.sourceIndex} className="p-1.5 border-r border-slate-200 text-slate-900 bg-white whitespace-nowrap">
                            {rawVal ? (
                              <span className="font-semibold text-slate-900">{rawVal}</span>
                            ) : (
                              <span className="text-slate-300 italic text-[10px]">--</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer select-none bg-blue-50/80 border border-blue-200 px-3 py-1.5 rounded-lg">
              <input
                type="checkbox"
                checked={rememberAliasesCheckbox}
                onChange={(e) => setRememberAliasesCheckbox(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
              />
              <span>Remember header aliases for future imports</span>
            </label>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmMapping}
              disabled={missingRequired.length > 0 || hasAmbiguous}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <Check size={14} />
              <span>Confirm & Fill Grid</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
