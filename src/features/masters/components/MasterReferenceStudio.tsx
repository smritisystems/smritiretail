/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-MASTER-001 — Unified Master & Reference Studio
 * Feature      : src/features/masters/components/MasterReferenceStudio.tsx
 * Standard     : Single Workspace Principle (Rule PROD-002 / SWP-001) & Promote Before Create (Rule PBC-001)
 */

import React, { useState, useEffect } from "react";
import {
  Database,
  Sliders,
  Layers,
  Link,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Tag,
  FolderTree,
  Loader2,
  Save,
  X,
  Edit2
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetch";

export interface MasterTypeItem {
  id: string;
  code: string;
  label: string;
  category_type: "SYSTEM" | "REFERENCE" | "BUSINESS" | "OPERATIONAL";
  is_system: boolean;
  field_schema?: any;
  ui_schema?: any;
}

export interface MasterValueItem {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sort_order: number;
  data?: Record<string, any>;
  tenant_id?: string;
  branch_id?: string;
}

export interface AttributeDefinitionItem {
  id: string;
  name: string;
  label: string;
  data_type: string;
  is_variant_dimension: boolean;
  is_mandatory: boolean;
  valid_values?: string[];
  group_id?: string;
  is_searchable?: boolean;
  is_filterable?: boolean;
  is_printable?: boolean;
  is_barcode_enabled?: boolean;
  display_order?: number;
}

export interface AttributeGroupItem {
  id: string;
  name: string;
  attribute_ids: string[];
}

export interface CategoryMappingItem {
  id: string;
  category: string;
  attribute_group_id: string;
}

export const MasterReferenceStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"masters" | "attributes" | "groups" | "mappings">("masters");
  
  // Master Types & Values State
  const [masterTypes, setMasterTypes] = useState<MasterTypeItem[]>([]);
  const [selectedType, setSelectedType] = useState<MasterTypeItem | null>(null);
  const [masterValues, setMasterValues] = useState<MasterValueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Value Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [valCode, setValCode] = useState<string>("");
  const [valName, setValName] = useState<string>("");
  const [editingValueId, setEditingValueId] = useState<string | null>(null);

  // Attribute Configuration State
  const [definitions, setDefinitions] = useState<AttributeDefinitionItem[]>([]);
  const [groups, setGroups] = useState<AttributeGroupItem[]>([]);
  const [mappings, setMappings] = useState<CategoryMappingItem[]>([]);

  // New Attribute Definition Form State
  const [attrName, setAttrName] = useState("");
  const [attrLabel, setAttrLabel] = useState("");
  const [attrDataType, setAttrDataType] = useState("Text");
  const [attrIsVariant, setAttrIsVariant] = useState(false);
  const [attrIsMandatory, setAttrIsMandatory] = useState(false);
  const [attrValidValues, setAttrValidValues] = useState("");

  // New Category Mapping Form State
  const [mapCategory, setMapCategory] = useState("");
  const [mapGroupId, setMapGroupId] = useState("");

  // Load Initial Master Types & Definitions
  useEffect(() => {
    loadMasterTypes();
    loadAttributeConfigurations();
  }, []);

  useEffect(() => {
    if (selectedType) {
      loadMasterValues(selectedType.code);
    }
  }, [selectedType]);

  const loadMasterTypes = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetchV1<MasterTypeItem[]>("master-lookups/types");
      if (Array.isArray(res) && res.length > 0) {
        setMasterTypes(res);
        setSelectedType(res[0]);
      } else {
        // Fallback default master types if backend database is offline
        const defaults: MasterTypeItem[] = [
          { id: "1", code: "product_category", label: "Product Category", category_type: "BUSINESS", is_system: false },
          { id: "2", code: "product_brand", label: "Product Brand", category_type: "BUSINESS", is_system: false },
          { id: "3", code: "uom", label: "Unit of Measure (UOM)", category_type: "SYSTEM", is_system: true },
          { id: "4", code: "payment_mode", label: "Payment Mode", category_type: "SYSTEM", is_system: true },
          { id: "5", code: "product_color", label: "Product Color", category_type: "BUSINESS", is_system: false },
          { id: "6", code: "state", label: "State / Province", category_type: "REFERENCE", is_system: true },
          { id: "7", code: "reason_code", label: "Reason Code", category_type: "REFERENCE", is_system: false }
        ];
        setMasterTypes(defaults);
        setSelectedType(defaults[0]);
      }
    } catch (e) {
      console.warn("[MasterStudio] Failed loading master types, using fallback.", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMasterValues = async (typeCode: string) => {
    setIsLoading(true);
    try {
      const res = await apiFetchV1<MasterValueItem[]>(`master-lookups/values/${typeCode}`);
      if (Array.isArray(res)) {
        setMasterValues(res);
      }
    } catch (e) {
      console.warn(`[MasterStudio] Failed loading values for ${typeCode}`, e);
      setMasterValues([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttributeConfigurations = async () => {
    try {
      const defsRes = await apiFetchV1<AttributeDefinitionItem[]>("attributes/definitions");
      if (Array.isArray(defsRes)) setDefinitions(defsRes);

      const grpsRes = await apiFetchV1<AttributeGroupItem[]>("attributes/groups");
      if (Array.isArray(grpsRes)) setGroups(grpsRes);

      const mapsRes = await apiFetchV1<CategoryMappingItem[]>("attributes/category-mappings");
      if (Array.isArray(mapsRes)) setMappings(mapsRes);
    } catch (e) {
      console.warn("[MasterStudio] Failed loading attribute configs", e);
    }
  };

  const handleSaveMasterValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !valCode.trim() || !valName.trim()) return;

    try {
      if (editingValueId) {
        await apiFetchV1(`master-lookups/values/${editingValueId}`, {
          method: "PATCH",
          body: JSON.stringify({ code: valCode, name: valName, active: true }),
        });
      } else {
        await apiFetchV1(`master-lookups/values/${selectedType.code}`, {
          method: "POST",
          body: JSON.stringify({
            code: valCode,
            name: valName,
            active: true
          }),
        });
      }
      setIsModalOpen(false);
      setValCode("");
      setValName("");
      setEditingValueId(null);
      loadMasterValues(selectedType.code);
    } catch (err) {
      console.error("[MasterStudio] Save value error:", err);
    }
  };

  const handleCreateAttributeDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attrName.trim() || !attrLabel.trim()) return;

    try {
      const validValsArray = attrValidValues
        ? attrValidValues.split(",").map((v) => v.trim()).filter(Boolean)
        : [];

      await apiFetchV1("attributes/definitions", {
        method: "POST",
        body: JSON.stringify({
          name: attrName,
          label: attrLabel,
          data_type: attrDataType,
          is_variant_dimension: attrIsVariant,
          is_mandatory: attrIsMandatory,
          valid_values: validValsArray
        }),
      });

      setAttrName("");
      setAttrLabel("");
      setAttrValidValues("");
      loadAttributeConfigurations();
    } catch (err) {
      console.error("[MasterStudio] Create attribute error:", err);
    }
  };

  const handleCreateCategoryMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapCategory.trim() || !mapGroupId) return;

    try {
      await apiFetchV1("attributes/category-mappings", {
        method: "POST",
        body: JSON.stringify({
          category: mapCategory,
          attribute_group_id: mapGroupId
        }),
      });

      setMapCategory("");
      setMapGroupId("");
      loadAttributeConfigurations();
    } catch (err) {
      console.error("[MasterStudio] Create mapping error:", err);
    }
  };

  const filteredValues = masterValues.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getGovernanceBadge = (type?: "SYSTEM" | "REFERENCE" | "BUSINESS" | "OPERATIONAL") => {
    switch (type) {
      case "SYSTEM":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1"><ShieldAlert size={11} /> System (Restricted)</span>;
      case "REFERENCE":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1"><ShieldCheck size={11} /> Reference (Controlled)</span>;
      case "OPERATIONAL":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1"><FolderTree size={11} /> Operational (Governed)</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><Tag size={11} /> Business (Editable)</span>;
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Database size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-wide flex items-center gap-2">
              Master & Reference Studio
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                SWP-001 Compliant
              </span>
            </h1>
            <p className="text-xs text-slate-400">Single metadata-driven workspace for enterprise business masters & attribute definitions.</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("masters")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === "masters" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database size={13} />
            <span>Master Data</span>
          </button>
          <button
            onClick={() => setActiveTab("attributes")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === "attributes" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders size={13} />
            <span>Attribute Specs</span>
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === "groups" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers size={13} />
            <span>Groups</span>
          </button>
          <button
            onClick={() => setActiveTab("mappings")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === "mappings" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Link size={13} />
            <span>Category Rules</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body */}
      {activeTab === "masters" && (
        <div className="flex-1 flex overflow-hidden">
          {/* Master Types Left Navigation Pane */}
          <div className="w-64 bg-slate-900/60 border-r border-slate-800 flex flex-col">
            <div className="p-3 border-b border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Discovered Master Types</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {masterTypes.map((mt) => (
                <button
                  key={mt.code}
                  onClick={() => setSelectedType(mt)}
                  className={`w-full text-left p-2.5 rounded-xl transition flex flex-col space-y-1 ${
                    selectedType?.code === mt.code
                      ? "bg-indigo-600/20 border border-indigo-500/40 text-indigo-200"
                      : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                  }`}
                >
                  <div className="font-semibold text-xs truncate">{mt.label}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{mt.code}</span>
                    {getGovernanceBadge(mt.category_type)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Master Values Datatable Pane */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden p-6 space-y-4">
            {selectedType && (
              <>
                <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      {selectedType.label}
                      <span className="text-xs font-mono text-indigo-400">({selectedType.code})</span>
                    </h2>
                    <div className="mt-1">{getGovernanceBadge(selectedType.category_type)}</div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search values..."
                        className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setEditingValueId(null);
                        setValCode("");
                        setValName("");
                        setIsModalOpen(true);
                      }}
                      className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                    >
                      <Plus size={14} />
                      <span>Add Value</span>
                    </button>
                  </div>
                </div>

                {/* Values Data Grid */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                  {isLoading ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
                      <Loader2 size={18} className="animate-spin text-indigo-400" />
                      <span>Loading Master Values...</span>
                    </div>
                  ) : filteredValues.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-2">
                      <Database size={32} className="text-slate-600" />
                      <p className="text-xs">No records found for master type {selectedType.code}.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800 sticky top-0">
                          <tr>
                            <th className="p-3">Code</th>
                            <th className="p-3">Display Name</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {filteredValues.map((v) => (
                            <tr key={v.id} className="hover:bg-slate-800/40 transition">
                              <td className="p-3 font-mono text-indigo-300 font-semibold">{v.code}</td>
                              <td className="p-3 font-medium text-slate-100">{v.name}</td>
                              <td className="p-3">
                                {v.active ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 inline-flex items-center gap-1">
                                    <XCircle size={10} /> Inactive
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => {
                                    setEditingValueId(v.id);
                                    setValCode(v.code);
                                    setValName(v.name);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-400 transition"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Attribute Definitions Tab */}
      {activeTab === "attributes" && (
        <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden">
            {/* Create Attribute Definition Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Sliders size={14} className="text-indigo-400" />
                <span>Create Attribute Definition</span>
              </h3>
              <form onSubmit={handleCreateAttributeDefinition} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Attribute Name (Code)</label>
                  <input
                    type="text"
                    value={attrName}
                    onChange={(e) => setAttrName(e.target.value)}
                    placeholder="e.g. sole_material"
                    required
                    className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Display Label</label>
                  <input
                    type="text"
                    value={attrLabel}
                    onChange={(e) => setAttrLabel(e.target.value)}
                    placeholder="e.g. Sole Material"
                    required
                    className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data Type</label>
                  <select
                    value={attrDataType}
                    onChange={(e) => setAttrDataType(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Text font-sans">Text</option>
                    <option value="Number">Number</option>
                    <option value="Select">Select Dropdown</option>
                    <option value="Boolean">Boolean (Yes/No)</option>
                    <option value="Date">Date</option>
                  </select>
                </div>
                {attrDataType === "Select" && (
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Allowed Values (Comma Separated)</label>
                    <input
                      type="text"
                      value={attrValidValues}
                      onChange={(e) => setAttrValidValues(e.target.value)}
                      placeholder="e.g. Rubber, EVA, Leather"
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}
                <div className="flex items-center space-x-4 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attrIsVariant}
                      onChange={(e) => setAttrIsVariant(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-300">Variant Dimension</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attrIsMandatory}
                      onChange={(e) => setAttrIsMandatory(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-300">Mandatory</span>
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-600/20 mt-2"
                >
                  <Save size={14} />
                  <span>Save Definition</span>
                </button>
              </form>
            </div>

            {/* Definitions Datatable */}
            <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Registered Attribute Definitions</span>
                <span className="text-xs font-mono text-indigo-400">{definitions.length} total</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Label</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {definitions.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-mono text-indigo-300 font-semibold">{d.name}</td>
                        <td className="p-3 font-medium text-slate-100">{d.label}</td>
                        <td className="p-3 font-mono text-slate-400">{d.data_type}</td>
                        <td className="p-3 flex items-center gap-1.5">
                          {d.is_variant_dimension && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Variant</span>
                          )}
                          {d.is_mandatory && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">Required</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Mappings Tab */}
      {activeTab === "mappings" && (
        <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden">
            {/* Create Mapping Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Link size={14} className="text-indigo-400" />
                <span>Bind Category to Attribute Group</span>
              </h3>
              <form onSubmit={handleCreateCategoryMapping} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category Code/Name</label>
                  <input
                    type="text"
                    value={mapCategory}
                    onChange={(e) => setMapCategory(e.target.value)}
                    placeholder="e.g. Footwear"
                    required
                    className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Attribute Group ID</label>
                  <input
                    type="text"
                    value={mapGroupId}
                    onChange={(e) => setMapGroupId(e.target.value)}
                    placeholder="e.g. grp-footwear-01"
                    required
                    className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-600/20 mt-2"
                >
                  <Save size={14} />
                  <span>Save Category Rule</span>
                </button>
              </form>
            </div>

            {/* Mappings Datatable */}
            <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Category-Attribute Rules</span>
                <span className="text-xs font-mono text-indigo-400">{mappings.length} total</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3">Category</th>
                      <th className="p-3">Bound Attribute Group</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {mappings.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold text-slate-100">{m.category}</td>
                        <td className="p-3 font-mono text-indigo-300">{m.attribute_group_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Value Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">
                {editingValueId ? "Edit Master Value" : "Add Master Value"} ({selectedType?.code})
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMasterValue} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Value Code</label>
                <input
                  type="text"
                  value={valCode}
                  onChange={(e) => setValCode(e.target.value)}
                  placeholder="e.g. CAT-ELECTRONICS"
                  required
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Display Name</label>
                <input
                  type="text"
                  value={valName}
                  onChange={(e) => setValName(e.target.value)}
                  placeholder="e.g. Consumer Electronics"
                  required
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20"
                >
                  Save Value
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
