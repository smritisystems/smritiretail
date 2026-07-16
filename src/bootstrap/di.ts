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
 * * Version    : 3.15.0
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-13
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import dotenv from "dotenv";
import { IProductRepository, ICustomerRepository, IShiftRepository, ISalesInvoiceRepository, IAuditRepository, ISyncRepository, IUserRepository, IPOSProfileRepository, IPurchaseRepository, IStateRepository } from "../core/interfaces/db.js";
import { PostgresProductRepository, PostgresCustomerRepository, PostgresShiftRepository, PostgresSalesInvoiceRepository, PostgresAuditRepository, PostgresSyncRepository, PostgresUserRepository, PostgresPOSProfileRepository, PostgresPurchaseRepository, PostgresStateRepository } from "../db/postgres/PostgresRepositories.js";
import { SqliteProductRepository, SqliteCustomerRepository, SqliteShiftRepository, SqliteSalesInvoiceRepository, SqliteAuditRepository, SqliteSyncRepository, SqliteUserRepository, SqlitePOSProfileRepository, SqlitePurchaseRepository, SqliteStateRepository } from "../db/sqlite/SqliteRepositories.js";
import { IndexedDbProductRepository, IndexedDbCustomerRepository, IndexedDbShiftRepository, IndexedDbSalesInvoiceRepository, IndexedDbAuditRepository, IndexedDbSyncRepository, IndexedDbUserRepository, IndexedDbPOSProfileRepository, IndexedDbPurchaseRepository, IndexedDbStateRepository } from "../db/indexeddb/IndexedDbRepositories.js";
import { MemoryProductRepository, MemoryCustomerRepository, MemoryShiftRepository, MemorySalesInvoiceRepository, MemoryAuditRepository, MemorySyncRepository, MemoryUserRepository, MemoryPOSProfileRepository, MemoryPurchaseRepository, MemoryStateRepository } from "../db/memory/MemoryRepositories.js";
import { SyncEngine } from "../core/sync/SyncEngine.js";
import { BillingService } from "../core/services/BillingService.js";

dotenv.config();

const dbProvider = process.env.DATABASE_PROVIDER || "postgres";

export interface DIContainer {
  products: IProductRepository;
  customers: ICustomerRepository;
  shifts: IShiftRepository;
  invoices: ISalesInvoiceRepository;
  audits: IAuditRepository;
  sync: ISyncRepository;
  state: IStateRepository;
  users: IUserRepository;
  posProfiles: IPOSProfileRepository;
  purchase: IPurchaseRepository;
  syncEngine: SyncEngine;
  billing: BillingService;
}

const instances: Partial<DIContainer> = {};

export function bootstrapDI(): DIContainer {
  if (instances.products) {
    return instances as DIContainer;
  }

  console.log(`[SMRITI Bootstrap] Initializing Platform Abstraction Layer (PAL) with DATABASE_PROVIDER: ${dbProvider}`);

  if (dbProvider === "postgres") {
    instances.products = new PostgresProductRepository();
    instances.customers = new PostgresCustomerRepository();
    instances.shifts = new PostgresShiftRepository();
    instances.invoices = new PostgresSalesInvoiceRepository();
    instances.audits = new PostgresAuditRepository();
    instances.sync = new PostgresSyncRepository();
    instances.state = new PostgresStateRepository();
    instances.users = new PostgresUserRepository();
    instances.posProfiles = new PostgresPOSProfileRepository();
    instances.purchase = new PostgresPurchaseRepository();
  } else if (dbProvider === "sqlite") {
    instances.products = new SqliteProductRepository();
    instances.customers = new SqliteCustomerRepository();
    instances.shifts = new SqliteShiftRepository();
    instances.invoices = new SqliteSalesInvoiceRepository();
    instances.audits = new SqliteAuditRepository();
    instances.sync = new SqliteSyncRepository();
    instances.state = new SqliteStateRepository();
    instances.users = new SqliteUserRepository();
    instances.posProfiles = new SqlitePOSProfileRepository();
    instances.purchase = new SqlitePurchaseRepository();
  } else if (dbProvider === "memory") {
    instances.products = new MemoryProductRepository();
    instances.customers = new MemoryCustomerRepository();
    instances.shifts = new MemoryShiftRepository();
    instances.invoices = new MemorySalesInvoiceRepository();
    instances.audits = new MemoryAuditRepository();
    instances.sync = new MemorySyncRepository();
    instances.state = new MemoryStateRepository();
    instances.users = new MemoryUserRepository();
    instances.posProfiles = new MemoryPOSProfileRepository();
    instances.purchase = new MemoryPurchaseRepository();
  } else {
    // Fallback to IndexedDB / Memory Mocks
    instances.products = new IndexedDbProductRepository();
    instances.customers = new IndexedDbCustomerRepository();
    instances.shifts = new IndexedDbShiftRepository();
    instances.invoices = new IndexedDbSalesInvoiceRepository();
    instances.audits = new IndexedDbAuditRepository();
    instances.sync = new IndexedDbSyncRepository();
    instances.state = new IndexedDbStateRepository();
    instances.users = new IndexedDbUserRepository();
    instances.posProfiles = new IndexedDbPOSProfileRepository();
    instances.purchase = new IndexedDbPurchaseRepository();
  }

  // Initialize Billing Service
  instances.billing = new BillingService(
    instances.products,
    instances.customers,
    instances.shifts,
    instances.invoices,
    instances.audits
  );

  // Initialize Sync Engine background worker
  instances.syncEngine = new SyncEngine(instances.sync!);
  instances.syncEngine.start();

  return instances as DIContainer;
}

export const container = bootstrapDI();
