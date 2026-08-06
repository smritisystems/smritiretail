/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Business Domain Facade (SPK.business)
 * Author       : Jawahar Ramkripal Mallah
 * Standard     : Business Constitution v1.0 — Unified Business Domain Facade (BASELINE LTS)
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { InventoryService } from "../internal/InventoryService.ts";
import { PurchaseService } from "../internal/PurchaseService.ts";
import { SalesService } from "../internal/SalesService.ts";
import { SchemeEngine } from "../../services/schemeEngine.ts";
import { DemoDataRegistry } from "../config/SmritiDemoDataRegistry.ts";

export const BusinessDomain = {
  masterData: DemoDataRegistry,
  inventory: new InventoryService(),
  purchase: new PurchaseService(),
  sales: new SalesService(),
  schemes: SchemeEngine,
  tally: { syncQueue: [], isCommunicatorActive: true },
  distribution: { routes: [], beats: [], salesman: [] },
  reports: { dailySales: [], stockValuation: [] },
  configuration: { branch: "HO-MUMBAI", warehouse: "WH-MAIN", numberingSeries: "INV-2026-" },
  crm: { customers: [], suppliers: [] },
  loyalty: { pointsRatio: 0.01, giftVouchers: [] },
};

export const SPK_business = BusinessDomain;
