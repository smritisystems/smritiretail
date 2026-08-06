/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI No-Code Visual Industry Pack Designer (ADR-IPD-001)
 * Standard     : UFR-001 / SCS-WIN-001 — Visual Metadata Form Configurator
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * Non-Developer Business Admin Visual Studio to create & customize Industry Packs,
 * dynamic item attributes, grid spans, validations, searchability & print tags
 * without writing TSX/JavaScript code!
 */

import React, { useState } from "react";
import {
  Layers, Plus, Trash2, CheckCircle2, Sparkles, Save, Eye,
  Settings, Grid, Tag, Sliders, Type, Hash, Calendar, ToggleLeft, Database, Download, Upload, Store
} from "lucide-react";
import { FormRegistry, FormFieldDefinition } from "../kernel/upr/forms/FormRegistry.js";
import { recordAuditAction } from "../lib/apiFetch.ts";

export interface CustomIndustryAttribute extends FormFieldDefinition {
  isSearchable: boolean;
  isPrintable: boolean;
  isReportable: boolean;
}

export interface CustomIndustryPackDef {
  id: string;
  name: string;
  categoryTarget: string;
  icon: string;
  attributes: CustomIndustryAttribute[];
}

export const IndustryPackDesignerTab: React.FC = () => {
  const [packs, setPacks] = useState<CustomIndustryPackDef[]>([
    {
      id: "pack_footwear",
      name: "Footwear & Sports Pack",
      categoryTarget: "Footwear",
      icon: "boot",
      attributes: [
        { id: "shoeSize", label: "Shoe Size (UK/US)", type: "number", required: true, gridSpan: 4, isSearchable: true, isPrintable: true, isReportable: true },
        { id: "upperMaterial", label: "Upper Material", type: "select", options: [{ label: "Leather", value: "Leather" }, { label: "Mesh", value: "Mesh" }, { label: "Synthetic", value: "Synthetic" }], gridSpan: 4, isSearchable: true, isPrintable: true, isReportable: true },
        { id: "heelHeight", label: "Heel Height (cm)", type: "number", gridSpan: 4, isSearchable: false, isPrintable: false, isReportable: true },
      ],
    },
    {
      id: "pack_jewellery",
      name: "Jewellery & Precious Metals Pack",
      categoryTarget: "Jewellery",
      icon: "gem",
      attributes: [
        { id: "goldPurity", label: "Gold Purity (Carat)", type: "select", options: [{ label: "24K (999)", value: "24K" }, { label: "22K (916)", value: "22K" }, { label: "18K (750)", value: "18K" }], required: true, gridSpan: 6, isSearchable: true, isPrintable: true, isReportable: true },
        { id: "grossWeight", label: "Gross Weight (Grams)", type: "number", required: true, gridSpan: 6, isSearchable: true, isPrintable: true, isReportable: true },
      ],
    },
  ]);

  const [activePackId, setActivePackId] = useState<string>("pack_footwear");
  const [newAttrName, setNewAttrName] = useState<string>("");
  const [newAttrType, setNewAttrType] = useState<any>("text");
  const [newAttrRequired, setNewAttrRequired] = useState<boolean>(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string>("");

  const activePack = packs.find((p) => p.id === activePackId) || packs[0];

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) return;
    const attrId = newAttrName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const newAttr: CustomIndustryAttribute = {
      id: attrId,
      label: newAttrName,
      type: newAttrType,
      required: newAttrRequired,
      gridSpan: 4,
      isSearchable: true,
      isPrintable: true,
      isReportable: true,
    };

    setPacks((prev) =>
      prev.map((p) => (p.id === activePackId ? { ...p, attributes: [...p.attributes, newAttr] } : p))
    );

    setNewAttrName("");
    setSavedSuccessMessage(`Added "${newAttrName}" attribute.`);
    setTimeout(() => setSavedSuccessMessage(""), 2000);
  };

  const handleRemoveAttribute = (attrId: string) => {
    setPacks((prev) =>
      prev.map((p) => (p.id === activePackId ? { ...p, attributes: p.attributes.filter((a) => a.id !== attrId) } : p))
    );
  };

  const handleSaveToFormRegistry = () => {
    // Dynamically register with UPR FormRegistry
    FormRegistry.registerForm(`product_${activePack.id}`, {
      id: `product_${activePack.id}`,
      name: activePack.name,
      entityId: "product",
      sections: [
        {
          id: "industry_attributes",
          title: `${activePack.name} Attributes`,
          fields: activePack.attributes,
        },
      ],
    });

    recordAuditAction("SAVE", "industry_pack_designer", activePack.id, `Saved visual no-code Industry Pack metadata for ${activePack.name}`);
    setSavedSuccessMessage(`Successfully published ${activePack.name} to UPR FormRegistry!`);
    setTimeout(() => setSavedSuccessMessage(""), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-theme-base text-theme-body font-sans">
      {/* Header */}
      <div className="p-5 border-b border-theme-divider bg-theme-surface-1 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold font-display text-theme-heading">SMRITI Visual No-Code Industry Pack Designer</h1>
          </div>
          <p className="text-xs text-theme-muted mt-0.5">
            Configure dynamic item attributes, forms, search filters &amp; print tags visually without writing code
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccessMessage && (
            <span className="text-xs text-emerald-400 font-bold font-mono px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-1.5">
              <CheckCircle2 size={13} /> {savedSuccessMessage}
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveToFormRegistry}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Save size={14} />
            <span>Publish Pack to UPR</span>
          </button>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        {/* Left Sidebar: Industry Pack Selector */}
        <div className="md:col-span-3 p-4 border-r border-theme-divider bg-theme-surface-2 space-y-3 overflow-auto">
          <div className="text-[10px] text-theme-muted font-bold uppercase tracking-wider block">Available Industry Packs</div>
          <div className="space-y-2 font-mono text-xs">
            {packs.map((p) => (
              <div
                key={p.id}
                onClick={() => setActivePackId(p.id)}
                className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                  activePackId === p.id ? "bg-theme-surface-1 border-emerald-500/50 text-emerald-400 shadow-sm" : "bg-theme-surface-1/40 border-theme-divider text-theme-muted hover:text-theme-body"
                }`}
              >
                <div className="font-bold text-sm font-sans">{p.name}</div>
                <div className="text-[10px] mt-1 text-theme-muted flex justify-between">
                  <span>Target: {p.categoryTarget}</span>
                  <span className="font-bold text-indigo-400">{p.attributes.length} Attributes</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center Canvas: Attribute Designer */}
        <div className="md:col-span-9 p-5 overflow-auto space-y-5">
          <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-3 font-mono text-xs">
            <h3 className="font-bold text-sm text-theme-heading font-display">Add Dynamic Attribute to {activePack.name}</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-theme-muted block mb-1">Attribute Name</label>
                <input
                  type="text"
                  placeholder="e.g. Fabric Type, Heel Height"
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-theme-muted block mb-1">Control Type</label>
                <select
                  value={newAttrType}
                  onChange={(e) => setNewAttrType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading font-bold outline-none"
                >
                  <option value="text">Text Input</option>
                  <option value="number">Number Input</option>
                  <option value="select">Dropdown Select</option>
                  <option value="checkbox">Checkbox Toggle</option>
                  <option value="date">Date Picker</option>
                  <option value="lookup">Universal Lookup (ULE)</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs font-bold text-theme-heading cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAttrRequired}
                    onChange={(e) => setNewAttrRequired(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span>Mandatory Field</span>
                </label>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddAttribute}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Add Attribute
                </button>
              </div>
            </div>
          </div>

          {/* Attributes List */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-theme-heading font-display">Configured Attributes ({activePack.attributes.length})</h3>

            <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-1 font-mono text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-theme-surface-2 border-b border-theme-divider text-[10px] font-bold uppercase text-theme-muted">
                    <th className="p-3">Attribute Name</th>
                    <th className="p-3">Field ID</th>
                    <th className="p-3">Control Type</th>
                    <th className="p-3 text-center">Required</th>
                    <th className="p-3 text-center">Auto-Search</th>
                    <th className="p-3 text-center">Auto-Print</th>
                    <th className="p-3 text-center">Auto-Report</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider">
                  {activePack.attributes.map((attr) => (
                    <tr key={attr.id} className="hover:bg-theme-surface-2/40 transition-colors">
                      <td className="p-3 font-bold text-theme-heading font-sans">{attr.label}</td>
                      <td className="p-3 text-indigo-400">{attr.id}</td>
                      <td className="p-3 text-theme-muted uppercase text-[10px] font-bold">{attr.type}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${attr.required ? "bg-emerald-500/20 text-emerald-400" : "bg-theme-surface-2 text-theme-muted"}`}>
                          {attr.required ? "YES" : "NO"}
                        </span>
                      </td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveAttribute(attr.id)}
                          className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
