/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-13
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, Layers, Trash2, Edit3, Grid, CheckCircle2, 
  HelpCircle, Settings, RefreshCw, Layers3, ArrowRight
} from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { VariantTemplate, AttributeGroup, AttributeDefinition, Product } from "../types.js";

interface VariantTemplateSectionProps {
  products: Product[];
  onRefreshProducts: () => Promise<void>;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const VariantTemplateSection: React.FC<VariantTemplateSectionProps> = ({ 
  products, 
  onRefreshProducts, 
  onNotification 
}) => {
  const [templates, setTemplates] = useState<VariantTemplate[]>([]);
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<VariantTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states for Templates
  const [styleCode, setStyleCode] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("SMRITI");
  const [category, setCategory] = useState("Apparel");
  const [hsnCode, setHSNCode] = useState("61091000");
  const [basePrice, setBasePrice] = useState(0);
  const [baseMrp, setBaseMrp] = useState(0);
  const [gstPercentage, setGstPercentage] = useState(18);
  const [groupId, setGroupId] = useState("");
  const [pricingMode, setPricingMode] = useState<"Fixed" | "Weight-based" | "Negotiated" | "Service">("Fixed");
  const [trackingMode, setTrackingMode] = useState<"Standard" | "Batch" | "Serial" | "No-stock">("Standard");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Matrix generation grid values
  const [matrixCells, setMatrixCells] = useState<Record<string, { active: boolean; stock: number; price: number; mrp: number; costPrice: number; sku: string; barcode: string }>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res1, res2, res3] = await Promise.all([
        apiFetchV1("/attributes/templates"),
        apiFetchV1("/attributes/groups"),
        apiFetchV1("/attributes/definitions")
      ]);
      setTemplates(res1);
      setGroups(res2);
      setDefinitions(res3);
    } catch (e) {
      console.error(e);
      onNotification("Fetch Error", "Failed to load variant templates.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Set default matrices when template is selected
  useEffect(() => {
    if (!selectedTemplate) {
      setMatrixCells({});
      return;
    }
    const group = groups.find(g => g.id === selectedTemplate.attributeGroupId);
    if (!group) return;

    const colAttr = definitions.find(d => d.id === group.gridColumnAttributeId);
    const rowAttr = definitions.find(d => d.id === group.gridRowAttributeId);

    if (colAttr && rowAttr) {
      const initialCells: Record<string, { active: boolean; stock: number; price: number; mrp: number; costPrice: number; sku: string; barcode: string }> = {};
      rowAttr.validValues.forEach(rowVal => {
        colAttr.validValues.forEach(colVal => {
          // Check if variant already exists in catalog
          const constructedCode = `${selectedTemplate.styleCode}-${rowVal.toUpperCase()}-${colVal.toUpperCase()}`;
          const existing = products.find(p => p.code === constructedCode);

          initialCells[`${rowVal}::${colVal}`] = {
            active: !!existing,
            stock: existing ? existing.stock : 0,
            price: existing ? existing.price : selectedTemplate.basePrice,
            mrp: existing ? (existing.mrp || existing.price) : selectedTemplate.baseMrp,
            costPrice: existing ? (existing.costPrice || Math.round(existing.price * 0.6)) : Math.round(selectedTemplate.basePrice * 0.6),
            sku: existing ? (existing.sku || existing.code) : constructedCode,
            barcode: existing ? existing.barcode : `SMR-B${Math.floor(100000 + Math.random() * 900000)}`
          };
        });
      });
      setMatrixCells(initialCells);
    }
  }, [selectedTemplate, groups, definitions, products]);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleCode.trim() || !name.trim() || !groupId) {
      onNotification("Missing Fields", "Style Code, Name, and Attribute Group are required.", "error");
      return;
    }

    const payload = {
      styleCode: styleCode.trim().toUpperCase(),
      name: name.trim(),
      brand: brand.trim(),
      category,
      hsnCode: hsnCode.trim(),
      basePrice,
      baseMrp: baseMrp || basePrice,
      gstPercentage,
      attributeGroupId: groupId,
      pricingMode,
      trackingMode
    };

    try {
      const url = editingTemplateId 
        ? `/attributes/templates/${editingTemplateId}`
        : "/attributes/templates";
      const method = editingTemplateId ? "PUT" : "POST";

      await apiFetchV1(url, {
        method,
        body: JSON.stringify(payload)
      });

      onNotification("Saved", `Template "${name}" committed.`, "success");
      setStyleCode("");
      setName("");
      setGroupId("");
      setEditingTemplateId(null);
      fetchData();
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to save template.", "error");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template definition?")) return;
    try {
      await apiFetchV1(`/attributes/templates/${id}`, { method: "DELETE" });
      onNotification("Deleted", "Template has been removed.", "success");
      setSelectedTemplate(null);
      fetchData();
    } catch (err: any) {
      onNotification("Error", err.message || "Could not delete template.", "error");
    }
  };

  const handleEditTemplate = (t: VariantTemplate) => {
    setEditingTemplateId(t.id);
    setStyleCode(t.styleCode);
    setName(t.name);
    setBrand(t.brand);
    setCategory(t.category);
    setHSNCode(t.hsnCode);
    setBasePrice(t.basePrice);
    setBaseMrp(t.baseMrp);
    setGstPercentage(t.gstPercentage);
    setGroupId(t.attributeGroupId);
    setPricingMode(t.pricingMode);
    setTrackingMode(t.trackingMode);
  };

  const handleCommitMatrix = async () => {
    if (!selectedTemplate) return;
    const group = groups.find(g => g.id === selectedTemplate.attributeGroupId);
    if (!group) return;

    const colAttr = definitions.find(d => d.id === group.gridColumnAttributeId);
    const rowAttr = definitions.find(d => d.id === group.gridRowAttributeId);

    if (!colAttr || !rowAttr) {
      onNotification("Unsupported Grid", "This group is not configured with col/row dimensions.", "error");
      return;
    }

    const variantsToSubmit: any[] = [];

    rowAttr.validValues.forEach(rowVal => {
      colAttr.validValues.forEach(colVal => {
        const cell = matrixCells[`${rowVal}::${colVal}`];
        if (cell && cell.active) {
          variantsToSubmit.push({
            attributes: {
              [rowAttr.name]: rowVal,
              [colAttr.name]: colVal
            },
            price: cell.price,
            mrp: cell.mrp,
            stock: cell.stock,
            costPrice: cell.costPrice,
            sku: cell.sku,
            barcode: cell.barcode
          });
        }
      });
    });

    if (variantsToSubmit.length === 0) {
      onNotification("Empty Matrix", "Please active at least one grid cell first.", "error");
      return;
    }

    setLoading(true);
    try {
      await apiFetchV1(`/attributes/templates/${selectedTemplate.id}/generate-variants`, {
        method: "POST",
        body: JSON.stringify({ variants: variantsToSubmit })
      });

      onNotification("Success", `Registered ${variantsToSubmit.length} variants inside SMRITI master.`, "success");
      await onRefreshProducts();
    } catch (err: any) {
      onNotification("Matrix Error", err.message || "Failed to generate variants.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Helper to quickly check the number of active cells in current matrix
  const activeCellsCount = Object.values(matrixCells).filter(c => c.active).length;

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Template Registry Forms */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2 border-b border-theme-divider/50 pb-3">
              <Layers size={16} className="text-indigo-400" />
              <span>Variant Templates</span>
            </h3>

            {/* List of Templates */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {templates.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => setSelectedTemplate(t)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedTemplate?.id === t.id 
                      ? "bg-theme-surface-3 border-indigo-500 shadow-md" 
                      : "bg-theme-surface-2 border-theme-divider/60 hover:bg-[#152347]"
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-theme-body block">{t.name}</span>
                    <span className="text-[10px] text-theme-muted font-mono block mt-0.5">
                      Code base: <span className="text-indigo-300">{t.styleCode}</span> • Group: <span className="text-violet-400">{groups.find(g => g.id === t.attributeGroupId)?.name || t.attributeGroupId}</span>
                    </span>
                    <div className="flex items-center space-x-1.5 mt-1">
                      <span className="text-[9px] font-mono px-1 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded uppercase font-bold">
                        {t.pricingMode}
                      </span>
                      <span className="text-[9px] font-mono px-1 bg-sky-950 text-sky-400 border border-sky-900 rounded uppercase font-bold">
                        {t.trackingMode}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleEditTemplate(t)} className="p-1 hover:bg-theme-surface-3 text-sky-400 rounded transition-colors">
                      <Edit3 size={11} />
                    </button>
                    <button onClick={() => handleDeleteTemplate(t.id)} className="p-1 hover:bg-rose-950/40 text-rose-400 rounded transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Form to Create/Edit Template */}
            <form onSubmit={handleSaveTemplate} className="bg-theme-surface-2/50 border border-dashed border-theme-divider p-4 rounded-xl space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold block">
                {editingTemplateId ? "Modify Variant Template" : "Add Parent Variant Template"}
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Style Code prefix *</label>
                  <input
                    type="text"
                    required
                    value={styleCode}
                    onChange={(e) => setStyleCode(e.target.value)}
                    placeholder="e.g. SNE-LTH"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-xs text-theme-body placeholder-[#8892a4] font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Base Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Leather Sneaker"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-xs text-theme-body placeholder-[#8892a4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-xs text-theme-body font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-1.5 py-1 text-xs text-theme-body"
                  >
                    <option value="Apparel">Apparel</option>
                    <option value="Footwear">Footwear</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Jewellery">Jewellery</option>
                    <option value="Accessories">Accessories</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Base Price</label>
                  <input
                    type="number"
                    value={basePrice || ""}
                    onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-xs text-theme-body font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Base MRP</label>
                  <input
                    type="number"
                    value={baseMrp || ""}
                    onChange={(e) => setBaseMrp(parseFloat(e.target.value) || 0)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-xs text-theme-body font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">GST %</label>
                  <input
                    type="number"
                    value={gstPercentage}
                    onChange={(e) => setGstPercentage(parseInt(e.target.value) || 18)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-xs text-theme-body font-mono"
                  />
                </div>
              </div>

              {/* Modes */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Pricing Mode</label>
                  <select
                    value={pricingMode}
                    onChange={(e: any) => setPricingMode(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-1.5 py-1 text-xs text-theme-body"
                  >
                    <option value="Fixed">Fixed Pricing</option>
                    <option value="Weight-based">Weight-based (rate/g)</option>
                    <option value="Negotiated">Negotiated below MRP</option>
                    <option value="Service">Service Charge</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Stock Tracking Mode</label>
                  <select
                    value={trackingMode}
                    onChange={(e: any) => setTrackingMode(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-1.5 py-1 text-xs text-theme-body"
                  >
                    <option value="Standard">Standard (FIFO)</option>
                    <option value="Batch">Batch & Expiry</option>
                    <option value="Serial">Serial No. IMEI</option>
                    <option value="No-stock">No-stock (Service)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-mono text-theme-muted uppercase block mb-1">Attribute Group Link *</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded px-1.5 py-1 text-xs text-theme-body"
                >
                  <option value="">Select Group Link...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                {editingTemplateId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplateId(null);
                      setStyleCode("");
                      setName("");
                      setGroupId("");
                    }}
                    className="px-3 py-1 bg-slate-800 text-xs text-slate-300 rounded"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  {editingTemplateId ? "Update Template" : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column (2/3): Dynamic Size Matrix / Grid Builder */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-theme-divider/50 pb-3">
              <h3 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2">
                <Grid size={16} className="text-emerald-400" />
                <span>Dynamic Matrix Size Grid</span>
              </h3>
              {selectedTemplate && (
                <span className="text-[11px] font-mono text-theme-muted">
                  Active Grid: <span className="text-[#a5b4fc] font-bold">{selectedTemplate.name}</span>
                </span>
              )}
            </div>

            {!selectedTemplate ? (
              <div className="p-24 text-center text-theme-muted text-xs">
                Please select a Variant Template from the sidebar list to render its dynamic row/column matrix grid!
              </div>
            ) : (() => {
              const group = groups.find(g => g.id === selectedTemplate.attributeGroupId);
              if (!group) return <div className="p-10 text-center text-theme-muted">Linked attribute group not found.</div>;

              const colAttr = definitions.find(d => d.id === group.gridColumnAttributeId);
              const rowAttr = definitions.find(d => d.id === group.gridRowAttributeId);

              if (!colAttr || !rowAttr) {
                return (
                  <div className="p-12 text-center text-theme-muted space-y-3">
                    <p className="text-xs">This template's group ("{group.name}") is not configured with matrix Column & Row attributes.</p>
                    <p className="text-[11px] text-[#5b6576]">Go to Attribute Manager, set "Grid Matrix Column" to Size and "Grid Matrix Row" to Color for this group, then return.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-theme-surface-2 p-3 rounded-xl border border-theme-divider/50 text-xs">
                    <div>
                      <span className="text-theme-muted">Matrix columns represent:</span>{" "}
                      <span className="text-sky-400 font-bold font-mono uppercase">{colAttr.label}</span>
                      <span className="mx-3 text-[#2a3a5c]">|</span>
                      <span className="text-theme-muted">Matrix rows represent:</span>{" "}
                      <span className="text-indigo-400 font-bold font-mono uppercase">{rowAttr.label}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 border border-emerald-900 rounded font-bold font-mono">
                      {activeCellsCount} Variants Checked
                    </span>
                  </div>

                  {/* Horizontal Matrix Grid Spreadsheet */}
                  <div className="overflow-x-auto border border-theme-divider/70 rounded-xl">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-slate-400 border-b border-theme-divider">
                          <th className="p-3 font-mono text-[10px] uppercase border-r border-theme-divider/50 text-indigo-300 font-bold">
                            {rowAttr.label} \ {colAttr.label}
                          </th>
                          {colAttr.validValues.map(colVal => (
                            <th key={colVal} className="p-3 font-mono text-[10px] text-center border-r border-theme-divider/40 font-bold text-sky-300">
                              {colVal}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rowAttr.validValues.map(rowVal => (
                          <tr key={rowVal} className="border-b border-theme-divider/40 hover:bg-theme-surface-2/30">
                            <td className="p-3 font-bold text-theme-body bg-theme-surface-2/20 border-r border-theme-divider/50">
                              {rowVal}
                            </td>
                            {colAttr.validValues.map(colVal => {
                              const cellKey = `${rowVal}::${colVal}`;
                              const cell = matrixCells[cellKey] || { active: false, stock: 0, price: selectedTemplate.basePrice, mrp: selectedTemplate.baseMrp, costPrice: Math.round(selectedTemplate.basePrice * 0.6), sku: "", barcode: "" };
                              return (
                                <td key={colVal} className="p-2 border-r border-theme-divider/40 min-w-[170px]">
                                  <div className="space-y-1 bg-theme-surface-2/40 p-2 rounded border border-theme-divider/25">
                                    <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-slate-400 select-none">
                                      <input
                                        type="checkbox"
                                        checked={cell.active}
                                        onChange={(e) => {
                                          setMatrixCells(prev => ({
                                            ...prev,
                                            [cellKey]: { ...cell, active: e.target.checked }
                                          }));
                                        }}
                                        className="rounded bg-theme-surface-2 border-theme-divider"
                                      />
                                      <span className={cell.active ? "text-emerald-400 font-bold" : ""}>Enable Variant</span>
                                    </label>
                                    
                                    {cell.active && (
                                      <div className="space-y-1 pt-1.5 border-t border-theme-divider/35">
                                        <div className="flex items-center space-x-1">
                                          <span className="text-[8px] text-theme-muted font-mono w-10">SKU:</span>
                                          <input
                                            type="text"
                                            value={cell.sku}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setMatrixCells(prev => ({
                                                ...prev,
                                                [cellKey]: { ...cell, sku: val }
                                              }));
                                            }}
                                            className="w-full bg-theme-surface-2 border border-theme-divider rounded text-[9px] text-theme-body px-1 py-0.2 font-mono"
                                          />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                          <span className="text-[8px] text-theme-muted font-mono w-10">Barcode:</span>
                                          <input
                                            type="text"
                                            value={cell.barcode}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setMatrixCells(prev => ({
                                                ...prev,
                                                [cellKey]: { ...cell, barcode: val }
                                              }));
                                            }}
                                            className="w-full bg-theme-surface-2 border border-theme-divider rounded text-[9px] text-theme-body px-1 py-0.2 font-mono"
                                          />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                          <span className="text-[8px] text-theme-muted font-mono w-10">Cost (₹):</span>
                                          <input
                                            type="number"
                                            value={cell.costPrice || 0}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value) || 0;
                                              setMatrixCells(prev => ({
                                                ...prev,
                                                [cellKey]: { ...cell, costPrice: val }
                                              }));
                                            }}
                                            className="w-full bg-theme-surface-2 border border-theme-divider rounded text-[9px] text-theme-body px-1 py-0.2 text-right font-mono"
                                          />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                          <span className="text-[8px] text-theme-muted font-mono w-10">Price (₹):</span>
                                          <input
                                            type="number"
                                            value={cell.price}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value) || 0;
                                              setMatrixCells(prev => ({
                                                ...prev,
                                                [cellKey]: { ...cell, price: val, mrp: Math.max(cell.mrp, val) }
                                              }));
                                            }}
                                            className="w-full bg-theme-surface-2 border border-theme-divider rounded text-[9px] text-theme-body px-1 py-0.2 text-right font-mono"
                                          />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                          <span className="text-[8px] text-theme-muted font-mono w-10">Stock:</span>
                                          <input
                                            type="number"
                                            value={cell.stock}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value) || 0;
                                              setMatrixCells(prev => ({
                                                ...prev,
                                                [cellKey]: { ...cell, stock: val }
                                              }));
                                            }}
                                            className="w-full bg-theme-surface-2 border border-theme-divider rounded text-[9px] text-theme-body px-1 py-0.2 text-right font-mono"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-theme-muted block font-mono">SMRITI AUTOPILOT ITEM CODE</span>
                      <span className="text-xs text-theme-body font-mono font-semibold block mt-0.5">
                        {selectedTemplate.styleCode}-[ROW_VAL]-[COL_VAL]
                      </span>
                    </div>

                    <button
                      onClick={handleCommitMatrix}
                      disabled={loading || activeCellsCount === 0}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-lg flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="animate-spin" size={13} />
                          <span>Generating master indexes...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} />
                          <span>Commit Selected Matrix ({activeCellsCount} items)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

      </div>

    </div>
  );
};
