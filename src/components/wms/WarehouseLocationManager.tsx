/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.72.9
 * Created      : 2026-10-13
 * Modified     : 2026-10-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import {
  MapPin,
  Plus,
  Sparkles,
  Printer,
  Search,
  Filter,
  Layers,
  Box,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  X,
  Boxes,
  Compass
} from "lucide-react";

export interface WarehouseLocationItem {
  id: string;
  warehouse_id: string;
  code: string;
  name: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin_code?: string;
  barcode?: string;
  max_capacity_units?: number;
  is_locked?: boolean;
  is_active?: boolean;
}

export interface GodownSummary {
  id: string;
  code: string;
  name: string;
  is_central_godown?: boolean;
}

interface WarehouseLocationManagerProps {
  warehouses: GodownSummary[];
  activeWarehouseId: string;
  onSelectWarehouse: (id: string) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info") => void;
  onOpenLabelPrinter?: () => void;
}

export const WarehouseLocationManager: React.FC<WarehouseLocationManagerProps> = ({
  warehouses,
  activeWarehouseId,
  onSelectWarehouse,
  onNotification,
  onOpenLabelPrinter,
}) => {
  const [locations, setLocations] = useState<WarehouseLocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modals state
  const [isMatrixWizardOpen, setIsMatrixWizardOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocationItem | null>(null);
  const [stockInspectLocation, setStockInspectLocation] = useState<WarehouseLocationItem | null>(null);
  const [stockInspectItems, setStockInspectItems] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  // Matrix Wizard Form State
  const [matrixZone, setMatrixZone] = useState("STORAGE");
  const [aislePrefix, setAislePrefix] = useState("A");
  const [aisleFrom, setAisleFrom] = useState(1);
  const [aisleTo, setAisleTo] = useState(2);
  const [rackPrefix, setRackPrefix] = useState("R");
  const [rackFrom, setRackFrom] = useState(1);
  const [rackTo, setRackTo] = useState(3);
  const [shelfPrefix, setShelfPrefix] = useState("S");
  const [shelfFrom, setShelfFrom] = useState(1);
  const [shelfTo, setShelfTo] = useState(3);
  const [binPrefix, setBinPrefix] = useState("B");
  const [binFrom, setBinFrom] = useState(1);
  const [binTo, setBinTo] = useState(2);
  const [matrixCapacity, setMatrixCapacity] = useState(100);
  const [matrixGenerating, setMatrixGenerating] = useState(false);

  // Single Add Form State
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newZone, setNewZone] = useState("STORAGE");
  const [newAisle, setNewAisle] = useState("");
  const [newRack, setNewRack] = useState("");
  const [newShelf, setNewShelf] = useState("");
  const [newBin, setNewBin] = useState("");
  const [newCapacity, setNewCapacity] = useState(100);
  const [addSaving, setAddSaving] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState("");
  const [editZone, setEditZone] = useState("STORAGE");
  const [editCapacity, setEditCapacity] = useState(100);
  const [editIsLocked, setEditIsLocked] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const fetchLocations = useCallback(async () => {
    if (!activeWarehouseId) return;
    setLoading(true);
    try {
      const data = await apiFetchV1<WarehouseLocationItem[]>(`/wms/warehouses/${activeWarehouseId}/locations`);
      setLocations(data || []);
    } catch (err: any) {
      onNotification?.("Error", err.message || "Failed to load locations", "error");
    } finally {
      setLoading(false);
    }
  }, [activeWarehouseId, onNotification]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Zone statistics
  const zoneStats = useMemo(() => {
    const stats: Record<string, number> = {
      TOTAL: locations.length,
      STORAGE: 0,
      PICKING: 0,
      BULK: 0,
      RECEIVING: 0,
      QUARANTINE: 0,
    };
    locations.forEach((loc) => {
      const z = (loc.zone || "STORAGE").toUpperCase();
      stats[z] = (stats[z] || 0) + 1;
    });
    return stats;
  }, [locations]);

  // Filtered locations
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchZone = selectedZone === "ALL" || (loc.zone || "STORAGE").toUpperCase() === selectedZone;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        loc.code.toLowerCase().includes(q) ||
        loc.name.toLowerCase().includes(q) ||
        (loc.aisle || "").toLowerCase().includes(q) ||
        (loc.rack || "").toLowerCase().includes(q) ||
        (loc.shelf || "").toLowerCase().includes(q) ||
        (loc.bin_code || "").toLowerCase().includes(q) ||
        (loc.barcode || "").toLowerCase().includes(q);
      return matchZone && matchQuery;
    });
  }, [locations, selectedZone, searchQuery]);

  // Calculated matrix preview count
  const calculatedMatrixCount = useMemo(() => {
    const aisles = Math.max(0, aisleTo - aisleFrom + 1);
    const racks = Math.max(0, rackTo - rackFrom + 1);
    const shelves = Math.max(0, shelfTo - shelfFrom + 1);
    const bins = Math.max(0, binTo - binFrom + 1);
    return aisles * racks * shelves * bins;
  }, [aisleFrom, aisleTo, rackFrom, rackTo, shelfFrom, shelfTo, binFrom, binTo]);

  // Execute Matrix Generation
  const handleGenerateMatrix = async () => {
    if (!activeWarehouseId) {
      onNotification?.("Warning", "Please select a warehouse first.", "error");
      return;
    }
    if (calculatedMatrixCount <= 0 || calculatedMatrixCount > 1000) {
      onNotification?.("Warning", "Matrix count must be between 1 and 1,000 bins.", "error");
      return;
    }

    setMatrixGenerating(true);
    try {
      const payload = {
        zone: matrixZone,
        aisle_prefix: aislePrefix,
        aisle_from: aisleFrom,
        aisle_to: aisleTo,
        rack_prefix: rackPrefix,
        rack_from: rackFrom,
        rack_to: rackTo,
        shelf_prefix: shelfPrefix,
        shelf_from: shelfFrom,
        shelf_to: shelfTo,
        bin_prefix: binPrefix,
        bin_from: binFrom,
        bin_to: binTo,
        max_capacity_units: matrixCapacity,
      };

      const res = await apiFetchV1<any>(`/wms/warehouses/${activeWarehouseId}/locations/generate`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotification?.(
        "Matrix Generated",
        `Successfully created ${res.created_count} location bins (${res.skipped_count} skipped as duplicates).`,
        "success"
      );
      setIsMatrixWizardOpen(false);
      await fetchLocations();
    } catch (err: any) {
      onNotification?.("Generation Failed", err.message || "Failed to generate matrix locations.", "error");
    } finally {
      setMatrixGenerating(false);
    }
  };

  // Add Single Location
  const handleAddSingleLocation = async () => {
    if (!activeWarehouseId) return;
    if (!newCode.trim() || !newName.trim()) {
      onNotification?.("Validation Error", "Bin code and friendly name are required.", "error");
      return;
    }

    setAddSaving(true);
    try {
      await apiFetchV1(`/wms/warehouses/${activeWarehouseId}/locations`, {
        method: "POST",
        body: JSON.stringify({
          warehouse_id: activeWarehouseId,
          code: newCode.trim().toUpperCase(),
          name: newName.trim(),
          zone: newZone,
          aisle: newAisle.trim() || undefined,
          rack: newRack.trim() || undefined,
          shelf: newShelf.trim() || undefined,
          bin_code: newBin.trim() || undefined,
          max_capacity_units: newCapacity,
        }),
      });

      onNotification?.("Location Added", `Location '${newCode.trim().toUpperCase()}' created successfully.`, "success");
      setIsAddModalOpen(false);
      setNewCode("");
      setNewName("");
      setNewAisle("");
      setNewRack("");
      setNewShelf("");
      setNewBin("");
      await fetchLocations();
    } catch (err: any) {
      onNotification?.("Error", err.message || "Failed to add location.", "error");
    } finally {
      setAddSaving(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (loc: WarehouseLocationItem) => {
    setEditingLocation(loc);
    setEditName(loc.name);
    setEditZone(loc.zone || "STORAGE");
    setEditCapacity(loc.max_capacity_units || 100);
    setEditIsLocked(loc.is_locked || false);
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingLocation) return;
    setEditSaving(true);
    try {
      await apiFetchV1(`/wms/locations/${editingLocation.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          zone: editZone,
          max_capacity_units: editCapacity,
          is_locked: editIsLocked,
        }),
      });

      onNotification?.("Location Updated", `Location '${editingLocation.code}' updated successfully.`, "success");
      setEditingLocation(null);
      await fetchLocations();
    } catch (err: any) {
      onNotification?.("Error", err.message || "Failed to update location.", "error");
    } finally {
      setEditSaving(false);
    }
  };

  // Delete Location
  const handleDeleteLocation = async (loc: WarehouseLocationItem) => {
    if (!window.confirm(`Are you sure you want to remove storage location '${loc.code}' (${loc.name})?`)) {
      return;
    }
    try {
      await apiFetchV1(`/wms/locations/${loc.id}`, { method: "DELETE" });
      onNotification?.("Location Removed", `Location '${loc.code}' deleted.`, "info");
      await fetchLocations();
    } catch (err: any) {
      onNotification?.("Error", err.message || "Failed to delete location.", "error");
    }
  };

  // Inspect Live Stock in Bin
  const inspectStock = async (loc: WarehouseLocationItem) => {
    setStockInspectLocation(loc);
    setStockInspectItems([]);
    setStockLoading(true);
    try {
      const res = await apiFetchV1<any>(`/wms/locations/${loc.id}/stock`);
      setStockInspectItems(res.items || []);
    } catch (err: any) {
      onNotification?.("Stock Lookup", err.message || "Failed to fetch stock items.", "error");
    } finally {
      setStockLoading(false);
    }
  };

  // Zone styling helper
  const getZoneBadge = (zone?: string) => {
    const z = (zone || "STORAGE").toUpperCase();
    switch (z) {
      case "PICKING":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🟢 FAST PICKING</span>;
      case "BULK":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">🟡 BULK OVERSTOCK</span>;
      case "RECEIVING":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">🟣 RECEIVING DOCK</span>;
      case "QUARANTINE":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">🔴 QUARANTINE / DEFECT</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">🔵 STANDARD STORAGE</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Controls Header */}
      <div className="bg-theme-card border border-theme-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-theme-primary">
              <Compass className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold">Physical Location & Bin Management</h2>
            </div>
            <p className="text-xs text-theme-muted mt-0.5">
              Organize godowns into Aisles, Racks, Shelves, and Bins so any store assistant can easily find stock.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsMatrixWizardOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              1-Click Matrix Wizard
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-theme-bg border border-theme-border text-theme-text-primary hover:bg-theme-hover transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Add Single Bin
            </button>
            {onOpenLabelPrinter && (
              <button
                onClick={onOpenLabelPrinter}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-theme-bg border border-theme-border text-theme-text-primary hover:bg-theme-hover transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                Print Rack Labels
              </button>
            )}
            <button
              onClick={fetchLocations}
              disabled={loading}
              className="p-2 rounded-xl border border-theme-border text-theme-muted hover:text-theme-text-primary hover:bg-theme-hover transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Warehouse Selector & Zone Pill Filters */}
        <div className="pt-3 border-t border-theme-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-theme-muted">Godown:</span>
              <select
                value={activeWarehouseId}
                onChange={(e) => onSelectWarehouse(e.target.value)}
                className="bg-theme-bg border border-theme-border rounded-xl px-3 py-1.5 text-xs text-theme-text-primary font-medium focus:outline-none focus:border-indigo-500/80"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    [{wh.code}] {wh.name} {wh.is_central_godown ? "⭐ (Central)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Zone Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "ALL", label: `All (${zoneStats.TOTAL})` },
                { id: "STORAGE", label: `Standard Storage (${zoneStats.STORAGE})` },
                { id: "PICKING", label: `Fast Picking (${zoneStats.PICKING})` },
                { id: "BULK", label: `Bulk Overstock (${zoneStats.BULK})` },
                { id: "RECEIVING", label: `Receiving (${zoneStats.RECEIVING})` },
                { id: "QUARANTINE", label: `Quarantine (${zoneStats.QUARANTINE})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setSelectedZone(pill.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    selectedZone === pill.id
                      ? "bg-indigo-600 text-white font-semibold shadow-sm"
                      : "bg-theme-bg border border-theme-border text-theme-muted hover:text-theme-text-primary hover:bg-theme-hover"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar & View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-theme-muted" />
              <input
                type="text"
                placeholder="Search aisle, rack, bin, barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 bg-theme-bg border border-theme-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-theme-text-primary focus:outline-none focus:border-indigo-500/80"
              />
            </div>
            <div className="flex items-center border border-theme-border rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 text-xs ${viewMode === "grid" ? "bg-indigo-600 text-white" : "bg-theme-bg text-theme-muted hover:text-theme-text-primary"}`}
                title="Grid Cards"
              >
                <Boxes className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 text-xs ${viewMode === "table" ? "bg-indigo-600 text-white" : "bg-theme-bg text-theme-muted hover:text-theme-text-primary"}`}
                title="Table View"
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-theme-muted gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-xs font-semibold">Loading physical location layout...</p>
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="bg-theme-card border border-dashed border-theme-border rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <MapPin className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-theme-text-primary">No Locations Configured</h3>
          <p className="text-xs text-theme-muted max-w-md mx-auto">
            This godown doesn't have any physical storage bins defined yet. Use the 1-Click Matrix Wizard to generate standard aisles, racks, and shelves instantly.
          </p>
          <button
            onClick={() => setIsMatrixWizardOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Launch 1-Click Matrix Wizard
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* Visual Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredLocations.map((loc) => (
            <div
              key={loc.id}
              className={`bg-theme-card border rounded-2xl p-4 shadow-sm hover:border-indigo-500/50 transition-all flex flex-col justify-between ${
                loc.is_locked ? "border-rose-500/40 bg-rose-950/10" : "border-theme-border"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono font-bold text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                    {loc.code}
                  </span>
                  {getZoneBadge(loc.zone)}
                </div>

                <h4 className="text-sm font-bold text-theme-text-primary leading-tight mt-1">
                  {loc.name}
                </h4>

                {/* Spatial Human Breadcrumb */}
                <div className="text-[11px] text-theme-muted mt-2 space-y-1 bg-theme-bg/60 p-2 rounded-xl border border-theme-border/50 font-medium">
                  <div className="flex items-center justify-between">
                    <span>Aisle: <strong className="text-theme-text-primary">{loc.aisle || "—"}</strong></span>
                    <span>Rack: <strong className="text-theme-text-primary">{loc.rack || "—"}</strong></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Shelf: <strong className="text-theme-text-primary">{loc.shelf || "—"}</strong></span>
                    <span>Bin: <strong className="text-theme-text-primary">{loc.bin_code || "—"}</strong></span>
                  </div>
                </div>

                {loc.barcode && (
                  <div className="text-[10px] text-theme-muted font-mono mt-2 truncate" title={loc.barcode}>
                    Barcode: {loc.barcode}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 mt-3 border-t border-theme-border/60 flex items-center justify-between">
                <button
                  onClick={() => inspectStock(loc)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Stock
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(loc)}
                    className="p-1 rounded text-theme-muted hover:text-theme-text-primary transition-colors"
                    title="Edit Bin"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteLocation(loc)}
                    className="p-1 rounded text-theme-muted hover:text-rose-400 transition-colors"
                    title="Delete Bin"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-theme-card border border-theme-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-theme-bg/80 text-theme-muted border-b border-theme-border uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Bin Code</th>
                  <th className="py-3 px-4">Friendly Name</th>
                  <th className="py-3 px-4">Zone</th>
                  <th className="py-3 px-4">Aisle</th>
                  <th className="py-3 px-4">Rack</th>
                  <th className="py-3 px-4">Shelf</th>
                  <th className="py-3 px-4">Bin</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/50 text-theme-text-primary">
                {filteredLocations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-theme-hover/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">{loc.code}</td>
                    <td className="py-3 px-4 font-medium">{loc.name}</td>
                    <td className="py-3 px-4">{getZoneBadge(loc.zone)}</td>
                    <td className="py-3 px-4 text-theme-muted">{loc.aisle || "—"}</td>
                    <td className="py-3 px-4 text-theme-muted">{loc.rack || "—"}</td>
                    <td className="py-3 px-4 text-theme-muted">{loc.shelf || "—"}</td>
                    <td className="py-3 px-4 text-theme-muted">{loc.bin_code || "—"}</td>
                    <td className="py-3 px-4 text-theme-muted">{loc.max_capacity_units || 100} units</td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => inspectStock(loc)}
                        className="p-1 rounded text-theme-muted hover:text-indigo-400"
                        title="View Assigned Stock"
                      >
                        <Eye className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => openEditModal(loc)}
                        className="p-1 rounded text-theme-muted hover:text-theme-text-primary"
                        title="Edit Location"
                      >
                        <Edit2 className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc)}
                        className="p-1 rounded text-theme-muted hover:text-rose-400"
                        title="Delete Location"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────── MODALS ─────────────────────────── */}

      {/* 1-Click Matrix Generator Wizard Modal */}
      {isMatrixWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">1-Click Bin Matrix Generator</h3>
                  <p className="text-[11px] text-slate-400">Generate multiple shelves and bins automatically</p>
                </div>
              </div>
              <button
                onClick={() => setIsMatrixWizardOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Target Functional Zone</label>
                <select
                  value={matrixZone}
                  onChange={(e) => setMatrixZone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="STORAGE">🔵 Standard Storage (Main Racks)</option>
                  <option value="PICKING">🟢 Fast Picking (Front / Counter)</option>
                  <option value="BULK">🟡 Bulk Overstock (Upper Tiers)</option>
                  <option value="RECEIVING">🟣 Receiving Dock (Inward Staging)</option>
                  <option value="QUARANTINE">🔴 Quarantine / Defective (Returns)</option>
                </select>
              </div>

              {/* Grid Ranges */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Aisles (Walking corridors)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">From:</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={aisleFrom}
                      onChange={(e) => setAisleFrom(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                    />
                    <span className="text-slate-500">To:</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={aisleTo}
                      onChange={(e) => setAisleTo(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Racks per Aisle</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">From:</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={rackFrom}
                      onChange={(e) => setRackFrom(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                    />
                    <span className="text-slate-500">To:</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={rackTo}
                      onChange={(e) => setRackTo(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Shelves / Tiers per Rack</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">From:</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={shelfFrom}
                      onChange={(e) => setShelfFrom(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                    />
                    <span className="text-slate-500">To:</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={shelfTo}
                      onChange={(e) => setShelfTo(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Bins per Shelf</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">From:</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={binFrom}
                      onChange={(e) => setBinFrom(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                    />
                    <span className="text-slate-500">To:</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={binTo}
                      onChange={(e) => setBinTo(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-indigo-200">
                    Preview: {calculatedMatrixCount} Total Locations Will Be Created
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sample Code: <span className="font-mono text-indigo-300">ST-A01-R01-S01-B01</span> (Aisle 1, Rack 1, Shelf 1, Bin 1)
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsMatrixWizardOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateMatrix}
                disabled={matrixGenerating || calculatedMatrixCount <= 0}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {matrixGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating Bins...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate {calculatedMatrixCount} Bins
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Bin Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <h3 className="text-sm font-bold text-slate-100">Add Physical Storage Location</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Unique Bin Code *</label>
                <input
                  type="text"
                  placeholder="e.g. ST-A01-R02-S01"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Friendly Name / Label *</label>
                <input
                  type="text"
                  placeholder="e.g. Aisle 1, Rack 2, Eye-Level"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Functional Zone</label>
                <select
                  value={newZone}
                  onChange={(e) => setNewZone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="STORAGE">Standard Storage</option>
                  <option value="PICKING">Fast Picking</option>
                  <option value="BULK">Bulk Overstock</option>
                  <option value="RECEIVING">Receiving Dock</option>
                  <option value="QUARANTINE">Quarantine</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Aisle</label>
                  <input
                    type="text"
                    placeholder="e.g. A01"
                    value={newAisle}
                    onChange={(e) => setNewAisle(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Rack</label>
                  <input
                    type="text"
                    placeholder="e.g. R02"
                    value={newRack}
                    onChange={(e) => setNewRack(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Shelf</label>
                  <input
                    type="text"
                    placeholder="e.g. S03"
                    value={newShelf}
                    onChange={(e) => setNewShelf(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Bin</label>
                  <input
                    type="text"
                    placeholder="e.g. B01"
                    value={newBin}
                    onChange={(e) => setNewBin(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">
                Cancel
              </button>
              <button
                onClick={handleAddSingleLocation}
                disabled={addSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50"
              >
                {addSaving ? "Saving..." : "Save Location"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <h3 className="text-sm font-bold text-slate-100">Edit Location: {editingLocation.code}</h3>
              <button onClick={() => setEditingLocation(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Friendly Name / Label</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Functional Zone</label>
                <select
                  value={editZone}
                  onChange={(e) => setEditZone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="STORAGE">Standard Storage</option>
                  <option value="PICKING">Fast Picking</option>
                  <option value="BULK">Bulk Overstock</option>
                  <option value="RECEIVING">Receiving Dock</option>
                  <option value="QUARANTINE">Quarantine</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Max Units Capacity</label>
                <input
                  type="number"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(parseInt(e.target.value) || 100)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="lockBin"
                  checked={editIsLocked}
                  onChange={(e) => setEditIsLocked(e.target.checked)}
                  className="accent-indigo-500 w-4 h-4"
                />
                <label htmlFor="lockBin" className="text-slate-300 font-medium">
                  Lock this bin (prevent further stock putaway / inwarding)
                </label>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
              <button onClick={() => setEditingLocation(null)} className="px-4 py-2 text-xs font-semibold text-slate-400">
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Stock Inspector Modal */}
      {stockInspectLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Box className="w-4 h-4 text-indigo-400" />
                  Bin Contents: {stockInspectLocation.code}
                </h3>
                <p className="text-[11px] text-slate-400">{stockInspectLocation.name}</p>
              </div>
              <button onClick={() => setStockInspectLocation(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 text-xs max-h-[60vh] overflow-y-auto">
              {stockLoading ? (
                <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Checking bin inventory...</span>
                </div>
              ) : stockInspectItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">Bin is Currently Empty</p>
                  <p className="text-[11px]">No catalog items have this bin assigned as their primary location.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stockInspectItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-200">{item.item_name || "Catalog Product"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Code: {item.item_code}</div>
                      </div>
                      <div className="text-right text-[11px]">
                        <span className="text-emerald-400 font-bold">Min: {item.min_reorder_level}</span>
                        <div className="text-slate-500">Cap: {item.max_capacity}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
              <button
                onClick={() => setStockInspectLocation(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
