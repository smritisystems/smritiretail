/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.100.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Warehouse Wave Picking Optimiser
 *
 * Manages batch pick assignments across warehouse zones:
 *   - Wave creation: groups open order lines into a timed pick wave
 *   - Zone-based routing: assigns pick tasks by warehouse zone (A-F)
 *   - Picker assignment: distributes tasks across available pickers
 *   - Pick path optimisation: shortest-path heuristic within zone
 *     (sorts tasks by aisle → bay → level for a serpentine path)
 *   - Progress tracking: per-task status (PENDING → PICKED → SHORTED → SKIPPED)
 *   - Wave completion metrics
 */

export type PickTaskStatus = "PENDING" | "PICKED" | "SHORTED" | "SKIPPED";
export type WaveStatus     = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type Zone           = "A" | "B" | "C" | "D" | "E" | "F";

export interface PickLocation {
  zone: Zone;
  aisle: number;    // 1–20
  bay: number;      // 1–10
  level: number;    // 1–5  (1 = ground, 5 = top)
}

export interface PickTask {
  taskId: string;
  orderId: string;
  orderLine: number;
  sku: string;
  productName: string;
  requestedQty: number;
  pickedQty?: number;
  shortQty?: number;
  location: PickLocation;
  pickerId?: string;
  status: PickTaskStatus;
  pickedAt?: string;    // ISO
  sortKey: number;      // Computed serpentine sort key for path optimisation
}

export interface Picker {
  pickerId: string;
  name: string;
  currentZone?: Zone;
  isAvailable: boolean;
}

export interface PickWave {
  waveId: string;
  waveNo: number;
  branchCode: string;
  status: WaveStatus;
  tasks: PickTask[];
  pickers: Picker[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  totalTasks: number;
  completedTasks: number;
  shortedTasks: number;
}

export interface WaveMetrics {
  waveId: string;
  totalTasks: number;
  pickedTasks: number;
  shortedTasks: number;
  skippedTasks: number;
  completionRate: number;   // %
  shortRate: number;        // %
  totalUnitsRequested: number;
  totalUnitsPicked: number;
  pickerUtilisation: Record<string, number>;  // pickerId → task count
  avgTasksPerPicker: number;
}

/** Compute serpentine sort key: zone (A=0…F=5) × 100000 + aisle × 1000 + bay × 10 + level */
function serpentineKey(loc: PickLocation): number {
  const zoneIdx = "ABCDEF".indexOf(loc.zone);
  // Odd aisles: pick low-to-high bay; even aisles: high-to-low (serpentine)
  const bayKey = loc.aisle % 2 === 1 ? loc.bay : 11 - loc.bay;
  return zoneIdx * 100000 + loc.aisle * 1000 + bayKey * 10 + loc.level;
}

export class WavePickingOptimiser {
  private static waveCounter = 1;
  private static taskId = () => `TASK-${Date.now()}-${Math.floor(Math.random() * 999).toString().padStart(3, "0")}`;

  /** Create a new pick wave from open order lines */
  public static createWave(params: {
    branchCode: string;
    orderLines: Array<{
      orderId: string;
      lineNo: number;
      sku: string;
      productName: string;
      requestedQty: number;
      location: PickLocation;
    }>;
    pickers: Picker[];
  }): PickWave {
    const now = new Date().toISOString();

    // Build tasks with serpentine sort keys
    const tasks: PickTask[] = params.orderLines.map((ol) => ({
      taskId: this.taskId(),
      orderId: ol.orderId,
      orderLine: ol.lineNo,
      sku: ol.sku,
      productName: ol.productName,
      requestedQty: ol.requestedQty,
      location: ol.location,
      status: "PENDING" as PickTaskStatus,
      sortKey: serpentineKey(ol.location),
    }));

    const wave: PickWave = {
      waveId: `WAVE-${now.slice(0, 10).replace(/-/g, "")}-${String(this.waveCounter++).padStart(3, "0")}`,
      waveNo: this.waveCounter,
      branchCode: params.branchCode,
      status: "OPEN",
      tasks,
      pickers: params.pickers,
      createdAt: now,
      totalTasks: tasks.length,
      completedTasks: 0,
      shortedTasks: 0,
    };

    return wave;
  }

  /** Assign tasks to pickers by zone — round-robin within zone */
  public static assignTasks(wave: PickWave): PickWave {
    const availablePickers = wave.pickers.filter((p) => p.isAvailable);
    if (availablePickers.length === 0) return wave;

    // Group tasks by zone
    const byZone: Record<Zone, PickTask[]> = {} as any;
    for (const task of wave.tasks) {
      if (!byZone[task.location.zone]) byZone[task.location.zone] = [];
      byZone[task.location.zone].push(task);
    }

    // Sort each zone's tasks by serpentine key
    for (const zone of Object.keys(byZone) as Zone[]) {
      byZone[zone].sort((a, b) => a.sortKey - b.sortKey);
    }

    // Assign pickers: prefer assigning picker to their current zone
    const pickerZoneMap: Record<string, Zone | undefined> = {};
    for (const p of availablePickers) pickerZoneMap[p.pickerId] = p.currentZone;

    // Round-robin assignment within each zone
    const pickerIndex: Record<Zone, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    const updatedTasks = wave.tasks.map((task) => {
      const zoneTasks = byZone[task.location.zone];
      if (!zoneTasks) return task;

      // Find pickers that are assigned to this zone or have no preference
      const zonePreferred = availablePickers.filter((p) => p.currentZone === task.location.zone);
      const pool = zonePreferred.length > 0 ? zonePreferred : availablePickers;
      const idx = pickerIndex[task.location.zone] % pool.length;
      pickerIndex[task.location.zone]++;

      return { ...task, pickerId: pool[idx].pickerId };
    });

    return { ...wave, tasks: updatedTasks, status: "IN_PROGRESS", startedAt: new Date().toISOString() };
  }

  /** Optimise pick path within a zone — returns tasks sorted serpentine */
  public static optimisePath(wave: PickWave, zone: Zone, pickerId: string): PickTask[] {
    return wave.tasks
      .filter((t) => t.location.zone === zone && t.pickerId === pickerId && t.status === "PENDING")
      .sort((a, b) => a.sortKey - b.sortKey);
  }

  /** Record pick result for a task */
  public static recordPick(
    wave: PickWave,
    taskId: string,
    pickedQty: number
  ): PickWave {
    const now = new Date().toISOString();
    const tasks = wave.tasks.map((t) => {
      if (t.taskId !== taskId) return t;
      const shortQty = Math.max(0, t.requestedQty - pickedQty);
      const status: PickTaskStatus = pickedQty === 0 ? "SKIPPED" : shortQty > 0 ? "SHORTED" : "PICKED";
      return { ...t, pickedQty, shortQty, status, pickedAt: now };
    });

    const completedTasks = tasks.filter((t) => t.status === "PICKED").length;
    const shortedTasks   = tasks.filter((t) => t.status === "SHORTED").length;
    const allDone        = tasks.every((t) => t.status !== "PENDING");

    return {
      ...wave,
      tasks,
      completedTasks,
      shortedTasks,
      status: allDone ? "COMPLETED" : "IN_PROGRESS",
      completedAt: allDone ? now : undefined,
    };
  }

  /** Compute metrics for a wave */
  public static computeMetrics(wave: PickWave): WaveMetrics {
    const picked  = wave.tasks.filter((t) => t.status === "PICKED");
    const shorted = wave.tasks.filter((t) => t.status === "SHORTED");
    const skipped = wave.tasks.filter((t) => t.status === "SKIPPED");

    const totalRequested = wave.tasks.reduce((s, t) => s + t.requestedQty, 0);
    const totalPicked    = wave.tasks.reduce((s, t) => s + (t.pickedQty ?? 0), 0);

    // Picker utilisation
    const pickerUtilisation: Record<string, number> = {};
    for (const t of wave.tasks) {
      if (t.pickerId) pickerUtilisation[t.pickerId] = (pickerUtilisation[t.pickerId] ?? 0) + 1;
    }
    const assignedPickers = Object.keys(pickerUtilisation).length;

    return {
      waveId: wave.waveId,
      totalTasks: wave.totalTasks,
      pickedTasks: picked.length,
      shortedTasks: shorted.length,
      skippedTasks: skipped.length,
      completionRate: wave.totalTasks > 0 ? Math.round(((picked.length + shorted.length) / wave.totalTasks) * 100) : 0,
      shortRate: wave.totalTasks > 0 ? Math.round((shorted.length / wave.totalTasks) * 100) : 0,
      totalUnitsRequested: totalRequested,
      totalUnitsPicked: totalPicked,
      pickerUtilisation,
      avgTasksPerPicker: assignedPickers > 0 ? Math.round((wave.totalTasks / assignedPickers) * 10) / 10 : 0,
    };
  }
}

export default WavePickingOptimiser;
