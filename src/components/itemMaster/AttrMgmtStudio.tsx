/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.6.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Sparkles,
  RefreshCw,
  Database,
  Tag
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { AttributeDefinition, AttributeGroup } from "../../types.ts";
import { getUnifiedItemMasterFields } from "../../services/unifiedFieldCatalog.ts";
import { 
  addCustomAlias, 
  removeCustomAlias, 
  getCustomAliases,
  getRemovedAliases,
  clearCustomAliases,
  setCustomFieldLabel,
  getCustomFieldLabels
} from "../../lib/headerMapping/HeaderAliasRegistry.ts";

interface SmritiAttributeManagementStudioProps {
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const AttrMgmtStudio: React.FC<SmritiAttributeManagementStudioProps> = ({
  onNotification
}) => {
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAttrId, setSelectedAttrId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [newAliasInput, setNewAliasInput] = useState<string>("");
  const [customLabelInput, setCustomLabelInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [aliasRefreshTrigger, setAliasRefreshTrigger] = useState<number>(0);

  // Form state for creating/editing attribute
  const [formState, setFormState] = useState<{
    name: string;
    label: string;
    dataType: string;
    isMandatory: boolean;
    isVariantDimension: boolean;
    validValues: string;
    groupId: string;
  }>({
    name: "",
    label: "",
    dataType: "Text",
    isMandatory: false,
    isVariantDimension: false,
    validValues: "",
    groupId: ""
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [defs, grps] = await Promise.all([
        apiFetchV1("/attributes/definitions"),
        apiFetchV1("/attributes/groups")
      ]);
      if (Array.isArray(defs)) setAttributes(defs);
      if (Array.isArray(grps)) setGroups(grps);
    } catch (err: any) {
      onNotification?.("Failed to Load Attributes", err.message || "Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const unifiedFields = useMemo(() => {
    const customLabels = getCustomFieldLabels();
    const customAliases = getCustomAliases();
    const removedAliases = getRemovedAliases();

    return getUnifiedItemMasterFields(attributes).map(f => {
      const overriddenLabel = customLabels[f.key] || f.label;
      const extraAliases = customAliases[f.key] || [];
      const removedForField = (removedAliases[f.key] || []).map(r => r.toLowerCase().trim());
      const rawCombined = Array.from(new Set([...(f.aliases || []), ...extraAliases]));
      const activeAliases = rawCombined.filter(
        a => !removedForField.includes(a.toLowerCase().trim())
      );

      return {
        ...f,
        label: overriddenLabel,
        aliases: activeAliases
      };
    });
  }, [attributes, aliasRefreshTrigger]);

  const filteredAttributes = useMemo(() => {
    return unifiedFields.filter(f => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.label.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        (f.aliases || []).some(a => a.toLowerCase().includes(q))
      );
    });
  }, [unifiedFields, searchQuery]);

  const selectedField = useMemo(() => {
    if (!selectedAttrId) return null;
    return unifiedFields.find(f => f.id === selectedAttrId || f.key === selectedAttrId);
  }, [selectedAttrId, unifiedFields]);

  const handleSelectField = (id: string) => {
    setSelectedAttrId(id);
    const field = unifiedFields.find(f => f.id === id || f.key === id);
    if (field) {
      setCustomLabelInput(field.label);
    }
    setIsDrawerOpen(true);
  };

  const handleSaveCustomLabel = (fieldKey: string) => {
    if (!customLabelInput.trim()) return;
    setCustomFieldLabel(fieldKey, customLabelInput.trim());
    setAliasRefreshTrigger(prev => prev + 1);
    onNotification?.("Label Updated", `Updated display label to "${customLabelInput.trim()}"`, "success");
  };

  const handleAddAlias = (fieldKey: string) => {
    if (!newAliasInput.trim()) return;
    addCustomAlias(fieldKey, newAliasInput.trim());
    setAliasRefreshTrigger(prev => prev + 1);
    onNotification?.("Alias Added", `Added alias "${newAliasInput.trim()}" for ${fieldKey}`, "success");
    setNewAliasInput("");
  };

  const handleRemoveAlias = (fieldKey: string, alias: string) => {
    removeCustomAlias(fieldKey, alias);
    setAliasRefreshTrigger(prev => prev + 1);
    onNotification?.("Alias Removed", `Removed alias "${alias}"`, "success");
  };

  const handleSaveAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.label.trim()) {
      onNotification?.("Validation Error", "Name and Label are required.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formState.name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        label: formState.label.trim(),
        data_type: formState.dataType,
        is_mandatory: formState.isMandatory,
        is_variant_dimension: formState.isVariantDimension,
        valid_values: formState.validValues ? formState.validValues.split(",").map(v => v.trim()).filter(Boolean) : [],
        group_id: formState.groupId || null
      };

      await apiFetchV1("/attributes/definitions", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      onNotification?.("Attribute Saved", `Attribute ${payload.label} successfully created.`, "success");
      await loadData();
      setIsDrawerOpen(false);
      setFormState({
        name: "",
        label: "",
        dataType: "Text",
        isMandatory: false,
        isVariantDimension: false,
        validValues: "",
        groupId: ""
      });
    } catch (err: any) {
      onNotification?.("Save Error", err.message || "Could not persist attribute definition", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] font-sans overflow-hidden">
      
      {/* Top Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-white dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] shrink-0">
        <div>
          <h2 className="text-base font-bold text-[#191c1e] dark:text-white flex items-center gap-2">
            <Database size={18} className="text-[#515f74] dark:text-[#bec6e0]" />
            Attribute Management Engine
          </h2>
          <p className="text-xs text-[#515f74] dark:text-[#bec6e0] mt-0.5">
            Manage core system entities, dynamic schemas, and business alias mappings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedAttrId(null);
              setIsDrawerOpen(true);
            }}
            className="px-4 py-2 bg-[#000000] dark:bg-[#dae2fd] text-white dark:text-[#131b2e] hover:bg-[#2d3133] rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus size={14} />
            Add Attribute
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
        
        {/* Table Area (Spans full or 8 cols when drawer open) */}
        <div className={`${isDrawerOpen ? "col-span-12 xl:col-span-8" : "col-span-12"} flex flex-col bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg overflow-hidden shadow-xs transition-all`}>
          
          {/* Table Toolbar */}
          <div className="p-3 border-b border-[#c6c6cd] dark:border-[#45464d] flex justify-between items-center bg-[#f2f4f6] dark:bg-[#131b2e]">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded text-[11px] font-bold font-mono text-[#191c1e] dark:text-white">
                {unifiedFields.length} TOTAL ATTRIBUTES
              </span>
              <span className="px-2.5 py-1 bg-[#89f5e7] text-[#00201d] rounded text-[11px] font-bold font-mono">
                {attributes.length} DYNAMIC
              </span>
            </div>

            <div className="relative w-64">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search attribute name or alias..."
                className="w-full pl-8 pr-3 py-1 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs outline-none focus:ring-1 focus:ring-[#000000]"
              />
            </div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-auto bg-white dark:bg-[#191c1e]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] z-10">
                <tr>
                  <th className="py-2.5 px-4 font-mono font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px]">Internal ID / Key</th>
                  <th className="py-2.5 px-4 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px]">Business Label</th>
                  <th className="py-2.5 px-4 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px]">Type</th>
                  <th className="py-2.5 px-4 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px]">Recognized Aliases</th>
                  <th className="py-2.5 px-4 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px]">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                {filteredAttributes.map(f => {
                  const isSelected = selectedAttrId === f.id || selectedAttrId === f.key;

                  return (
                    <tr
                      key={f.id}
                      onClick={() => handleSelectField(f.id)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? "bg-[#d5e3fd]/40 border-l-4 border-l-[#000000] dark:border-l-[#dae2fd]"
                          : "hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133]"
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-[#191c1e] dark:text-white">
                        {f.key}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#191c1e] dark:text-white">
                        {f.label}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#e0e3e5] dark:bg-[#45464d] font-mono text-[10px] uppercase font-bold">
                          {f.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(f.aliases || [f.label, f.key]).slice(0, 4).map((alias, aIdx) => (
                            <span key={aIdx} className="px-1.5 py-0.5 bg-[#eceef0] dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded text-[10px] text-[#515f74] dark:text-[#bec6e0]">
                              {alias}
                            </span>
                          ))}
                          {(f.aliases || []).length > 4 && (
                            <span className="text-[10px] font-bold text-[#76777d]">+{f.aliases.length - 4} more</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          f.isDynamic ? "bg-[#89f5e7] text-[#00201d]" : "bg-[#f2f4f6] text-[#515f74] dark:text-[#bec6e0]"
                        }`}>
                          {f.isDynamic ? "Dynamic" : "Standard Core"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Configuration Drawer (Spans 4 cols on right when open) */}
        {isDrawerOpen && (
          <div className="col-span-12 xl:col-span-4 flex flex-col bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#c6c6cd] dark:border-[#45464d] flex justify-between items-center bg-[#f2f4f6] dark:bg-[#131b2e]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#191c1e] dark:text-white flex items-center gap-2">
                <Tag size={14} />
                {selectedField ? `Attribute Details: ${selectedField.label}` : "Create New Attribute Definition"}
              </h3>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="text-[#76777d] hover:text-[#191c1e] dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
              {selectedField ? (
                <>
                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Internal Database Key</label>
                    <input readOnly value={selectedField.key} className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold text-xs" />
                  </div>

                  <div>
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Business Display Label</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customLabelInput}
                        onChange={e => setCustomLabelInput(e.target.value)}
                        placeholder="e.g. Upper Material, Outsole, Heel..."
                        className="flex-1 p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded font-bold text-xs outline-none focus:ring-1 focus:ring-[#000000]"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCustomLabel(selectedField.key)}
                        className="px-3 py-2 bg-[#000000] dark:bg-[#dae2fd] text-white dark:text-[#131b2e] rounded font-bold text-xs hover:bg-[#2d3133]"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Alias Management */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px]">
                        Recognized Spreadsheet Import Aliases ({selectedField.aliases?.length || 0})
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const removedMap = getRemovedAliases();
                          delete removedMap[selectedField.key];
                          try {
                            localStorage.setItem("smriti_header_removed_aliases", JSON.stringify(removedMap));
                          } catch {}
                          setAliasRefreshTrigger(prev => prev + 1);
                          onNotification?.("Aliases Reset", `Restored default aliases for ${selectedField.label}`, "success");
                        }}
                        className="text-[10px] text-[#0052cc] dark:text-[#b2c5ff] hover:underline font-semibold"
                      >
                        Reset Defaults
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-2.5 bg-[#f2f4f6] dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded min-h-[60px]">
                      {(selectedField.aliases || []).length === 0 ? (
                        <span className="text-[11px] text-[#76777d] italic">No aliases defined. Add aliases below.</span>
                      ) : (
                        (selectedField.aliases || []).map((alias, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-mono shadow-2xs">
                            <span>{alias}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAlias(selectedField.key, alias)}
                              className="text-[#76777d] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-full px-1 font-bold ml-1 transition"
                              title={`Delete alias "${alias}"`}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="text-[#515f74] dark:text-[#bec6e0] font-bold uppercase text-[10px] block mb-1">Add New Excel / Spreadsheet Alias</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAliasInput}
                        onChange={e => setNewAliasInput(e.target.value)}
                        placeholder="e.g. Heeltop, Sole Type, Outsole..."
                        className="flex-1 p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs outline-none focus:ring-1 focus:ring-[#000000]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAlias(selectedField.key)}
                        className="px-3 py-2 bg-[#000000] dark:bg-[#dae2fd] text-white dark:text-[#131b2e] rounded font-bold text-xs hover:bg-[#2d3133]"
                      >
                        Add Alias
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveAttribute} className="space-y-3">
                  <div>
                    <label className="text-[#515f74] font-bold uppercase text-[10px] block mb-1">Attribute Name (Code)*</label>
                    <input
                      type="text"
                      required
                      value={formState.name}
                      onChange={e => setFormState(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. UPPER_MATERIAL"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[#515f74] font-bold uppercase text-[10px] block mb-1">Business Label*</label>
                    <input
                      type="text"
                      required
                      value={formState.label}
                      onChange={e => setFormState(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="e.g. Upper Material"
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[#515f74] font-bold uppercase text-[10px] block mb-1">Data Type</label>
                    <select
                      value={formState.dataType}
                      onChange={e => setFormState(prev => ({ ...prev, dataType: e.target.value }))}
                      className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded font-semibold"
                    >
                      <option value="Text">Text</option>
                      <option value="Number">Number</option>
                      <option value="Select">Select (Options List)</option>
                      <option value="Date">Date</option>
                    </select>
                  </div>

                  {formState.dataType === "Select" && (
                    <div>
                      <label className="text-[#515f74] font-bold uppercase text-[10px] block mb-1">Valid Values (comma separated)</label>
                      <input
                        type="text"
                        value={formState.validValues}
                        onChange={e => setFormState(prev => ({ ...prev, validValues: e.target.value }))}
                        placeholder="e.g. Leather, Suede, Mesh, Canvas"
                        className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.isMandatory}
                        onChange={e => setFormState(prev => ({ ...prev, isMandatory: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="font-semibold">Mandatory</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.isVariantDimension}
                        onChange={e => setFormState(prev => ({ ...prev, isVariantDimension: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="font-semibold">Variant Dimension</span>
                    </label>
                  </div>

                  <div className="pt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDrawerOpen(false)}
                      className="px-4 py-2 border border-[#76777d] rounded font-semibold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-2 bg-[#000000] text-white rounded font-bold text-xs hover:bg-[#2d3133] disabled:opacity-40"
                    >
                      {isSaving ? "Saving..." : "Save Definition"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AttrMgmtStudio;
