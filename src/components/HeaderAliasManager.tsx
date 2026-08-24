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
import { X, Plus, Trash2, Tag, Check, BookMarked, Sparkles } from "lucide-react";
import { SmritiFieldDefinition } from "../lib/headerMapping/types";
import { SMRITI_ITEM_MASTER_FIELDS, addCustomAlias, removeCustomAlias, getCustomAliases } from "../lib/headerMapping/HeaderAliasRegistry";

interface HeaderAliasManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFields?: SmritiFieldDefinition[];
  onAliasUpdated?: () => void;
}

export const HeaderAliasManagerModal: React.FC<HeaderAliasManagerModalProps> = ({
  isOpen,
  onClose,
  availableFields = SMRITI_ITEM_MASTER_FIELDS,
  onAliasUpdated
}) => {
  const [customAliases, setCustomAliases] = useState<Record<string, string[]>>({});
  const [newAliasInputs, setNewAliasInputs] = useState<Record<string, string>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomAliases(getCustomAliases());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddAlias = (fieldKey: string) => {
    const inputVal = (newAliasInputs[fieldKey] || "").trim();
    if (!inputVal) return;

    addCustomAlias(fieldKey, inputVal);
    const updatedMap = getCustomAliases();
    setCustomAliases(updatedMap);
    setNewAliasInputs(prev => ({ ...prev, [fieldKey]: "" }));

    const fieldObj = availableFields.find(f => f.key === fieldKey);
    const labelName = fieldObj ? fieldObj.label : fieldKey;

    setSuccessToast(`Added custom header alias "${inputVal}" for ${labelName}`);
    setTimeout(() => setSuccessToast(null), 3000);

    if (onAliasUpdated) onAliasUpdated();
  };

  const handleRemoveAlias = (fieldKey: string, aliasToRemove: string) => {
    removeCustomAlias(fieldKey, aliasToRemove);
    const updatedMap = getCustomAliases();
    setCustomAliases(updatedMap);

    if (onAliasUpdated) onAliasUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <BookMarked size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                <span>SMRITI Header Alias Manager</span>
                <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-300 text-[10px] uppercase font-mono rounded font-medium">
                  Auto-Mapping Engine
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Define custom Excel / CSV column header aliases to automatically map vendor spreadsheets into SMRITI fields.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toast Notice */}
        {successToast && (
          <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 px-4 py-2 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center space-x-2">
              <Check size={14} className="text-emerald-600" />
              <span>{successToast}</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[calc(85vh-130px)]">
          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start space-x-2.5">
            <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">How Header Aliases Work:</strong> Any header added here will automatically match during Excel paste/import. For example, adding <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">Vendor Art No</code> under <strong>SKU CODE</strong> ensures all vendor files with that column header auto-map directly to Item Code!
            </div>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/50 overflow-hidden">
            {availableFields.map(field => {
              const fieldAliases = customAliases[field.key] || [];
              const defaultAliases = field.aliases.filter(a => !fieldAliases.includes(a));

              return (
                <div key={field.key} className="p-4 bg-white hover:bg-slate-50/80 transition-colors space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-800">{field.label}</span>
                      {field.required && (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold text-[9px] rounded">
                          REQUIRED
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">({field.key})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 italic">{field.description}</div>
                  </div>

                  {/* Registered Custom Aliases */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">User Aliases:</span>
                    {fieldAliases.length > 0 ? (
                      fieldAliases.map(alias => (
                        <span 
                          key={alias}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-medium rounded-full shadow-2xs"
                        >
                          <Tag size={10} className="text-indigo-500" />
                          <span>{alias}</span>
                          <button
                            onClick={() => handleRemoveAlias(field.key, alias)}
                            className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                            title="Remove Alias"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No custom user aliases registered</span>
                    )}
                  </div>

                  {/* Add New Alias Input */}
                  <div className="flex items-center space-x-2 pt-1 max-w-md">
                    <input
                      type="text"
                      placeholder={`Add new alias header for ${field.label}...`}
                      value={newAliasInputs[field.key] || ""}
                      onChange={(e) => setNewAliasInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddAlias(field.key);
                      }}
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                    />
                    <button
                      onClick={() => handleAddAlias(field.key)}
                      disabled={!(newAliasInputs[field.key] || "").trim()}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-md transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Default Built-in Aliases */}
                  <div className="pt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-500">Built-in Aliases:</span>
                    {defaultAliases.slice(0, 8).map(a => (
                      <span key={a} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {a}
                      </span>
                    ))}
                    {defaultAliases.length > 8 && (
                      <span className="text-slate-400 font-italic">+{defaultAliases.length - 8} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            ✦ All user-added aliases are preserved automatically across sessions and Excel pastes.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-md transition-colors cursor-pointer"
          >
            Done & Close
          </button>
        </div>

      </div>
    </div>
  );
};
