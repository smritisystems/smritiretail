/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : Distribution & Field Sales Engine (ADR-DIST-001)
 * Standard     : SCS-BUS-001 / SCS-BUS-004 — Retail Field Sales & Van Distribution Engine
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import logger from "../core/logging/logger.js";
import { SPK } from "../kernel/SPK.js";

export interface SalesmanRecord {
  id: string;
  code: string;
  name: string;
  mobile: string;
  assignedRoute: string;
  assignedVehicle: string;
  status: "Active" | "Inactive";
}

export interface BeatRouteRecord {
  id: string;
  routeName: string;
  beatDay: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  salesmanId: string;
  targetRetailersCount: number;
  visitedRetailersCount: number;
}

export interface VanStockLoadRecord {
  id: string;
  vehicleNo: string;
  salesmanId: string;
  warehouseId: string;
  loadedDate: string;
  status: "DRAFT" | "DISPATCHED" | "SETTLED";
  items: {
    itemId: string;
    itemCode: string;
    itemName: string;
    loadedQty: number;
    soldQty: number;
    returnQty: number;
    unitPrice: number;
  }[];
}

export class DistributionEngine {
  private static instance: DistributionEngine;

  private salesmen: SalesmanRecord[] = [
    {
      id: "sm-101",
      code: "S01",
      name: "Rahul Sharma",
      mobile: "+91 9876543210",
      assignedRoute: "Route 01 — Western Express Highway",
      assignedVehicle: "MH-02-DN-4521",
      status: "Active",
    },
    {
      id: "sm-102",
      code: "S02",
      name: "Vikram Singh",
      mobile: "+91 9812345678",
      assignedRoute: "Route 02 — Central Suburban Belt",
      assignedVehicle: "MH-04-ER-8890",
      status: "Active",
    },
  ];

  private beatRoutes: BeatRouteRecord[] = [
    {
      id: "beat-101",
      routeName: "Route 01 — Western Express Highway",
      beatDay: "Monday",
      salesmanId: "sm-101",
      targetRetailersCount: 24,
      visitedRetailersCount: 18,
    },
    {
      id: "beat-102",
      routeName: "Route 02 — Central Suburban Belt",
      beatDay: "Tuesday",
      salesmanId: "sm-102",
      targetRetailersCount: 30,
      visitedRetailersCount: 26,
    },
  ];

  private vanLoads: VanStockLoadRecord[] = [
    {
      id: "van-1001",
      vehicleNo: "MH-02-DN-4521",
      salesmanId: "sm-101",
      warehouseId: "wh-main",
      loadedDate: new Date().toISOString().slice(0, 10),
      status: "DISPATCHED",
      items: [
        {
          itemId: "prod-1",
          itemCode: "SHOE-001",
          itemName: "Nike Sports Shoes",
          loadedQty: 20,
          soldQty: 12,
          returnQty: 1,
          unitPrice: 2000,
        },
      ],
    },
  ];

  private constructor() {}

  public static getInstance(): DistributionEngine {
    if (!DistributionEngine.instance) {
      DistributionEngine.instance = new DistributionEngine();
    }
    return DistributionEngine.instance;
  }

  public getSalesmen(): SalesmanRecord[] {
    return [...this.salesmen];
  }

  public getBeatRoutes(): BeatRouteRecord[] {
    return [...this.beatRoutes];
  }

  public getVanLoads(): VanStockLoadRecord[] {
    return [...this.vanLoads];
  }

  public createVanLoad(vehicleNo: string, salesmanId: string, warehouseId: string, items: VanStockLoadRecord["items"]): VanStockLoadRecord {
    const newLoad: VanStockLoadRecord = {
      id: `van-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicleNo,
      salesmanId,
      warehouseId,
      loadedDate: new Date().toISOString().slice(0, 10),
      status: "DISPATCHED",
      items,
    };
    this.vanLoads.unshift(newLoad);
    logger.info(`[DistributionEngine] Created Van Stock Load ${newLoad.id} for vehicle ${vehicleNo}.`);
    SPK.events.emit("VanStockLoaded", newLoad.id, { loadId: newLoad.id, vehicleNo, salesmanId });
    return newLoad;
  }
}
