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

import { Product, Customer, CustomerGroup, POSProfile, Shift, SalesInvoice, AuditLog, SyncQueueItem } from "../../core/domain/entities.js";
import { IProductRepository, ICustomerRepository, IShiftRepository, ISalesInvoiceRepository, IAuditRepository, ISyncRepository, IUserRepository, IPOSProfileRepository, IPurchaseRepository, IStateRepository } from "../../core/interfaces/db.js";
import { User } from "../../types.js";

// Stubs for SQLite (to be populated in Android context deployments)
export class SqliteProductRepository implements IProductRepository {
  async getAll(): Promise<Product[]> { return []; }
  async getById(id: string): Promise<Product | null> { return null; }
  async create(product: Product): Promise<Product> { return product; }
  async update(id: string, product: Partial<Product>): Promise<Product> { throw new Error("Method not implemented."); }
  async delete(id: string): Promise<boolean> { return false; }
  async addBarcode(id: string, value: string): Promise<Product> { throw new Error("Method not implemented."); }
  async deleteBarcode(id: string, value: string): Promise<Product> { throw new Error("Method not implemented."); }
}

export class SqliteCustomerRepository implements ICustomerRepository {
  async getAll(): Promise<Customer[]> { return []; }
  async getById(id: string): Promise<Customer | null> { return null; }
  async getAllGroups(): Promise<CustomerGroup[]> { return []; }
  async updateOutstanding(id: string, amount: number): Promise<Customer> { throw new Error("Method not implemented."); }
  async create(customer: Customer): Promise<Customer> { throw new Error("Method not implemented in offline mode."); }
  async update(id: string, customer: Partial<Customer>): Promise<Customer> { throw new Error("Method not implemented in offline mode."); }
  async createGroup(group: CustomerGroup): Promise<CustomerGroup> { throw new Error("Method not implemented in offline mode."); }
  async updateGroup(id: string, group: Partial<CustomerGroup>): Promise<CustomerGroup> { throw new Error("Method not implemented in offline mode."); }
}

export class SqliteShiftRepository implements IShiftRepository {
  async getAll(): Promise<Shift[]> { return []; }
  async getById(id: string): Promise<Shift | null> { return null; }
  async getOpenShift(id: string): Promise<Shift | null> { return null; }
  async create(shift: Shift): Promise<Shift> { return shift; }
  async updateStats(id: string, count: number, value: number): Promise<Shift> { throw new Error("Method not implemented."); }
  async close(id: string, closingCash: number): Promise<Shift> { throw new Error("Method not implemented."); }
}

export class SqliteSalesInvoiceRepository implements ISalesInvoiceRepository {
  async getAll(): Promise<SalesInvoice[]> { return []; }
  async getById(id: string): Promise<SalesInvoice | null> { return null; }
  async create(invoice: SalesInvoice): Promise<SalesInvoice> { return invoice; }
  async update(id: string, invoice: Partial<SalesInvoice>): Promise<SalesInvoice> { throw new Error("Method not implemented."); }
}

export class SqliteAuditRepository implements IAuditRepository {
  async getAll(): Promise<AuditLog[]> { return []; }
  async log(audit: Omit<AuditLog, "id">): Promise<void> {}
}

export class SqliteSyncRepository implements ISyncRepository {
  async getQueue(): Promise<SyncQueueItem[]> { return []; }
  async enqueue(item: Omit<SyncQueueItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">): Promise<SyncQueueItem> {
    return {
      ...item,
      id: 1,
      status: "pending",
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  async updateStatus(id: number, status: "pending" | "synced" | "failed", lastAttempt?: string): Promise<void> {}
  async incrementRetry(id: number): Promise<void> {}
}

export class SqliteUserRepository implements IUserRepository {
  async getAll(): Promise<User[]> { throw new Error("Method not implemented in offline mode."); }
  async getById(id: string): Promise<User | null> { throw new Error("Method not implemented in offline mode."); }
  async getByUsername(username: string): Promise<User | null> { throw new Error("Method not implemented in offline mode."); }
  async create(user: User): Promise<User> { throw new Error("Method not implemented in offline mode."); }
  async update(id: string, user: Partial<User>): Promise<User> { throw new Error("Method not implemented in offline mode."); }
  async delete(id: string): Promise<boolean> { throw new Error("Method not implemented in offline mode."); }
}

export class SqlitePOSProfileRepository implements IPOSProfileRepository {
  async getAll(): Promise<POSProfile[]> { throw new Error("Method not implemented in offline mode."); }
  async getById(id: string): Promise<POSProfile | null> { throw new Error("Method not implemented in offline mode."); }
  async create(profile: POSProfile): Promise<POSProfile> { throw new Error("Method not implemented in offline mode."); }
  async update(id: string, profile: Partial<POSProfile>): Promise<POSProfile> { throw new Error("Method not implemented in offline mode."); }
}

export class SqlitePurchaseRepository implements IPurchaseRepository {
  async getAllSuppliers(): Promise<any[]> { throw new Error("Method not implemented in offline mode."); }
  async getSupplierById(id: string): Promise<any | null> { throw new Error("Method not implemented in offline mode."); }
  async createSupplier(supplier: any): Promise<any> { throw new Error("Method not implemented in offline mode."); }
  async updateSupplier(id: string, supplier: Partial<any>): Promise<any> { throw new Error("Method not implemented in offline mode."); }
  async deleteSupplier(id: string): Promise<boolean> { throw new Error("Method not implemented in offline mode."); }

  async getAllOrders(): Promise<any[]> { throw new Error("Method not implemented in offline mode."); }
  async getOrderById(id: string): Promise<any | null> { throw new Error("Method not implemented in offline mode."); }
  async createOrder(order: any): Promise<any> { throw new Error("Method not implemented in offline mode."); }
  async updateOrder(id: string, order: Partial<any>): Promise<any> { throw new Error("Method not implemented in offline mode."); }

  async getAllReceipts(): Promise<any[]> { throw new Error("Method not implemented in offline mode."); }
  async getReceiptById(id: string): Promise<any | null> { throw new Error("Method not implemented in offline mode."); }
  async createReceipt(receipt: any): Promise<any> { throw new Error("Method not implemented in offline mode."); }
  async updateReceipt(id: string, receipt: Partial<any>): Promise<any> { throw new Error("Method not implemented in offline mode."); }
}

export class SqliteStateRepository implements IStateRepository {
  async getCollection(name: string): Promise<any[]> { throw new Error("Method not implemented in offline mode."); }
  async saveCollection(name: string, data: any[]): Promise<void> { throw new Error("Method not implemented in offline mode."); }
  async saveDb(): Promise<void> { throw new Error("Method not implemented in offline mode."); }
}


