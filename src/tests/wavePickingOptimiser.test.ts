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

import { describe, it, expect } from "vitest";
import WavePickingOptimiser, { Picker, PickWave, Zone } from "../utils/wavePickingOptimiser";

describe("WavePickingOptimiser — Warehouse Wave Picking Optimiser", () => {
  const PICKERS: Picker[] = [
    { pickerId: "PKR-01", name: "Suresh Kumar",  currentZone: "A", isAvailable: true },
    { pickerId: "PKR-02", name: "Meena Pillai",  currentZone: "B", isAvailable: true },
    { pickerId: "PKR-03", name: "Ravi Shankar",  currentZone: "A", isAvailable: true },
  ];

  const ORDER_LINES = [
    { orderId: "ORD-001", lineNo: 1, sku: "SKU-A1", productName: "Polo Shirt M", requestedQty: 10, location: { zone: "A" as Zone, aisle: 1, bay: 3, level: 2 } },
    { orderId: "ORD-001", lineNo: 2, sku: "SKU-A2", productName: "Polo Shirt L", requestedQty: 5,  location: { zone: "A" as Zone, aisle: 1, bay: 5, level: 1 } },
    { orderId: "ORD-002", lineNo: 1, sku: "SKU-B1", productName: "Denim Slim 32", requestedQty: 8, location: { zone: "B" as Zone, aisle: 3, bay: 2, level: 3 } },
    { orderId: "ORD-002", lineNo: 2, sku: "SKU-B2", productName: "Denim Slim 34", requestedQty: 6, location: { zone: "B" as Zone, aisle: 3, bay: 4, level: 2 } },
    { orderId: "ORD-003", lineNo: 1, sku: "SKU-C1", productName: "Sneakers Wht 9", requestedQty: 4, location: { zone: "C" as Zone, aisle: 2, bay: 1, level: 1 } },
  ];

  // ─── Test 1: Wave creation and sort key computation ───────────────────────
  it("creates wave with correct task count and serpentine sort keys assigned", () => {
    const wave = WavePickingOptimiser.createWave({
      branchCode: "BR-MUM-01", orderLines: ORDER_LINES, pickers: PICKERS,
    });

    expect(wave.totalTasks).toBe(5);
    expect(wave.status).toBe("OPEN");
    expect(wave.tasks).toHaveLength(5);

    // All tasks start as PENDING
    expect(wave.tasks.every((t) => t.status === "PENDING")).toBe(true);

    // Sort keys computed: Zone A (idx=0), B (idx=1), C (idx=2)
    // A-aisle1-bay3 vs A-aisle1-bay5: both odd aisle → bay ascending → bay3 < bay5
    const zoneTasks = wave.tasks.filter((t) => t.location.zone === "A")
      .sort((a, b) => a.sortKey - b.sortKey);
    expect(zoneTasks[0].location.bay).toBe(3);  // bay 3 before bay 5
    expect(zoneTasks[1].location.bay).toBe(5);

    // Zone B tasks have higher sort keys than Zone A
    const zoneATasks = wave.tasks.filter((t) => t.location.zone === "A");
    const zoneBTasks = wave.tasks.filter((t) => t.location.zone === "B");
    expect(Math.min(...zoneBTasks.map((t) => t.sortKey))).toBeGreaterThan(
      Math.max(...zoneATasks.map((t) => t.sortKey))
    );
  });

  // ─── Test 2: Picker assignment by zone preference ─────────────────────────
  it("assigns pickers to tasks, preferring zone-matched pickers, transitioning to IN_PROGRESS", () => {
    const wave = WavePickingOptimiser.createWave({ branchCode: "BR-MUM-01", orderLines: ORDER_LINES, pickers: PICKERS });
    const assigned = WavePickingOptimiser.assignTasks(wave);

    expect(assigned.status).toBe("IN_PROGRESS");
    expect(assigned.startedAt).toBeDefined();
    expect(assigned.tasks.every((t) => t.pickerId !== undefined)).toBe(true);

    // Zone A tasks should be assigned to PKR-01 or PKR-03 (both currentZone "A")
    const zoneATasks = assigned.tasks.filter((t) => t.location.zone === "A");
    expect(zoneATasks.every((t) => ["PKR-01", "PKR-03"].includes(t.pickerId!))).toBe(true);

    // Zone B tasks should be assigned to PKR-02 (currentZone "B")
    const zoneBTasks = assigned.tasks.filter((t) => t.location.zone === "B");
    expect(zoneBTasks.every((t) => t.pickerId === "PKR-02")).toBe(true);
  });

  // ─── Test 3: Pick path optimisation within zone ───────────────────────────
  it("returns tasks in serpentine order for a picker's zone path", () => {
    const wave = WavePickingOptimiser.createWave({ branchCode: "BR-MUM-01", orderLines: ORDER_LINES, pickers: PICKERS });
    const assigned = WavePickingOptimiser.assignTasks(wave);

    // Get optimised path for PKR-01 in zone A
    const path = WavePickingOptimiser.optimisePath(assigned, "A", "PKR-01");

    // Verify path is sorted by ascending sort key (serpentine order)
    for (let i = 1; i < path.length; i++) {
      expect(path[i].sortKey).toBeGreaterThanOrEqual(path[i - 1].sortKey);
    }
  });

  // ─── Test 4: Pick recording, short/skip detection, wave completion ─────────
  it("records picks correctly — marks SHORTED on partial qty, COMPLETED when all tasks done", () => {
    let wave = WavePickingOptimiser.createWave({ branchCode: "BR-MUM-01", orderLines: ORDER_LINES, pickers: PICKERS });
    wave = WavePickingOptimiser.assignTasks(wave);

    const taskIds = wave.tasks.map((t) => t.taskId);

    // Pick all tasks: first full, second short, rest full
    wave = WavePickingOptimiser.recordPick(wave, taskIds[0], wave.tasks[0].requestedQty);  // PICKED
    wave = WavePickingOptimiser.recordPick(wave, taskIds[1], 3);                            // SHORTED (req 5, got 3)
    wave = WavePickingOptimiser.recordPick(wave, taskIds[2], wave.tasks[2].requestedQty);
    wave = WavePickingOptimiser.recordPick(wave, taskIds[3], wave.tasks[3].requestedQty);
    wave = WavePickingOptimiser.recordPick(wave, taskIds[4], 0);                            // SKIPPED

    expect(wave.tasks[0].status).toBe("PICKED");
    expect(wave.tasks[1].status).toBe("SHORTED");
    expect(wave.tasks[1].shortQty).toBe(2);               // 5 - 3 = 2 short
    expect(wave.tasks[4].status).toBe("SKIPPED");
    expect(wave.status).toBe("COMPLETED");
    expect(wave.completedAt).toBeDefined();

    // Metrics
    const metrics = WavePickingOptimiser.computeMetrics(wave);
    expect(metrics.pickedTasks).toBe(3);
    expect(metrics.shortedTasks).toBe(1);
    expect(metrics.skippedTasks).toBe(1);
    expect(metrics.completionRate).toBe(80);             // 4/5 done (picked+shorted)
    expect(metrics.shortRate).toBe(20);                  // 1/5 shorted
    expect(metrics.totalUnitsPicked).toBe(10 + 3 + 8 + 6 + 0);  // 27
  });
});
