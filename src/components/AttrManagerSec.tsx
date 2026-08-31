/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, Settings, Trash2, Edit3, Sliders, Check, 
  Sparkles, Folder, Layers, Info
} from "lucide-react";
import { AttributeDefinition, AttributeGroup } from "../types.js";
import { apiFetchV1 } from "../lib/apiFetchV1";

interface AttributeManagerSectionProps {
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const AttributeManagerSection: React.FC<AttributeManagerSectionProps> = ({ 
  onNotification 
}) => {
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([]);
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states for Definitions
  const [defName, setDefName] = useState("");
  const [defLabel, setDefLabel] = useState("");
  const [defDataType, setDefDataType] = useState<"text" | "number" | "date" | "select">("select");
  const [defIsVariant, setDefIsVariant] = useState(true);
  const [defIsMandatory, setDefIsMandatory] = useState(true);
  const [defValues, setDefValues] = useState("");
  const [editingDefId, setEditingDefId] = useState<string | null>(null);

  // Extended config states
  const [isSearchable, setIsSearchable] = useState(true);
  const [isFilterable, setIsFilterable] = useState(true);
  const [isPrintable, setIsPrintable] = useState(true);
  const [isBarcodeEnabled, setIsBarcodeEnabled] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [defaultValue, setDefaultValue] = useState("");
  const [tooltip, setTooltip] = useState("");
  const [validationRules, setValidationRules] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  // Form states for Groups
  const [grpName, setGrpName] = useState("");
  const [grpSelectedAttrs, setGrpSelectedAttrs] = useState<string[]>([]);
  const [grpGridCol, setGrpGridCol] = useState("");
  const [grpGridRow, setGrpGridRow] = useState("");
  const [editingGrpId, setEditingGrpId] = useState<string | null>(null);

  // Form states for Mappings
  const [mappingCategory, setMappingCategory] = useState("Apparel");
  const [mappingGroupId, setMappingGroupId] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [res1, res2, res3] = await Promise.all([
        apiFetchV1("/attributes/definitions"),
        apiFetchV1("/attributes/groups"),
        apiFetchV1("/attributes/category-mappings")
      ]);
      setDefinitions(res1);
      setGroups(res2);
      setCategoryMappings(res3);
    } catch (e) {
      console.error(e);
      onNotification("Fetch Error", "Failed to load attribute configurations.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleLoadTemplate = async (templateName: string) => {
    setLoading(true);
    try {
      await apiFetchV1("/attributes/load-template", {
        method: "POST",
        body: JSON.stringify({ industry: templateName })
      });
      onNotification("Template Loaded", `Pre-configured template "${templateName}" seeded successfully in Postgres.`, "success");
      await fetchAll();
    } catch (err: any) {
      onNotification("Template Error", err.message || "Failed to load template.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defName.trim() || !defLabel.trim()) {
      onNotification("Missing Fields", "Attribute Name and Label are required.", "error");
      return;
    }

    const valueList = defValues
      .split(",")
      .map(v => v.trim())
      .filter(v => v.length > 0);

    const payload = {
      name: defName.trim(),
      label: defLabel.trim(),
      dataType: defDataType,
      isVariantDimension: defIsVariant,
      isMandatory: defIsMandatory,
      validValues: valueList,
      isSearchable,
      isFilterable,
      isPrintable,
      isBarcodeEnabled,
      displayOrder,
      defaultValue: defaultValue || undefined,
      tooltip: tooltip || undefined,
      validationRules: validationRules || undefined,
      isEnabled,
      multiLangLabels: {}
    };

    try {
      const url = editingDefId 
        ? `/attributes/definitions/${editingDefId}`
        : "/attributes/definitions";
      const method = editingDefId ? "PUT" : "POST";

      await apiFetchV1(url, {
        method,
        body: JSON.stringify(payload)
      });

      onNotification("Saved", `Attribute "${defLabel}" registered successfully.`, "success");
      setDefName("");
      setDefLabel("");
      setDefDataType("select");
      setDefValues("");
      setDefaultValue("");
      setTooltip("");
      setValidationRules("");
      setDisplayOrder(0);
      setEditingDefId(null);
      fetchAll();
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to save attribute.", "error");
    }
  };

  const handleDeleteDef = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attribute definition? It may affect templates.")) return;
    try {
      await apiFetchV1(`/attributes/definitions/${id}`, { method: "DELETE" });
      onNotification("Deleted", "Attribute definition deleted.", "success");
      fetchAll();
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to delete definition.", "error");
    }
  };

  const handleEditDef = (def: any) => {
    setEditingDefId(def.id);
    setDefName(def.name);
    setDefLabel(def.label);
    setDefDataType(def.dataType);
    setDefIsVariant(def.isVariantDimension);
    setDefIsMandatory(def.isMandatory);
    setDefValues(def.validValues?.join(", ") || "");
    setIsSearchable(def.isSearchable ?? true);
    setIsFilterable(def.isFilterable ?? true);
    setIsPrintable(def.isPrintable ?? true);
    setIsBarcodeEnabled(def.isBarcodeEnabled ?? true);
    setDisplayOrder(def.displayOrder ?? 0);
    setDefaultValue(def.defaultValue || "");
    setTooltip(def.tooltip || "");
    setValidationRules(def.validationRules || "");
    setIsEnabled(def.isEnabled ?? true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grpName.trim() || grpSelectedAttrs.length === 0) {
      onNotification("Missing Fields", "Group name and at least one attribute are required.", "error");
      return;
    }

    const payload = {
      name: grpName.trim(),
      attributeIds: grpSelectedAttrs,
      gridColumnAttributeId: grpGridCol || undefined,
      gridRowAttributeId: grpGridRow || undefined
    };

    try {
      const url = editingGrpId 
        ? `/attributes/groups/${editingGrpId}`
        : "/attributes/groups";
      const method = editingGrpId ? "PUT" : "POST";

      await apiFetchV1(url, {
        method,
        body: JSON.stringify(payload)
      });

      onNotification("Saved", `Group "${grpName}" registered successfully.`, "success");
      setGrpName("");
      setGrpSelectedAttrs([]);
      setGrpGridCol("");
      setGrpGridRow("");
      setEditingGrpId(null);
      fetchAll();
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to save group.", "error");
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attribute group?")) return;
    try {
      await apiFetchV1(`/attributes/groups/${id}`, { method: "DELETE" });
      onNotification("Deleted", "Attribute group deleted.", "success");
      fetchAll();
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to delete group.", "error");
    }
  };

  const handleEditGroup = (g: AttributeGroup) => {
    setEditingGrpId(g.id);
    setGrpName(g.name);
    setGrpSelectedAttrs(g.attributeIds);
    setGrpGridCol(g.gridColumnAttributeId || "");
    setGrpGridRow(g.gridRowAttributeId || "");
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingGroupId) {
      onNotification("Missing Fields", "Please select an attribute group for the mapping.", "error");
      return;
    }

    try {
      await apiFetchV1("/attributes/category-mappings", {
        method: "POST",
        body: JSON.stringify({
          category: mappingCategory,
          attributeGroupId: mappingGroupId
        })
      });
      onNotification("Saved", `Category "${mappingCategory}" mapped successfully.`, "success");
      fetchAll();
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to map category.", "error");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic Information Banner */}
      <div className="bg-theme-surface-2 border border-blue-900/40 p-4 rounded-xl flex items-start space-x-3 text-blue-300">
        <Info className="shrink-0 mt-0.5" size={16} />
        <div className="text-xs space-y-1">
          <p className="font-bold">SMRITI Data-Driven Extensible Architecture</p>
          <p className="text-theme-muted leading-relaxed">
            Avoid hardcoding columns. Define attributes, order them inside groups, and let SMRITI auto-generate item codes, validation spreadsheets, size matrix grids, and aggregate reports automatically!
          </p>
        </div>
      </div>

      {/* One-Click Industry Templates Panel */}
      <div className="bg-theme-surface-1 border border-theme-divider p-5 rounded-2xl space-y-4">
        <h4 className="font-display font-bold text-xs text-theme-body flex items-center space-x-2">
          <Sparkles size={14} className="text-amber-400" />
          <span>One-Click Industry Configuration Templates</span>
        </h4>
        <p className="text-[11px] text-theme-muted">Select an industry to automatically seed dynamic attribute definitions, sizing grids, and category maps into Postgres.</p>
        
        <div className="flex flex-wrap gap-3">
          {["Footwear", "Apparel", "Grocery", "Electronics", "Jewellery"].map(ind => (
            <button
              key={ind}
              onClick={() => handleLoadTemplate(ind)}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-body text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <span>{ind} Template</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Attribute Definitions */}
        <div className="space-y-6">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-theme-divider/50 pb-3">
              <h3 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2">
                <Sliders size={16} className="text-blue-400" />
                <span>1. Attribute Definitions</span>
              </h3>
              <span className="text-[10px] font-mono text-theme-muted">{definitions.length} Active</span>
            </div>

            {/* List of Definitions */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {definitions.map(def => (
                <div key={def.id} className="bg-theme-surface-2 p-3 rounded-xl border border-theme-divider/60 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-theme-body">{def.label}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 bg-indigo-950 text-indigo-400 border border-indigo-900 rounded uppercase font-bold">
                        {def.dataType}
                      </span>
                      {def.isVariantDimension && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded font-bold uppercase font-sans">
                          Variant Segment
                        </span>
                      )}
                    </div>
                    {def.validValues && def.validValues.length > 0 && (
                      <p className="text-[10px] text-theme-muted mt-1 font-mono truncate max-w-sm">
                        Values: {def.validValues.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button onClick={() => handleEditDef(def)} className="p-1 hover:bg-theme-surface-3 text-sky-400 rounded transition-colors">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => handleDeleteDef(def.id)} className="p-1 hover:bg-rose-950/40 text-rose-400 rounded transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Form to Create/Edit Definition */}
            <form onSubmit={handleSaveDef} className="bg-theme-surface-2/50 border border-dashed border-theme-divider p-4 rounded-xl space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold block">
                {editingDefId ? "Modify Attribute" : "Add New Attribute Definition"}
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Internal Name *</label>
                  <input
                    type="text"
                    required
                    value={defName}
                    onChange={(e) => setDefName(e.target.value)}
                    placeholder="e.g. sole_type"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Display Label *</label>
                  <input
                    type="text"
                    required
                    value={defLabel}
                    onChange={(e) => setDefLabel(e.target.value)}
                    placeholder="e.g. Sole Material"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Data Type</label>
                  <select
                    value={defDataType}
                    onChange={(e: any) => setDefDataType(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                  >
                    <option value="select">Select Option List</option>
                    <option value="text">Free Text</option>
                    <option value="number">Numeric</option>
                    <option value="date">Date picker</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center space-x-1.5 text-xs text-theme-muted py-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={defIsVariant}
                      onChange={(e) => setDefIsVariant(e.target.checked)}
                      className="rounded bg-theme-surface-2 border-theme-divider"
                    />
                    <span>Variant Dimension</span>
                  </label>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center space-x-1.5 text-xs text-theme-muted py-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={defIsMandatory}
                      onChange={(e) => setDefIsMandatory(e.target.checked)}
                      className="rounded bg-theme-surface-2 border-theme-divider"
                    />
                    <span>Mandatory</span>
                  </label>
                </div>
              </div>

              {defDataType === "select" && (
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">
                    Allowed Values (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={defValues}
                    onChange={(e) => setDefValues(e.target.value)}
                    placeholder="e.g. Rubber, PU, PVC, Leather"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              )}

              {/* Extended Settings Grid */}
              <div className="bg-theme-surface-2 p-3 rounded-xl border border-theme-divider space-y-2.5">
                <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider block font-bold">Metadata & Search Settings</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center space-x-1.5 text-xs text-theme-muted cursor-pointer">
                    <input type="checkbox" checked={isSearchable} onChange={e => setIsSearchable(e.target.checked)} className="rounded" />
                    <span>Searchable (POS/Search)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs text-theme-muted cursor-pointer">
                    <input type="checkbox" checked={isFilterable} onChange={e => setIsFilterable(e.target.checked)} className="rounded" />
                    <span>Filterable (Reports)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs text-theme-muted cursor-pointer">
                    <input type="checkbox" checked={isPrintable} onChange={e => setIsPrintable(e.target.checked)} className="rounded" />
                    <span>Printable (Invoice/PO)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs text-theme-muted cursor-pointer">
                    <input type="checkbox" checked={isBarcodeEnabled} onChange={e => setIsBarcodeEnabled(e.target.checked)} className="rounded" />
                    <span>Barcode Enabled</span>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1.5">
                  <div>
                    <label className="text-[8px] font-mono text-theme-muted uppercase block">Display Order</label>
                    <input type="number" value={displayOrder} onChange={e => setDisplayOrder(parseInt(e.target.value) || 0)} className="w-full bg-theme-surface-1 border border-theme-divider rounded px-2 py-0.5 text-[11px] text-white" />
                  </div>
                  <div>
                    <label className="text-[8px] font-mono text-theme-muted uppercase block">Default Value</label>
                    <input type="text" value={defaultValue} onChange={e => setDefaultValue(e.target.value)} className="w-full bg-theme-surface-1 border border-theme-divider rounded px-2 py-0.5 text-[11px] text-white" />
                  </div>
                  <div>
                    <label className="text-[8px] font-mono text-theme-muted uppercase block">Tooltip Help</label>
                    <input type="text" value={tooltip} onChange={e => setTooltip(e.target.value)} className="w-full bg-theme-surface-1 border border-theme-divider rounded px-2 py-0.5 text-[11px] text-white" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                {editingDefId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDefId(null);
                      setDefName("");
                      setDefLabel("");
                      setDefValues("");
                    }}
                    className="px-3 py-1.5 bg-theme-surface-3 text-theme-muted hover:text-white rounded text-xs animate-pulse"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs flex items-center space-x-1"
                >
                  <Check size={12} />
                  <span>{editingDefId ? "Update Attribute" : "Save Definition"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Attribute Groups & Mappings */}
        <div className="space-y-6">
          
          {/* Groups configuration */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-theme-divider/50 pb-3">
              <h3 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2">
                <Folder size={16} className="text-violet-400" />
                <span>2. Attribute Groups</span>
              </h3>
              <span className="text-[10px] font-mono text-theme-muted">{groups.length} Groups</span>
            </div>

            {/* List of Groups */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {groups.map(g => (
                <div key={g.id} className="bg-theme-surface-2 p-3 rounded-xl border border-theme-divider/60 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-theme-body block">{g.name}</span>
                    <span className="text-[9px] font-mono text-theme-muted block mt-0.5">
                      Contains {g.attributeIds.length} attributes
                      {g.gridColumnAttributeId && ` • Col: ${definitions.find(d => d.id === g.gridColumnAttributeId)?.label}`}
                      {g.gridRowAttributeId && ` • Row: ${definitions.find(d => d.id === g.gridRowAttributeId)?.label}`}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button onClick={() => handleEditGroup(g)} className="p-1 hover:bg-theme-surface-3 text-sky-400 rounded transition-colors">
                      <Edit3 size={11} />
                    </button>
                    <button onClick={() => handleDeleteGroup(g.id)} className="p-1 hover:bg-rose-950/40 text-rose-400 rounded transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Create/Edit Group Form */}
            <form onSubmit={handleSaveGroup} className="bg-theme-surface-2/50 border border-dashed border-theme-divider p-4 rounded-xl space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400 font-bold block">
                {editingGrpId ? "Modify Attribute Group" : "Create Attribute Group"}
              </span>

              <div>
                <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Group name *</label>
                <input
                  type="text"
                  required
                  value={grpName}
                  onChange={(e) => setGrpName(e.target.value)}
                  placeholder="e.g. Footwear Standard"
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body"
                />
              </div>

              <div>
                <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Linked Attribute definitions (Select Multiple)</label>
                <div className="grid grid-cols-2 gap-1.5 bg-theme-surface-2 p-2 border border-theme-divider rounded-lg max-h-28 overflow-y-auto">
                  {definitions.map(def => (
                    <label key={def.id} className="flex items-center space-x-1.5 text-[11px] text-theme-muted cursor-pointer hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={grpSelectedAttrs.includes(def.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGrpSelectedAttrs(prev => [...prev, def.id]);
                          } else {
                            setGrpSelectedAttrs(prev => prev.filter(id => id !== def.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span>{def.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Matrix Grid Column Dimension</label>
                  <select
                    value={grpGridCol}
                    onChange={(e) => setGrpGridCol(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-xs text-theme-body"
                  >
                    <option value="">-- Optional --</option>
                    {grpSelectedAttrs.map(aid => {
                      const def = definitions.find(d => d.id === aid);
                      return def ? <option key={def.id} value={def.id}>{def.label}</option> : null;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Matrix Grid Row Dimension</label>
                  <select
                    value={grpGridRow}
                    onChange={(e) => setGrpGridRow(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-xs text-theme-body"
                  >
                    <option value="">-- Optional --</option>
                    {grpSelectedAttrs.map(aid => {
                      const def = definitions.find(d => d.id === aid);
                      return def ? <option key={def.id} value={def.id}>{def.label}</option> : null;
                    })}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                {editingGrpId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGrpId(null);
                      setGrpName("");
                      setGrpSelectedAttrs([]);
                      setGrpGridCol("");
                      setGrpGridRow("");
                    }}
                    className="px-3 py-1.5 bg-theme-surface-3 text-theme-muted hover:text-white rounded text-xs"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs"
                >
                  Save Group
                </button>
              </div>
            </form>
          </div>

          {/* Category to Attribute mappings */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2 border-b border-theme-divider/50 pb-3">
              <Layers size={16} className="text-emerald-400" />
              <span>3. Category Mapping Registry</span>
            </h3>

            {/* List of mappings */}
            <div className="space-y-1.5 max-h-24 overflow-y-auto">
              {categoryMappings.map(m => (
                <div key={m.category} className="bg-theme-surface-2 px-3 py-1.5 rounded-lg text-xs flex justify-between items-center font-mono">
                  <span className="text-emerald-400 font-bold">{m.category}</span>
                  <span className="text-theme-muted">→</span>
                  <span className="text-indigo-300 font-bold">
                    {groups.find(g => g.id === m.attributeGroupId)?.name || m.attributeGroupId}
                  </span>
                </div>
              ))}
            </div>

            {/* Create Mapping Form */}
            <form onSubmit={handleSaveMapping} className="bg-theme-surface-2/50 border border-dashed border-theme-divider p-4 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Item Category</label>
                  <select
                    value={mappingCategory}
                    onChange={(e) => setMappingCategory(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1.5 text-xs text-theme-body font-bold"
                  >
                    <option value="Apparel">Apparel</option>
                    <option value="Footwear">Footwear</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Jewellery">Jewellery</option>
                    <option value="Accessories">Accessories</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Mapped Group</label>
                  <select
                    value={mappingGroupId}
                    onChange={(e) => setMappingGroupId(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1.5 text-xs text-theme-body"
                  >
                    <option value="">-- Choose group --</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs"
                >
                  Apply Map
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
};
