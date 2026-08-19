/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  CheckCircle2, AlertTriangle, HelpCircle, XCircle, ArrowRight,
  BookmarkPlus, Save, Trash2, X, Check, Tag, Eye, Plus, AlertCircle, Info
} from "lucide-react";
import { 
  SmritiFieldDefinition, 
  ColumnMappingResult, 
  HeaderMappingEngineResult, 
  SavedMappingProfile,
  MappingTarget,
  REUSE_WARNING_THRESHOLDS
} from "../lib/headerMapping/types";
import { SMRITI_ITEM_MASTER_FIELDS, addCustomAlias } from "../lib/headerMapping/HeaderAliasRegistry";
import { defaultHeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine";

interface HeaderMappingPreviewModalProps {
  isOpen: boolean;
  mappingResult: HeaderMappingEngineResult | null;
  availableFields?: SmritiFieldDefinition[];
  sampleRows?: string[][];
  onConfirm: (finalMappings: ColumnMappingResult[]) => void;
  onClose: () => void;
}

interface MultiTargetConfirmDialogState {
  isOpen: boolean;
  sourceHeader: string;
  sourceIndex: number;
  targets: MappingTarget[];
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

  // Phase 3 & 5 State: Tier 4 Confirmations & Multi-Target Alias Confirm Dialog
  const [tier4Confirmed, setTier4Confirmed] = useState<Record<number, boolean>>({});
  const [multiTargetConfirmDialog, setMultiTargetConfirmDialog] = useState<MultiTargetConfirmDialogState>({
    isOpen: false,
    sourceHeader: "",
    sourceIndex: -1,
    targets: []
  });

  // Initialize columns with multi-target support from mappingResult
  useEffect(() => {
    if (mappingResult) {
      const initializedCols: ColumnMappingResult[] = mappingResult.columns.map(col => {
        const targets: MappingTarget[] = [];
        if (col.mappedFieldKey) {
          targets.push({
            target: col.mappedFieldKey,
            targetLabel: col.mappedFieldLabel || col.mappedFieldKey
          });
        }
        if (col.additionalTargets && col.additionalTargets.length > 0) {
          col.additionalTargets.forEach(at => {
            if (at.target && !targets.some(t => t.target === at.target)) {
              targets.push({
                target: at.target,
                targetLabel: at.targetLabel || at.target
              });
            }
          });
        }
        return {
          ...col,
          targets: targets.length > 0 ? targets : (col.mappedFieldKey ? [{ target: col.mappedFieldKey, targetLabel: col.mappedFieldLabel || col.mappedFieldKey }] : []),
          reuseReason: col.reuseReason || ""
        };
      });
      setColumns(initializedCols);
      setTier4Confirmed({});
    }
  }, [mappingResult]);

  useEffect(() => {
    if (isOpen) {
      setSavedProfiles(defaultHeaderMappingEngine.getSavedProfiles());
    }
  }, [isOpen]);

  // Compute all mapped targets and check for missing required fields
  const allMappedFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    columns.forEach(col => {
      if (col.targets && col.targets.length > 0) {
        col.targets.forEach(t => {
          if (t.target) keys.add(t.target);
        });
      } else if (col.mappedFieldKey) {
        keys.add(col.mappedFieldKey);
      }
    });
    return keys;
  }, [columns]);

  const missingRequired = useMemo(() => {
    return fields.filter(f => f.required && !allMappedFieldKeys.has(f.key));
  }, [fields, allMappedFieldKeys]);

  const hasAmbiguous = useMemo(() => {
    return columns.some(c => c.isAmbiguous && (!c.targets || c.targets.length === 0));
  }, [columns]);

  // Check if any column with reuse >= 4 has not been confirmed
  const unconfirmedTier4 = useMemo(() => {
    return columns.some(col => {
      const reuseCount = col.targets ? col.targets.length : (col.mappedFieldKey ? 1 : 0);
      return reuseCount >= REUSE_WARNING_THRESHOLDS.TIER_4_CONFIRM && !tier4Confirmed[col.sourceIndex];
    });
  }, [columns, tier4Confirmed]);

  if (!isOpen || !mappingResult) return null;

  // Handle setting primary or individual target
  const handleUpdateTarget = (sourceIndex: number, targetIndex: number, newFieldKey: string) => {
    setColumns(prev => prev.map(col => {
      if (col.sourceIndex !== sourceIndex) return col;
      const currentTargets = [...(col.targets || [])];

      if (!newFieldKey) {
        // Remove target at targetIndex
        currentTargets.splice(targetIndex, 1);
      } else {
        const field = fields.find(f => f.key === newFieldKey);
        const newTargetObj: MappingTarget = {
          target: newFieldKey,
          targetLabel: field ? field.label : newFieldKey
        };
        if (targetIndex < currentTargets.length) {
          currentTargets[targetIndex] = newTargetObj;
        } else {
          currentTargets.push(newTargetObj);
        }
      }

      const primaryTarget = currentTargets[0] || null;
      return {
        ...col,
        targets: currentTargets,
        mappedFieldKey: primaryTarget ? primaryTarget.target : null,
        mappedFieldLabel: primaryTarget ? (primaryTarget.targetLabel || primaryTarget.target) : null,
        confidence: currentTargets.length > 0 ? 'EXACT' : 'UNMAPPED',
        confidenceScore: currentTargets.length > 0 ? 100 : 0,
        isAmbiguous: false,
        isOverridden: true
      };
    }));
  };

  // Add a new target to a source column
  const handleAddTarget = (sourceIndex: number) => {
    setColumns(prev => prev.map(col => {
      if (col.sourceIndex !== sourceIndex) return col;
      const currentTargets = [...(col.targets || [])];
      // Find first unused field or default to empty
      const unusedField = fields.find(f => !currentTargets.some(t => t.target === f.key));
      const newKey = unusedField ? unusedField.key : "";
      const field = fields.find(f => f.key === newKey);

      if (newKey) {
        currentTargets.push({
          target: newKey,
          targetLabel: field ? field.label : newKey
        });
      }

      const primaryTarget = currentTargets[0] || null;
      return {
        ...col,
        targets: currentTargets,
        mappedFieldKey: primaryTarget ? primaryTarget.target : null,
        mappedFieldLabel: primaryTarget ? (primaryTarget.targetLabel || primaryTarget.target) : null,
        confidence: 'EXACT',
        confidenceScore: 100,
        isAmbiguous: false,
        isOverridden: true
      };
    }));
  };

  // Remove a specific target from a source column
  const handleRemoveTarget = (sourceIndex: number, targetIndex: number) => {
    setColumns(prev => prev.map(col => {
      if (col.sourceIndex !== sourceIndex) return col;
      const currentTargets = [...(col.targets || [])];
      currentTargets.splice(targetIndex, 1);

      const primaryTarget = currentTargets[0] || null;
      return {
        ...col,
        targets: currentTargets,
        mappedFieldKey: primaryTarget ? primaryTarget.target : null,
        mappedFieldLabel: primaryTarget ? (primaryTarget.targetLabel || primaryTarget.target) : null,
        confidence: currentTargets.length > 0 ? col.confidence : 'UNMAPPED',
        confidenceScore: currentTargets.length > 0 ? col.confidenceScore : 0,
        isOverridden: true
      };
    }));
  };

  // Update optional reason text for a source column
  const handleUpdateReason = (sourceIndex: number, reason: string) => {
    setColumns(prev => prev.map(col => {
      if (col.sourceIndex !== sourceIndex) return col;
      return { ...col, reuseReason: reason };
    }));
  };

  // Ambiguous candidate resolution
  const handleSelectAmbiguousCandidate = (sourceIndex: number, candidateKey: string) => {
    handleUpdateTarget(sourceIndex, 0, candidateKey);
  };

  // Phase 5: Permanent Alias Save Handler (Two Weights)
  const handleInitiateSaveAlias = (col: ColumnMappingResult) => {
    const targets = col.targets && col.targets.length > 0 
      ? col.targets 
      : (col.mappedFieldKey ? [{ target: col.mappedFieldKey, targetLabel: col.mappedFieldLabel || col.mappedFieldKey }] : []);

    if (targets.length === 0) return;

    if (targets.length === 1) {
      // Single-target: direct one-click save
      addCustomAlias(targets[0].target, col.sourceHeader);
      setSavedAliasNotice(`Saved "${col.sourceHeader}" as permanent alias for ${targets[0].targetLabel || targets[0].target}`);
      setTimeout(() => setSavedAliasNotice(null), 4000);
    } else {
      // Multi-target: open confirm dialog
      setMultiTargetConfirmDialog({
        isOpen: true,
        sourceHeader: col.sourceHeader,
        sourceIndex: col.sourceIndex,
        targets: targets
      });
    }
  };

  const handleSaveMultiTargetPermanently = () => {
    const { sourceHeader, targets } = multiTargetConfirmDialog;
    targets.forEach(t => {
      if (t.target) {
        addCustomAlias(t.target, sourceHeader);
      }
    });
    const targetLabels = targets.map(t => t.targetLabel || t.target).join(" + ");
    setSavedAliasNotice(`Saved rule: "${sourceHeader}" → ${targetLabels} for all future imports`);
    setTimeout(() => setSavedAliasNotice(null), 4500);
    setMultiTargetConfirmDialog({ isOpen: false, sourceHeader: "", sourceIndex: -1, targets: [] });
  };

  const handleUseJustThisOnce = () => {
    // Closes dialog without persisting to HeaderAliasRegistry
    setSavedAliasNotice(`Applied multi-target mapping for current import session only`);
    setTimeout(() => setSavedAliasNotice(null), 3500);
    setMultiTargetConfirmDialog({ isOpen: false, sourceHeader: "", sourceIndex: -1, targets: [] });
  };

  // Final Confirmation to Fill Grid
  const handleConfirmMapping = () => {
    if (rememberAliasesCheckbox) {
      columns.forEach(col => {
        const targets = col.targets && col.targets.length > 0 
          ? col.targets 
          : (col.mappedFieldKey ? [{ target: col.mappedFieldKey }] : []);
        
        targets.forEach(t => {
          if (t.target && col.sourceHeader) {
            addCustomAlias(t.target, col.sourceHeader);
          }
        });
      });
    }
    onConfirm(columns);
  };

  // Save/Load Profiles
  const handleSaveProfile = () => {
    if (!profileNameInput.trim()) return;
    defaultHeaderMappingEngine.saveProfile(profileNameInput, columns);
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
        const targetObj: MappingTarget = { target: mappedKey, targetLabel: field ? field.label : mappedKey };
        return {
          ...col,
          targets: [targetObj],
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

  const exactCount = columns.filter(c => c.confidence === 'EXACT').length;
  const highCount = columns.filter(c => c.confidence === 'HIGH').length;
  const mediumCount = columns.filter(c => c.confidence === 'MEDIUM' || c.confidence === 'LOW').length;
  const ambiguousCount = columns.filter(c => c.isAmbiguous).length;
  const unmappedCount = columns.filter(c => (!c.targets || c.targets.length === 0) && !c.mappedFieldKey).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-wide font-display">HEADER AUTO-MAPPING PREVIEW</h3>
              <p className="text-xs text-slate-300">
                Map source columns to one or multiple SMRITI fields. Multi-target mappings will automatically duplicate values across destination columns.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Confidence Badges Summary Bar */}
        <div className="bg-slate-100 p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              ✓ {exactCount} Exact
            </span>
            <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              ✓ {highCount} High (Alias)
            </span>
            {mediumCount > 0 && (
              <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                ✓ {mediumCount} Fuzzy
              </span>
            )}
            {ambiguousCount > 0 && (
              <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                ? {ambiguousCount} Ambiguous
              </span>
            )}
            {unmappedCount > 0 && (
              <span className="bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                ○ {unmappedCount} Unmapped
              </span>
            )}
          </div>

          {savedAliasNotice && (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold px-3 py-1 rounded-lg flex items-center space-x-1.5 animate-fade-in">
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
                <option value="">-- Load Saved Profile --</option>
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

        {/* Save Profile Sub-bar */}
        {showSaveProfile && (
          <div className="bg-blue-50 p-2.5 border-b border-blue-200 flex items-center space-x-3">
            <input
              type="text"
              placeholder="Enter profile name (e.g. Vendor Standard Template)"
              value={profileNameInput}
              onChange={(e) => setProfileNameInput(e.target.value)}
              className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <button
              onClick={handleSaveProfile}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Save size={13} />
              <span>Save</span>
            </button>
          </div>
        )}

        {/* Missing Required Fields Alert Banner */}
        {missingRequired.length > 0 && (
          <div className="p-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 flex items-start space-x-2 text-xs">
            <AlertTriangle size={15} className="text-rose-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Required Item Master fields not yet mapped:</span>{" "}
              {missingRequired.map(f => f.label).join(", ")}. Please assign these target fields below before confirming.
            </div>
          </div>
        )}

        {/* Mapping Preview Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-2.5 w-1/4">Source Excel Header</th>
                <th className="p-2.5 w-24">Confidence</th>
                <th className="p-2.5 text-center w-8">Direction</th>
                <th className="p-2.5">Target SMRITI Fields (1:Many Supported)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {columns.map((col) => {
                const targetList = col.targets || [];
                const reuseCount = targetList.length;

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
                  <tr key={col.sourceIndex} className="hover:bg-slate-50/80 transition-colors align-top">
                    {/* Source Header + Tiered Warning Badges */}
                    <td className="p-2.5 font-bold font-mono text-slate-800">
                      <div className="flex items-center space-x-1.5">
                        <span>{col.sourceHeader}</span>
                      </div>

                      {/* Tiered Warning UI (Phase 3) */}
                      {reuseCount === REUSE_WARNING_THRESHOLDS.TIER_2_BADGE && (
                        <div className="mt-1 inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded text-[10px] font-bold">
                          <Info size={11} className="text-slate-500" />
                          <span>Used 2×</span>
                        </div>
                      )}

                      {reuseCount === REUSE_WARNING_THRESHOLDS.TIER_3_WARNING && (
                        <div className="mt-1 inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-[10px] font-bold">
                          <AlertTriangle size={11} className="text-amber-600" />
                          <span>Used 3× — confirm this is intentional</span>
                        </div>
                      )}

                      {reuseCount >= REUSE_WARNING_THRESHOLDS.TIER_4_CONFIRM && (
                        <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded-lg space-y-1.5">
                          <div className="flex items-center space-x-1.5 text-amber-800 text-[10px] font-bold">
                            <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                            <span>Used {reuseCount}× — confirm this is intentional</span>
                          </div>
                          <label className="flex items-center space-x-1.5 text-[10px] text-slate-800 font-bold cursor-pointer select-none bg-white p-1.5 rounded border border-amber-200">
                            <input
                              type="checkbox"
                              checked={!!tier4Confirmed[col.sourceIndex]}
                              onChange={(e) => setTier4Confirmed(prev => ({ ...prev, [col.sourceIndex]: e.target.checked }))}
                              className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                            />
                            <span>I confirm this reuse is intentional</span>
                          </label>
                        </div>
                      )}

                      {/* Optional Reason Text Input (Phase 3: shown when reuseCount >= 2) */}
                      {reuseCount >= REUSE_WARNING_THRESHOLDS.TIER_2_BADGE && (
                        <div className="mt-1.5">
                          <input
                            type="text"
                            placeholder="Optional reason note (e.g. MRP used for Price)"
                            value={col.reuseReason || ""}
                            onChange={(e) => handleUpdateReason(col.sourceIndex, e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-[10px] text-slate-700 font-sans focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </td>

                    {/* Confidence Badge */}
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center space-x-1 ${badgeClass}`}>
                        <span>{badgeLabel}</span>
                      </span>
                    </td>

                    {/* Arrow */}
                    <td className="p-2.5 text-center text-slate-400">
                      <ArrowRight size={14} className="inline-block mt-1" />
                    </td>

                    {/* Target SMRITI Field Selection (Multi-Target Supported) */}
                    <td className="p-2.5 space-y-2">
                      {col.isAmbiguous && targetList.length === 0 && col.ambiguousCandidates ? (
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
                        <div className="space-y-1.5">
                          {/* List of mapped targets */}
                          {targetList.length === 0 ? (
                            <div className="flex items-center space-x-2">
                              <select
                                value=""
                                onChange={(e) => handleUpdateTarget(col.sourceIndex, 0, e.target.value)}
                                className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              >
                                <option value="">-- Ignore / Not Mapped --</option>
                                {fields.map(f => (
                                  <option key={f.key} value={f.key}>
                                    {f.label} {f.required ? "*" : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            targetList.map((tgt, tIdx) => (
                              <div key={tIdx} className="flex items-center space-x-2 bg-slate-50 border border-slate-200 p-1.5 rounded-lg">
                                <span className="text-[10px] font-mono text-slate-400 font-bold w-4 text-center">
                                  #{tIdx + 1}
                                </span>
                                <select
                                  value={tgt.target}
                                  onChange={(e) => handleUpdateTarget(col.sourceIndex, tIdx, e.target.value)}
                                  className="flex-1 bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                  <option value="">-- Remove Target --</option>
                                  {fields.map(f => (
                                    <option key={f.key} value={f.key}>
                                      {f.label} {f.required ? "*" : ""}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleRemoveTarget(col.sourceIndex, tIdx)}
                                  className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                                  title="Remove this target"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))
                          )}

                          {/* Add Target Button & Save Alias */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              onClick={() => handleAddTarget(col.sourceIndex)}
                              className="inline-flex items-center space-x-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                            >
                              <Plus size={11} />
                              <span>Add Another Target</span>
                            </button>

                            {targetList.length > 0 && (
                              <button
                                onClick={() => handleInitiateSaveAlias(col)}
                                className="inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                title="Save this mapping rule permanently"
                              >
                                <BookmarkPlus size={11} />
                                <span>Save as Permanent Alias</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Live Data Mapping Preview (Phase 4: Multi-Target Duplication Render) */}
        {sampleRows && sampleRows.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 p-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={14} className="text-blue-600" />
                Live Data Mapping Preview (Sample Rows 1–{sampleRows.length})
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">Multi-target columns duplicate values accurately across destinations</span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white p-2 max-h-[150px]">
              <table className="w-full text-left text-[11px] font-sans border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px]">
                    <th className="p-1.5 text-center w-8 border-r border-slate-300">#</th>
                    {columns.flatMap(col => {
                      const targets = col.targets && col.targets.length > 0 
                        ? col.targets 
                        : (col.mappedFieldKey ? [{ target: col.mappedFieldKey, targetLabel: col.mappedFieldLabel || col.mappedFieldKey }] : [{ target: "", targetLabel: "(Ignored)" }]);

                      return targets.map((t, idx) => (
                        <th key={`${col.sourceIndex}_${t.target}_${idx}`} className="p-1.5 border-r border-slate-300 min-w-[120px] whitespace-nowrap">
                          <div className="text-[9px] text-slate-500 font-normal">
                            Src: {col.sourceHeader} {targets.length > 1 ? `[Tgt ${idx+1}]` : ''}
                          </div>
                          <div className="text-blue-700 font-bold font-mono">
                            {t.targetLabel || t.target || "(Ignored)"}
                          </div>
                        </th>
                      ));
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {sampleRows.map((sRow, sIdx) => (
                    <tr key={sIdx} className="hover:bg-blue-50/50">
                      <td className="p-1.5 text-center text-slate-500 font-bold bg-slate-100/50">{sIdx + 1}</td>
                      {columns.flatMap(col => {
                        const rawVal = sRow[col.sourceIndex] || "";
                        const targets = col.targets && col.targets.length > 0 
                          ? col.targets 
                          : (col.mappedFieldKey ? [{ target: col.mappedFieldKey }] : [{ target: "" }]);

                        return targets.map((t, idx) => (
                          <td key={`${col.sourceIndex}_${t.target}_${idx}`} className="p-1.5 border-r border-slate-200 text-slate-900 bg-white whitespace-nowrap">
                            {rawVal ? (
                              <span className="font-semibold text-slate-900">{rawVal}</span>
                            ) : (
                              <span className="text-slate-300 italic text-[10px]">--</span>
                            )}
                          </td>
                        ));
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
              disabled={missingRequired.length > 0 || hasAmbiguous || unconfirmedTier4}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <Check size={14} />
              <span>Confirm & Fill Grid</span>
            </button>
          </div>
        </div>

      </div>

      {/* Multi-Target Alias Confirmation Dialog (Phase 5: Two Weights) */}
      {multiTargetConfirmDialog.isOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                <BookmarkPlus size={22} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-900">Save Multi-Target Permanent Alias Rule</h4>
                <p className="text-xs text-slate-500 mt-1">
                  You are mapping source header <b className="font-mono text-slate-800">"{multiTargetConfirmDialog.sourceHeader}"</b> to multiple destination fields:
                </p>
              </div>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5">
              <div className="text-[11px] font-bold text-indigo-900">Rule to save:</div>
              <div className="font-mono text-xs font-bold text-indigo-700 flex flex-wrap items-center gap-1.5">
                <span className="bg-white px-2 py-0.5 rounded border border-indigo-200">{multiTargetConfirmDialog.sourceHeader}</span>
                <span>→</span>
                {multiTargetConfirmDialog.targets.map((t, idx) => (
                  <span key={idx} className="bg-white px-2 py-0.5 rounded border border-indigo-200">
                    {t.targetLabel || t.target}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-indigo-600 pt-1">
                Applied to ALL future Excel/CSV imports whenever this header is pasted.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={handleUseJustThisOnce}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Use Just This Once
              </button>
              <button
                onClick={handleSaveMultiTargetPermanently}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <Save size={13} />
                <span>Save Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
