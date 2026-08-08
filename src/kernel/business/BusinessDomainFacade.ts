/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Business Domain Facade (SPK.business)
 * Author       : Jawahar Ramkripal Mallah
 * Standard     : Business Constitution v1.0 — Unified Business Domain Facade (BASELINE LTS)
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { SPK } from "../SPK.js";
import { IInventoryService } from "../public/IInventoryService.js";
import { IPurchaseService } from "../public/IPurchaseService.js";
import { ISalesService } from "../public/ISalesService.js";
import { SchemeEngine } from "../../services/schemeEngine.ts";
import { DemoDataRegistry } from "../config/SmritiDemoDataRegistry.ts";

export const BusinessDomain = {
  get masterData() { return DemoDataRegistry; },
  get inventory(): IInventoryService { return SPK.services.resolve<IInventoryService>("INVENTORY"); },
  get purchase(): IPurchaseService { return SPK.services.resolve<IPurchaseService>("PURCHASE"); },
  get sales(): ISalesService { return SPK.services.resolve<ISalesService>("SALES"); },
  get schemes() { return SchemeEngine; },
  tally: { syncQueue: [], isCommunicatorActive: true },
  distribution: { routes: [], beats: [], salesman: [] },
  reports: { dailySales: [], stockValuation: [] },
  configuration: { branch: "HO-MUMBAI", warehouse: "WH-MAIN", numberingSeries: "INV-2026-" },
  crm: { customers: [], suppliers: [] },
  loyalty: { pointsRatio: 0.01, giftVouchers: [] },
};

export const SPK_business = BusinessDomain;
