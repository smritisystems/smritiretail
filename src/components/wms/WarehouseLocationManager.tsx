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
  Compass,
  Zap,
  Check,
  ShieldAlert,
  ArrowRight,
  Activity,
  ArrowRightLeft,
  Sliders,
  CheckSquare,
  Square,
  TrendingDown
} from "lucide-react";

export interface ReplenishmentTaskItem {
  task_id: string;
  item_id: string;
  product_id?: string;
  item_code: string;
  product_name: string;
  sku?: string;
  picking_location_id?: string;
  picking_bin: string;
  current_picking_stock: number;
  min_reorder_level: number;
  max_capacity: number;
  reorder_quantity: number;
  source_location_id?: string;
  source_bin?: string | null;
  available_bulk_stock: number;
  suggested_quantity: number;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "BULK_STOCKOUT";
  status: "READY" | "BLOCKED" | "EXECUTED";
  message?: string;
}

export interface ReplenishmentTasksResponse {
  warehouse_id: string;
  warehouse_code: string;
  total_tasks: number;
  critical_count: number;
  high_count: number;
  normal_count: number;
  bulk_stockout_count: number;
  tasks: ReplenishmentTaskItem[];
}

export interface ItemSlottingConfigItem {
  id?: string;
  item_id: string;
  item_code: string;
  item_name: string;
  warehouse_id: string;
  location_bin: string;
  zone?: string;
  current_stock: number;
  min_reorder_level: number;
  max_capacity: number;
  reorder_quantity: number;
}

export interface PutawayCandidateLocation {
  location_id: string;
  code: string;
  name: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin_code?: string;
  barcode?: string;
  max_capacity_units?: number;
  current_occupancy?: number;
  available_capacity?: number;
  current_occupancy_units?: number;
  available_headroom_units?: number;
  score?: number;
  rule_applied?: string;
  matched_rule?: string;
  notes?: string;
}

export interface PutawayRecommendationResponse {
  warehouse_id: string;
  warehouse_code?: string;
  status?: string;
  product_id?: string;
  requested_quantity?: number;
  recommended_location?: PutawayCandidateLocation | null;
  rule_applied?: string;
  reason?: string;
  message?: string;
  alternatives?: PutawayCandidateLocation[];
  candidate_locations?: PutawayCandidateLocation[];
  is_over_capacity_fallback?: boolean;
}

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
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
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

  // Putaway Advisor Simulator State
  const [isPutawayAdvisorOpen, setIsPutawayAdvisorOpen] = useState(false);
  const [simProductId, setSimProductId] = useState("");
  const [simBatchNo, setSimBatchNo] = useState("");
  const [simQty, setSimQty] = useState(10);
  const [simIsDamaged, setSimIsDamaged] = useState(false);
  const [simZone, setSimZone] = useState("");
  const [simEvaluating, setSimEvaluating] = useState(false);
  const [simResult, setSimResult] = useState<PutawayRecommendationResponse | null>(null);
  const [highlightedLocationId, setHighlightedLocationId] = useState<string | null>(null);

  // Replenishment Engine State
  const [isReplenishmentModalOpen, setIsReplenishmentModalOpen] = useState(false);
  const [replenishmentTasks, setReplenishmentTasks] = useState<ReplenishmentTaskItem[]>([]);
  const [replenishmentResponse, setReplenishmentResponse] = useState<ReplenishmentTasksResponse | null>(null);
  const [replenishmentLoading, setReplenishmentLoading] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [taskQtyOverrides, setTaskQtyOverrides] = useState<Record<string, number>>({});
  const [replenishmentExecuting, setReplenishmentExecuting] = useState(false);
  const [replenishmentFilter, setReplenishmentFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "NORMAL" | "BULK_STOCKOUT">("ALL");
  const [replenishmentSearch, setReplenishmentSearch] = useState("");

  // Slotting State
  const [activeReplenishTab, setActiveReplenishTab] = useState<"TASKS" | "SLOTTING">("TASKS");
  const [slottingList, setSlottingList] = useState<ItemSlottingConfigItem[]>([]);
  const [slottingLoading, setSlottingLoading] = useState(false);
  const [isSlottingFormOpen, setIsSlottingFormOpen] = useState(false);
  const [slotItemId, setSlotItemId] = useState("");
  const [slotLocationBin, setSlotLocationBin] = useState("");
  const [slotMinLevel, setSlotMinLevel] = useState(10);
  const [slotMaxCapacity, setSlotMaxCapacity] = useState(100);
  const [slotReorderQty, setSlotReorderQty] = useState(40);
  const [slotSaving, setSlotSaving] = useState(false);

  // Fetch Replenishment Tasks
  const fetchReplenishmentTasks = useCallback(async () => {
    if (!activeWarehouseId) return;
    setReplenishmentLoading(true);
    try {
      const data = await apiFetchV1<ReplenishmentTasksResponse>(`/wms/warehouses/${activeWarehouseId}/replenishment-tasks`);
      setReplenishmentResponse(data);
      const tasks = data?.tasks || [];
      setReplenishmentTasks(tasks);
      const readyIds = new Set(tasks.filter((t) => t.status === "READY").map((t) => t.task_id));
      setSelectedTaskIds(readyIds);
      const initialQtys: Record<string, number> = {};
      tasks.forEach((t) => {
        initialQtys[t.task_id] = t.suggested_quantity;
      });
      setTaskQtyOverrides(initialQtys);
    } catch (err: any) {
      onNotification?.("Replenishment Error", err.message || "Failed to load replenishment tasks.", "error");
    } finally {
      setReplenishmentLoading(false);
    }
  }, [activeWarehouseId, onNotification]);

  // Execute Replenishments
  const handleExecuteReplenishment = async (tasksToRun?: ReplenishmentTaskItem[]) => {
    if (!activeWarehouseId) return;
    const targetTasks = tasksToRun || replenishmentTasks.filter((t) => selectedTaskIds.has(t.task_id) && t.status === "READY");
    if (!targetTasks.length) {
      onNotification?.("Validation Error", "No eligible replenishment tasks selected for execution.", "warning");
      return;
    }

    setReplenishmentExecuting(true);
    try {
      const payload = {
        tasks: targetTasks.map((t) => ({
          task_id: t.task_id,
          item_id: t.item_id,
          sku: t.sku || t.item_code,
          product_name: t.product_name,
          source_bin: t.source_bin,
          destination_bin: t.picking_bin,
          quantity: taskQtyOverrides[t.task_id] ?? t.suggested_quantity,
        })),
        notes: "Automated Picking Bin Replenishment Run",
      };

      const res = await apiFetchV1<any>(`/wms/warehouses/${activeWarehouseId}/replenishment/execute`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotification?.("Replenishment Executed", res.message || "Transfers executed successfully.", "success");
      fetchReplenishmentTasks();
      fetchLocations();
    } catch (err: any) {
      onNotification?.("Execution Failed", err.message || "Failed to execute replenishment transfers.", "error");
    } finally {
      setReplenishmentExecuting(false);
    }
  };

  // Fetch Slotting Configurations
  const fetchSlotting = useCallback(async () => {
    if (!activeWarehouseId) return;
    setSlottingLoading(true);
    try {
      const data = await apiFetchV1<ItemSlottingConfigItem[]>(`/wms/warehouses/${activeWarehouseId}/slotting`);
      setSlottingList(data || []);
    } catch (err: any) {
      onNotification?.("Slotting Error", err.message || "Failed to load slotting configurations.", "error");
    } finally {
      setSlottingLoading(false);
    }
  }, [activeWarehouseId, onNotification]);

  // Save Item Slotting
  const handleSaveSlotting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWarehouseId) return;
    if (!slotItemId.trim() || !slotLocationBin.trim()) {
      onNotification?.("Validation Error", "Item ID and Location Bin are required.", "error");
      return;
    }

    setSlotSaving(true);
    try {
      await apiFetchV1(`/wms/warehouses/${activeWarehouseId}/slotting`, {
        method: "POST",
        body: JSON.stringify({
          item_id: slotItemId.trim(),
          location_bin: slotLocationBin.trim(),
          min_reorder_level: slotMinLevel,
          max_capacity: slotMaxCapacity,
          reorder_quantity: slotReorderQty,
        }),
      });
      onNotification?.("Slotting Saved", `Dedicated bin ${slotLocationBin} assigned.`, "success");
      setIsSlottingFormOpen(false);
      fetchSlotting();
      fetchReplenishmentTasks();
    } catch (err: any) {
      onNotification?.("Save Failed", err.message || "Failed to save slotting rule.", "error");
    } finally {
      setSlotSaving(false);
    }
  };


  // Evaluate Putaway Recommendation
  const handleEvaluatePutaway = async () => {
    if (!activeWarehouseId) {
      onNotification?.("Error", "Please select a warehouse first.", "error");
      return;
    }
    if (!simProductId.trim()) {
      onNotification?.("Validation Error", "Please provide a Product ID or SKU.", "error");
      return;
    }
    if (simQty <= 0) {
      onNotification?.("Validation Error", "Requested quantity must be greater than zero.", "error");
      return;
    }

    setSimEvaluating(true);
    try {
      const payload: any = {
        product_id: simProductId.trim(),
        quantity: simQty,
        is_damaged: simIsDamaged,
      };
      if (simBatchNo.trim()) payload.batch_no = simBatchNo.trim();
      if (simZone.trim()) payload.preferred_zone = simZone.trim();

      const res = await apiFetchV1<PutawayRecommendationResponse>(
        `/wms/warehouses/${activeWarehouseId}/putaway-recommendation`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
      setSimResult(res);
      if (res.recommended_location) {
        const ruleName = res.recommended_location.rule_applied || res.rule_applied || "RECOMMENDED";
        onNotification?.(
          "Putaway Advice",
          `Recommended: ${res.recommended_location.code} (${ruleName})`,
          "success"
        );
      } else {
        onNotification?.("Putaway Advice", res.message || res.reason || "No suitable storage location found.", "info");
      }
    } catch (err: any) {
      onNotification?.("Advisor Error", err.message || "Failed to evaluate putaway rules.", "error");
    } finally {
      setSimEvaluating(false);
    }
  };

  const handleHighlightLocation = (locationId: string, locationCode: string) => {
    setHighlightedLocationId(locationId);
    setIsPutawayAdvisorOpen(false);
    onNotification?.("Location Highlighted", `Highlighted bin ${locationCode} in grid.`, "info");
  };

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

  // Active warehouse reference
  const activeWarehouse = useMemo(
    () => warehouses.find((w) => w.id === activeWarehouseId),
    [warehouses, activeWarehouseId]
  );

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
              onClick={() => {
                setIsPutawayAdvisorOpen(true);
                if (!simProductId && locations.length > 0) {
                  setSimProductId("PROD-001");
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
              title="Automated Putaway Rule Advisor Simulator"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              Putaway Advisor
            </button>
            <button
              onClick={() => {
                if (!activeWarehouseId) {
                  onNotification?.("Warning", "Please select a warehouse first.", "warning");
                  return;
                }
                setIsReplenishmentModalOpen(true);
                fetchReplenishmentTasks();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
              title="Dynamic Picking Bin Replenishment & Slotting Engine"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-300" />
              Replenishment Engine
              {replenishmentResponse && replenishmentResponse.critical_count > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                  {replenishmentResponse.critical_count}
                </span>
              )}
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
          <h3 className="text-sm font-bold text-theme-text-primary">No Physical Storage Bins Configured</h3>
          <p className="text-xs text-theme-muted max-w-lg mx-auto leading-relaxed">
            Godown {activeWarehouse ? <span className="font-semibold text-theme-text-primary">[{activeWarehouse.code}] {activeWarehouse.name}</span> : "selected"} is an active stock-holding warehouse, but has no physical sub-locations (aisles, racks, shelves, bins) configured yet. Storage bins are physical subdivisions within a godown for precise bin-level tracking.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-2">
            <button
              onClick={() => setIsMatrixWizardOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Launch 1-Click Matrix Wizard
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-theme-bg border border-theme-border text-theme-text-primary hover:bg-theme-hover transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Add Single Bin
            </button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* Visual Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredLocations.map((loc) => (
            <div
              key={loc.id}
              className={`bg-theme-card border rounded-2xl p-4 shadow-sm hover:border-indigo-500/50 transition-all flex flex-col justify-between ${
                loc.is_locked
                  ? "border-rose-500/40 bg-rose-950/10"
                  : loc.id === highlightedLocationId
                  ? "border-emerald-500 ring-2 ring-emerald-500/70 bg-emerald-950/20 shadow-lg shadow-emerald-500/20"
                  : "border-theme-border"
              }`}
            >
              <div>
                {loc.id === highlightedLocationId && (
                  <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center justify-between animate-pulse">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-300" />
                      Recommended Putaway Bin
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHighlightedLocationId(null);
                      }}
                      className="text-emerald-400 hover:text-white"
                      title="Clear highlight"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
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
                {filteredLocations.map((loc) => {
                  const isHighlighted = loc.id === highlightedLocationId;
                  return (
                    <tr
                      key={loc.id}
                      className={`transition-colors ${
                        isHighlighted
                          ? "bg-emerald-500/15 border-l-4 border-emerald-500 font-semibold"
                          : "hover:bg-theme-hover/50"
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400 flex items-center gap-1.5">
                        {isHighlighted && <Zap className="w-3.5 h-3.5 text-amber-300 animate-bounce" />}
                        {loc.code}
                      </td>
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
                );
              })}
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

      {/* Putaway Advisor Simulator Modal */}
      {isPutawayAdvisorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Zap className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    Automated Putaway Rule Advisor
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    4-Tier Decision Cascade: Quarantine → Dedicated Bin → Co-located Stock → Nearest Empty Bin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPutawayAdvisorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto text-xs">
              {/* Simulation Input Parameters */}
              <div className="bg-slate-850/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  Inwarding Simulation Parameters
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Product ID / SKU Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. PROD-001 or SHIRT-BLK-L"
                      value={simProductId}
                      onChange={(e) => setSimProductId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Batch Number (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. BATCH-2026-OCT-01"
                      value={simBatchNo}
                      onChange={(e) => setSimBatchNo(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Quantity Units *</label>
                    <input
                      type="number"
                      min="1"
                      value={simQty}
                      onChange={(e) => setSimQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Preferred Zone Override</label>
                    <select
                      value={simZone}
                      onChange={(e) => setSimZone(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Auto (Any Zone based on rules)</option>
                      <option value="STORAGE">STORAGE (Standard Storage)</option>
                      <option value="PICKING">PICKING (Fast Picking)</option>
                      <option value="BULK">BULK (Bulk Overstock)</option>
                      <option value="RECEIVING">RECEIVING (Receiving Staging)</option>
                      <option value="QUARANTINE">QUARANTINE (Quarantine / Defect)</option>
                    </select>
                  </div>
                </div>

                {/* Damaged / Quarantine Flag */}
                <div className="pt-1 flex items-center justify-between p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/30">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="simDamaged"
                      checked={simIsDamaged}
                      onChange={(e) => setSimIsDamaged(e.target.checked)}
                      className="accent-rose-500 w-4 h-4 rounded cursor-pointer"
                    />
                    <label htmlFor="simDamaged" className="text-rose-300 font-medium cursor-pointer">
                      Damaged / Defective Stock
                    </label>
                  </div>
                  <span className="text-[10px] text-rose-400 font-mono bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                    Priority 1: Quarantine Isolation
                  </span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleEvaluatePutaway}
                    disabled={simEvaluating}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 shadow-md transition-all cursor-pointer"
                  >
                    <Zap className={`w-4 h-4 text-amber-300 ${simEvaluating ? "animate-spin" : ""}`} />
                    <span>{simEvaluating ? "Evaluating Engine Rules..." : "Run Putaway Engine"}</span>
                  </button>
                </div>
              </div>

              {/* Engine Recommendation Result */}
              {simResult ? (
                <div className="space-y-4">
                  {simResult.recommended_location ? (
                    <div className="bg-gradient-to-br from-slate-850 to-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-lg space-y-3">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ★ RECOMMENDED LOCATION
                          </span>
                          {(() => {
                            const r = simResult.recommended_location?.rule_applied || simResult.rule_applied || "RECOMMENDED";
                            return (
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                  r === "QUARANTINE_ISOLATION"
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                    : r === "DEDICATED_ITEM_BIN"
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                    : r === "CO_LOCATED_STOCK"
                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                }`}
                              >
                                Rule: {r}
                              </span>
                            );
                          })()}
                        </div>
                        {getZoneBadge(simResult.recommended_location.zone)}
                      </div>

                      {/* Fallback alert if over capacity */}
                      {(simResult.status === "OVER_CAPACITY" || simResult.is_over_capacity_fallback) && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                          <span>Warehouse is near capacity. Falling back to least-occupied active bin.</span>
                        </div>
                      )}

                      {/* Location Details */}
                      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                        <div>
                          <div className="font-mono text-xl font-extrabold text-emerald-400">
                            {simResult.recommended_location.code}
                          </div>
                          <div className="text-slate-200 font-medium text-xs">
                            {simResult.recommended_location.name}
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            handleHighlightLocation(
                              simResult.recommended_location!.location_id,
                              simResult.recommended_location!.code
                            )
                          }
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Highlight in Grid</span>
                        </button>
                      </div>

                      {/* Breadcrumbs */}
                      <div className="grid grid-cols-4 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                        <div>
                          <span className="text-slate-400">Aisle:</span>{" "}
                          <strong className="text-slate-200">{simResult.recommended_location.aisle || "—"}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Rack:</span>{" "}
                          <strong className="text-slate-200">{simResult.recommended_location.rack || "—"}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Shelf:</span>{" "}
                          <strong className="text-slate-200">{simResult.recommended_location.shelf || "—"}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Bin:</span>{" "}
                          <strong className="text-slate-200">{simResult.recommended_location.bin_code || "—"}</strong>
                        </div>
                      </div>

                      {/* Headroom / Capacity Progress Bar */}
                      {(() => {
                        const max = simResult.recommended_location.max_capacity_units || 100;
                        const occ = Number(
                          simResult.recommended_location.current_occupancy_units ??
                          simResult.recommended_location.current_occupancy ??
                          0
                        );
                        const avail = Number(
                          simResult.recommended_location.available_headroom_units ??
                          simResult.recommended_location.available_capacity ??
                          (max - occ)
                        );
                        const pct = Math.min(100, Math.round((occ / max) * 100));

                        return (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-[11px] text-slate-300">
                              <span>
                                Current Occupancy:{" "}
                                <strong className="text-white font-mono">
                                  {occ.toFixed(1)}
                                </strong>{" "}
                                / {max} units
                              </span>
                              <span>
                                Available Headroom:{" "}
                                <strong className="text-emerald-400 font-mono">
                                  {avail.toFixed(1)} units
                                </strong>
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-400" : "bg-emerald-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Engine Rationale Callout */}
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-emerald-400">Engine Rationale:</strong>{" "}
                          {simResult.message || simResult.reason}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5 text-center space-y-2">
                      <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
                      <h4 className="font-bold text-slate-200">No Suitable Storage Location Found</h4>
                      <p className="text-xs text-slate-400">{simResult.message || simResult.reason}</p>
                    </div>
                  )}

                  {/* Ranked Alternative Candidates */}
                  {(() => {
                    const alts = (simResult.alternatives && simResult.alternatives.length > 0)
                      ? simResult.alternatives
                      : (simResult.candidate_locations && simResult.candidate_locations.length > 1)
                      ? simResult.candidate_locations.slice(1)
                      : [];

                    if (alts.length === 0) return null;

                    return (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                          Ranked Alternative Candidates ({alts.length})
                        </h4>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {alts.map((cand, idx) => {
                            const candAvail = Number(cand.available_headroom_units ?? cand.available_capacity ?? 0);
                            return (
                              <div
                                key={cand.location_id || idx}
                                className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs hover:border-slate-600 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-200">{cand.code}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">[{cand.zone || "STORAGE"}]</span>
                                  <span className="text-[10px] text-slate-400">{cand.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] text-emerald-400 font-mono">
                                    Headroom: {candAvail.toFixed(0)} units
                                  </span>
                                  <button
                                    onClick={() => handleHighlightLocation(cand.location_id, cand.code)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                                  >
                                    Highlight
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Information Guide when not evaluated yet */
                <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 text-[11px] text-slate-400 space-y-2">
                  <div className="font-semibold text-slate-300">How the Putaway Rule Engine works:</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    <li>
                      <strong className="text-rose-400">Priority 1 (Quarantine Isolation):</strong> Damaged goods are automatically routed to the QUARANTINE zone to prevent mixing with sound inventory.
                    </li>
                    <li>
                      <strong className="text-purple-400">Priority 2 (Dedicated Item Bin):</strong> Products with configured bin affinities are assigned directly to their dedicated shelf/bin.
                    </li>
                    <li>
                      <strong className="text-blue-400">Priority 3 (Co-located Stock):</strong> Bins currently holding the same product and batch with available headroom are matched to consolidate lots.
                    </li>
                    <li>
                      <strong className="text-emerald-400">Priority 4 (Nearest Empty Bin):</strong> Bins are evaluated in sequence (<code className="text-slate-300">Aisle → Rack → Shelf → Bin</code>) to minimize traversal distance.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Engine: SMRITI-PUTAWAY-v3.127.0
              </span>
              <button
                onClick={() => setIsPutawayAdvisorOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Picking Bin Replenishment & Slotting Engine Modal */}
      {isReplenishmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Layers className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    Dynamic Picking Bin Replenishment & Slotting Engine
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Monitors fast-picking bins below min reorder levels and generates internal transfer tasks from reserve bulk racks.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (activeReplenishTab === "TASKS") fetchReplenishmentTasks();
                    else fetchSlotting();
                  }}
                  disabled={replenishmentLoading || slottingLoading}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${replenishmentLoading || slottingLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setIsReplenishmentModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/40">
              <button
                onClick={() => {
                  setActiveReplenishTab("TASKS");
                  fetchReplenishmentTasks();
                }}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeReplenishTab === "TASKS"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Active Replenishment Tasks
                {replenishmentTasks.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {replenishmentTasks.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setActiveReplenishTab("SLOTTING");
                  fetchSlotting();
                }}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeReplenishTab === "SLOTTING"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Min/Max Slotting Rules
                {slottingList.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                    {slottingList.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
              {activeReplenishTab === "TASKS" ? (
                <>
                  {/* Summary Metric Pills */}
                  {replenishmentResponse && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-850 p-3 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Depleted</div>
                        <div className="text-xl font-mono font-bold text-slate-100">{replenishmentResponse.total_tasks}</div>
                      </div>
                      <div className="bg-slate-850 p-3 rounded-xl border border-rose-500/30">
                        <div className="text-[10px] text-rose-400 uppercase font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Critical (Stockout)
                        </div>
                        <div className="text-xl font-mono font-bold text-rose-400">{replenishmentResponse.critical_count}</div>
                      </div>
                      <div className="bg-slate-850 p-3 rounded-xl border border-amber-500/30">
                        <div className="text-[10px] text-amber-400 uppercase font-semibold">High Priority</div>
                        <div className="text-xl font-mono font-bold text-amber-400">{replenishmentResponse.high_count}</div>
                      </div>
                      <div className="bg-slate-850 p-3 rounded-xl border border-slate-700">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Bulk Stockout</div>
                        <div className="text-xl font-mono font-bold text-slate-300">{replenishmentResponse.bulk_stockout_count}</div>
                      </div>
                    </div>
                  )}

                  {/* Filter Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(["ALL", "CRITICAL", "HIGH", "NORMAL", "BULK_STOCKOUT"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setReplenishmentFilter(p)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            replenishmentFilter === p
                              ? "bg-cyan-600 text-white font-semibold"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search item / bin..."
                        value={replenishmentSearch}
                        onChange={(e) => setReplenishmentSearch(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48"
                      />
                    </div>
                  </div>

                  {/* Tasks Table */}
                  {replenishmentLoading ? (
                    <div className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
                      Scanning picking bin stock and reserve bulk racks...
                    </div>
                  ) : replenishmentTasks.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 bg-slate-850/50 rounded-2xl border border-slate-800">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                      <p className="font-semibold text-slate-200">All Picking Bins Balanced!</p>
                      <p className="text-[11px] text-slate-400 mt-1">No bins are currently below their minimum safety threshold.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] text-slate-400 uppercase font-semibold">
                            <th className="py-2.5 px-3 w-8">
                              <input
                                type="checkbox"
                                checked={
                                  replenishmentTasks.filter((t) => t.status === "READY").length > 0 &&
                                  replenishmentTasks
                                    .filter((t) => t.status === "READY")
                                    .every((t) => selectedTaskIds.has(t.task_id))
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const readyIds = new Set(
                                      replenishmentTasks.filter((t) => t.status === "READY").map((t) => t.task_id)
                                    );
                                    setSelectedTaskIds(readyIds);
                                  } else {
                                    setSelectedTaskIds(new Set());
                                  }
                                }}
                                className="accent-cyan-500 rounded cursor-pointer"
                              />
                            </th>
                            <th className="py-2.5 px-3">Item Details</th>
                            <th className="py-2.5 px-3">Target Picking Bin</th>
                            <th className="py-2.5 px-3">Source Bulk Bin</th>
                            <th className="py-2.5 px-3 text-center">Transfer Qty</th>
                            <th className="py-2.5 px-3">Urgency</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                          {replenishmentTasks
                            .filter((t) => {
                              if (replenishmentFilter !== "ALL" && t.priority !== replenishmentFilter) return false;
                              if (replenishmentSearch.trim()) {
                                const q = replenishmentSearch.toLowerCase();
                                return (
                                  t.item_code.toLowerCase().includes(q) ||
                                  t.product_name.toLowerCase().includes(q) ||
                                  t.picking_bin.toLowerCase().includes(q) ||
                                  (t.source_bin || "").toLowerCase().includes(q)
                                );
                              }
                              return true;
                            })
                            .map((task) => {
                              const isSelected = selectedTaskIds.has(task.task_id);
                              const isReady = task.status === "READY";
                              const currentOverride = taskQtyOverrides[task.task_id] ?? task.suggested_quantity;

                              return (
                                <tr
                                  key={task.task_id}
                                  className={`hover:bg-slate-800/50 transition-colors ${
                                    task.priority === "CRITICAL"
                                      ? "bg-rose-950/20"
                                      : task.priority === "HIGH"
                                      ? "bg-amber-950/10"
                                      : ""
                                  }`}
                                >
                                  <td className="py-2.5 px-3">
                                    <input
                                      type="checkbox"
                                      disabled={!isReady}
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const next = new Set(selectedTaskIds);
                                        if (e.target.checked) next.add(task.task_id);
                                        else next.delete(task.task_id);
                                        setSelectedTaskIds(next);
                                      }}
                                      className="accent-cyan-500 rounded cursor-pointer disabled:opacity-30"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 font-sans">
                                    <div className="font-bold text-slate-100">{task.product_name}</div>
                                    <div className="text-[10px] font-mono text-cyan-400">{task.item_code}</div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-slate-200">{task.picking_bin}</div>
                                    <div className="text-[10px] text-slate-400">
                                      Stock: <span className={task.current_picking_stock === 0 ? "text-rose-400 font-bold" : "text-amber-300 font-bold"}>{task.current_picking_stock}</span> / Min: {task.min_reorder_level}
                                    </div>
                                    <div className="w-24 bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                                      <div
                                        className={`h-full ${
                                          task.current_picking_stock === 0 ? "bg-rose-500" : "bg-amber-400"
                                        }`}
                                        style={{
                                          width: `${Math.min(100, (task.current_picking_stock / Math.max(1, task.max_capacity)) * 100)}%`,
                                        }}
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {task.source_bin ? (
                                      <div>
                                        <div className="font-bold text-emerald-400">{task.source_bin}</div>
                                        <div className="text-[10px] text-slate-400">
                                          Avail: <strong className="text-slate-200">{task.available_bulk_stock}</strong> units
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-rose-400 italic">No reserve bulk stock</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <input
                                      type="number"
                                      disabled={!isReady}
                                      value={currentOverride}
                                      onChange={(e) => {
                                        const v = parseFloat(e.target.value) || 0;
                                        setTaskQtyOverrides((prev) => ({ ...prev, [task.task_id]: v }));
                                      }}
                                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-center text-xs text-white focus:outline-none focus:border-cyan-400 disabled:opacity-40"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {task.priority === "CRITICAL" ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                        🔴 CRITICAL
                                      </span>
                                    ) : task.priority === "HIGH" ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        🟡 HIGH
                                      </span>
                                    ) : task.priority === "BULK_STOCKOUT" ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600">
                                        🚫 PO REQUIRED
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                        🔵 NORMAL
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {isReady ? (
                                      <button
                                        onClick={() => handleExecuteReplenishment([task])}
                                        disabled={replenishmentExecuting}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                                      >
                                        Transfer
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">Blocked</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                /* Slotting Configuration Tab */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-200">Item Picking Bin Affinities</h4>
                      <p className="text-[11px] text-slate-400">
                        Governs dedicated fast-picking bins, safety stock reorder triggers, and bin maximum capacities.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsSlottingFormOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Configure Slotting
                    </button>
                  </div>

                  {/* Slotting Form Modal / Drawer */}
                  {isSlottingFormOpen && (
                    <form onSubmit={handleSaveSlotting} className="bg-slate-850 p-4 rounded-xl border border-slate-700 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="font-bold text-slate-200">New Item Picking Slot Assignment</span>
                        <button type="button" onClick={() => setIsSlottingFormOpen(false)} className="text-slate-400 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1">Item ID / Code *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. ITEM-001"
                            value={slotItemId}
                            onChange={(e) => setSlotItemId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1">Dedicated Picking Bin Code *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. PICK-A01-01"
                            value={slotLocationBin}
                            onChange={(e) => setSlotLocationBin(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1">Min Reorder Level (Units)</label>
                          <input
                            type="number"
                            min="1"
                            value={slotMinLevel}
                            onChange={(e) => setSlotMinLevel(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1">Max Bin Capacity (Units)</label>
                          <input
                            type="number"
                            min="1"
                            value={slotMaxCapacity}
                            onChange={(e) => setSlotMaxCapacity(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] font-semibold mb-1">Standard Reorder Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={slotReorderQty}
                            onChange={(e) => setSlotReorderQty(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsSlottingFormOpen(false)}
                          className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={slotSaving}
                          className="px-4 py-1.5 rounded-lg font-bold bg-cyan-600 hover:bg-cyan-500 text-white"
                        >
                          {slotSaving ? "Saving..." : "Save Slotting Rule"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Slotting Master Table */}
                  {slottingLoading ? (
                    <div className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                      Loading slotting configurations...
                    </div>
                  ) : slottingList.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 bg-slate-850/50 rounded-xl border border-slate-800">
                      No item slotting rules configured yet. Click "Configure Slotting" above to map items to fast-picking bins.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left border-collapse font-mono text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] text-slate-400 uppercase font-semibold">
                            <th className="py-2.5 px-3">Item Code</th>
                            <th className="py-2.5 px-3">Item Name</th>
                            <th className="py-2.5 px-3">Assigned Bin</th>
                            <th className="py-2.5 px-3 text-right">Current Stock</th>
                            <th className="py-2.5 px-3 text-right">Min Trigger</th>
                            <th className="py-2.5 px-3 text-right">Max Capacity</th>
                            <th className="py-2.5 px-3 text-right">Reorder Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {slottingList.map((slot) => (
                            <tr key={slot.id || slot.item_id} className="hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-bold text-cyan-400">{slot.item_code}</td>
                              <td className="py-2.5 px-3 font-sans text-slate-200">{slot.item_name}</td>
                              <td className="py-2.5 px-3 text-emerald-400 font-bold">{slot.location_bin}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-100">{slot.current_stock}</td>
                              <td className="py-2.5 px-3 text-right text-amber-400">{slot.min_reorder_level}</td>
                              <td className="py-2.5 px-3 text-right text-slate-300">{slot.max_capacity}</td>
                              <td className="py-2.5 px-3 text-right text-cyan-300">{slot.reorder_quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer / Batch Action Toolbar */}
            {activeReplenishTab === "TASKS" && (
              <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">
                    Selected: <strong className="text-cyan-400">{selectedTaskIds.size}</strong> task(s)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsReplenishmentModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleExecuteReplenishment()}
                    disabled={selectedTaskIds.size === 0 || replenishmentExecuting}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 transition-all shadow-md cursor-pointer"
                  >
                    <ArrowRightLeft className={`w-3.5 h-3.5 ${replenishmentExecuting ? "animate-spin" : ""}`} />
                    <span>{replenishmentExecuting ? "Executing Transfers..." : `Execute ${selectedTaskIds.size} Replenishment(s)`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
