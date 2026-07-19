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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.16.0
 * Created    : 2026-07-12
 * Modified   : 2026-07-14
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
  */

import { Product, Customer, CustomerGroup, POSProfile, Shift, SalesInvoice, AuditLog, SyncQueueItem } from "../../core/domain/entities.js";
import { IProductRepository, ICustomerRepository, IShiftRepository, ISalesInvoiceRepository, IAuditRepository, ISyncRepository, IUserRepository, IPOSProfileRepository, IPurchaseRepository, IStateRepository } from "../../core/interfaces/db.js";
import { User } from "../../types.js";
import * as store from "../../state/store.js";

export class MemoryProductRepository implements IProductRepository {
  async getAll(): Promise<Product[]> {
    return store.products as any[];
  }
  async getById(id: string): Promise<Product | null> {
    return (store.products.find(p => p.id === id) as any) || null;
  }
  async create(product: Product): Promise<Product> {
    store.products.push(product as any);
    return product;
  }
  async update(id: string, product: Partial<Product>): Promise<Product> {
    const idx = store.products.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Product not found");
    store.products[idx] = { ...store.products[idx], ...product } as any;
    return store.products[idx] as any;
  }
  async delete(id: string): Promise<boolean> {
    const idx = store.products.findIndex(p => p.id === id);
    if (idx === -1) return false;
    store.products.splice(idx, 1);
    return true;
  }
  async addBarcode(id: string, value: string): Promise<Product> {
    const p = await this.getById(id);
    if (!p) throw new Error("Product not found");
    p.secondaryBarcodes = p.secondaryBarcodes || [];
    p.secondaryBarcodes.push(value);
    return p;
  }
  async deleteBarcode(id: string, value: string): Promise<Product> {
    const p = await this.getById(id);
    if (!p) throw new Error("Product not found");
    p.secondaryBarcodes = p.secondaryBarcodes || [];
    p.secondaryBarcodes = p.secondaryBarcodes.filter(v => v !== value);
    return p;
  }
}

export class MemoryCustomerRepository implements ICustomerRepository {
  async getAll(): Promise<Customer[]> {
    return store.customers as any[];
  }
  async getById(id: string): Promise<Customer | null> {
    return (store.customers.find(c => c.id === id) as any) || null;
  }
  async create(customer: Customer): Promise<Customer> {
    store.customers.push(customer as any);
    return customer;
  }
  async update(id: string, customer: Partial<Customer>): Promise<Customer> {
    const idx = store.customers.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Customer not found");
    store.customers[idx] = { ...store.customers[idx], ...customer } as any;
    return store.customers[idx] as any;
  }
  async updateOutstanding(id: string, amount: number): Promise<Customer> {
    const c = await this.getById(id);
    if (!c) throw new Error("Customer not found");
    c.outstanding = (c.outstanding || 0) + amount;
    return c;
  }
  async getAllGroups(): Promise<CustomerGroup[]> {
    return store.customerGroups.map(g => ({
      id: g.id,
      name: g.name,
      discountPercentage: g.maxDiscountPercent || 0,
      allowCredit: g.canPurchaseOnCredit || false
    }));
  }
  async createGroup(group: CustomerGroup): Promise<CustomerGroup> {
    store.customerGroups.push({
      id: group.id,
      name: group.name,
      maxDiscountPercent: group.discountPercentage,
      canPurchaseOnCredit: group.allowCredit,
      creditLimit: 0,
      unlimitedCredit: !group.allowCredit,
      creditDays: 0,
      graceDays: 0,
      creditHold: false,
      autoBlockSales: false,
      warningThresholdPercent: 80,
      allowOverride: false,
      taxInclusive: true,
      minMarginPercent: 0,
      roundingRule: "Nearest1",
      allowedPaymentMethods: ["Cash", "UPI"],
      allowBackOrders: false,
      allowNegativeStockSales: false,
      requirePoNumber: false,
      invoiceLanguage: "en",
      canViewPrice: true,
      canViewMargin: true,
      canReceiveDiscount: true
    } as any);
    return group;
  }
  async updateGroup(id: string, group: Partial<CustomerGroup>): Promise<CustomerGroup> {
    const idx = store.customerGroups.findIndex(g => g.id === id);
    if (idx === -1) throw new Error("Customer group not found");
    const current = store.customerGroups[idx];
    store.customerGroups[idx] = {
      id: current.id,
      name: group.name !== undefined ? group.name : current.name,
      maxDiscountPercent: group.discountPercentage !== undefined ? group.discountPercentage : current.maxDiscountPercent,
      canPurchaseOnCredit: group.allowCredit !== undefined ? group.allowCredit : current.canPurchaseOnCredit,
      creditLimit: current.creditLimit,
      unlimitedCredit: current.unlimitedCredit,
      creditDays: current.creditDays,
      graceDays: current.graceDays,
      creditHold: current.creditHold,
      autoBlockSales: current.autoBlockSales,
      warningThresholdPercent: current.warningThresholdPercent,
      allowOverride: current.allowOverride,
      taxInclusive: current.taxInclusive,
      minMarginPercent: current.minMarginPercent,
      roundingRule: current.roundingRule,
      allowedPaymentMethods: current.allowedPaymentMethods,
      allowBackOrders: current.allowBackOrders,
      allowNegativeStockSales: current.allowNegativeStockSales,
      requirePoNumber: current.requirePoNumber,
      invoiceLanguage: current.invoiceLanguage,
      canViewPrice: current.canViewPrice,
      canViewMargin: current.canViewMargin,
      canReceiveDiscount: current.canReceiveDiscount
    } as any;
    return this.getAllGroups().then(list => list.find(g => g.id === id)!);
  }
}

export class MemoryShiftRepository implements IShiftRepository {
  async getAll(): Promise<Shift[]> {
    return store.shifts.map(s => this.mapToDomain(s));
  }
  async getById(id: string): Promise<Shift | null> {
    const s = store.shifts.find(x => x.id === id);
    return s ? this.mapToDomain(s) : null;
  }
  async getOpenShift(profileId: string): Promise<Shift | null> {
    const s = store.shifts.find(x => x.profileId === profileId && x.status === "Open");
    return s ? this.mapToDomain(s) : null;
  }
  async create(shift: Shift): Promise<Shift> {
    store.shifts.push(this.mapToStore(shift));
    return shift;
  }
  async updateStats(id: string, count: number, value: number): Promise<Shift> {
    const s = store.shifts.find(x => x.id === id);
    if (!s) throw new Error("Shift not found");
    s.salesCount = (s.salesCount || 0) + count;
    s.salesValue = (s.salesValue || 0) + value;
    return this.mapToDomain(s);
  }
  async close(id: string, closingCash: number): Promise<Shift> {
    const s = store.shifts.find(x => x.id === id);
    if (!s) throw new Error("Shift not found");
    s.status = "Closed";
    s.closingBalance = closingCash;
    s.closedAt = new Date().toISOString();
    return this.mapToDomain(s);
  }

  private mapToDomain(s: any): Shift {
    return {
      id: s.id,
      profileId: s.profileId,
      cashier: s.cashier || "Cashier User",
      warehouse: s.warehouse || "Main Warehouse",
      branch: s.branch || "HQ Store",
      startTime: s.startTime || s.openedAt,
      endTime: s.endTime || s.closedAt,
      status: s.status === "Locked" ? "Locked" : (s.status === "Closed" ? "Closed" : "Open"),
      openingCash: s.openingCash !== undefined ? s.openingCash : s.openingBalance,
      closingCash: s.closingCash !== undefined ? s.closingCash : s.closingBalance,
      salesCount: s.salesCount,
      salesValue: s.salesValue,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      openingBalance: s.openingBalance,
      closingBalance: s.closingBalance
    };
  }

  private mapToStore(s: Shift): any {
    return {
      id: s.id,
      profileId: s.profileId,
      openedAt: s.startTime,
      closedAt: s.endTime || null,
      openingBalance: s.openingCash,
      closingBalance: s.closingCash || null,
      salesCount: s.salesCount,
      salesValue: s.salesValue,
      status: s.status,
      cashier: s.cashier,
      warehouse: s.warehouse,
      branch: s.branch
    };
  }
}

export class MemorySalesInvoiceRepository implements ISalesInvoiceRepository {
  async getAll(): Promise<SalesInvoice[]> {
    return store.salesInvoices as any[];
  }
  async getById(id: string): Promise<SalesInvoice | null> {
    return (store.salesInvoices.find(i => i.id === id) as any) || null;
  }
  async create(invoice: SalesInvoice): Promise<SalesInvoice> {
    store.salesInvoices.push(invoice as any);
    return invoice;
  }
  async update(id: string, invoice: Partial<SalesInvoice>): Promise<SalesInvoice> {
    const idx = store.salesInvoices.findIndex(i => i.id === id);
    if (idx === -1) throw new Error("Invoice not found");
    store.salesInvoices[idx] = { ...store.salesInvoices[idx], ...invoice } as any;
    return store.salesInvoices[idx] as any;
  }
}

export class MemoryAuditRepository implements IAuditRepository {
  async getAll(): Promise<AuditLog[]> {
    return store.auditLogs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      operator: log.operator,
      actionType: log.actionType,
      tableName: log.tableName,
      recordId: log.recordId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      reason: log.reason
    }));
  }
  async log(audit: Omit<AuditLog, "id">): Promise<void> {
    store.auditLogs.push({
      id: `audit-${Date.now()}-${Math.random()}`,
      ...audit
    } as any);
  }
}

export class MemorySyncRepository implements ISyncRepository {
  private queue: SyncQueueItem[] = [];
  async getQueue(): Promise<SyncQueueItem[]> {
    return this.queue.filter(q => q.status !== "synced");
  }
  async enqueue(item: Omit<SyncQueueItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">): Promise<SyncQueueItem> {
    const created: SyncQueueItem = {
      ...item,
      id: this.queue.length + 1,
      status: "pending",
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.queue.push(created);
    return created;
  }
  async updateStatus(id: number, status: "pending" | "synced" | "failed", lastAttempt?: string): Promise<void> {
    const item = this.queue.find(q => q.id === id);
    if (item) {
      item.status = status;
      item.updatedAt = new Date().toISOString();
      if (lastAttempt) item.lastAttempt = lastAttempt;
    }
  }
  async incrementRetry(id: number): Promise<void> {
    const item = this.queue.find(q => q.id === id);
    if (item) {
      item.retryCount++;
      item.updatedAt = new Date().toISOString();
    }
  }
}

export class MemoryUserRepository implements IUserRepository {
  async getAll(): Promise<User[]> {
    return store.users;
  }
  async getById(id: string): Promise<User | null> {
    return store.users.find(u => u.id === id || u.userId === id) || null;
  }
  async getByUsername(username: string): Promise<User | null> {
    return store.users.find(u => u.username === username) || null;
  }
  async create(user: User): Promise<User> {
    store.users.push(user);
    return user;
  }
  async update(id: string, user: Partial<User>): Promise<User> {
    const idx = store.users.findIndex(u => u.id === id || u.userId === id);
    if (idx === -1) throw new Error("User not found");
    store.users[idx] = { ...store.users[idx], ...user };
    return store.users[idx];
  }
  async delete(id: string): Promise<boolean> {
    const idx = store.users.findIndex(u => u.id === id || u.userId === id);
    if (idx === -1) return false;
    store.users.splice(idx, 1);
    return true;
  }
}

export class MemoryPOSProfileRepository implements IPOSProfileRepository {
  async getAll(): Promise<POSProfile[]> {
    return store.profiles.map(p => this.mapToDomain(p));
  }
  async getById(id: string): Promise<POSProfile | null> {
    const p = store.profiles.find(x => x.id === id);
    return p ? this.mapToDomain(p) : null;
  }
  async create(profile: POSProfile): Promise<POSProfile> {
    store.profiles.push(this.mapToStore(profile));
    return profile;
  }
  async update(id: string, profile: Partial<POSProfile>): Promise<POSProfile> {
    const idx = store.profiles.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("POS Profile not found");
    store.profiles[idx] = { ...store.profiles[idx], ...profile } as any;
    return this.mapToDomain(store.profiles[idx]);
  }

  private mapToDomain(p: any): POSProfile {
    return {
      id: p.id,
      name: p.name,
      cashier: p.cashier,
      warehouse: p.warehouse,
      branch: p.branch || "HQ Store",
      isLocked: p.isLocked !== undefined ? p.isLocked : false,
      isArchived: p.isArchived !== undefined ? p.isArchived : false
    };
  }

  private mapToStore(p: POSProfile): any {
    return {
      id: p.id,
      name: p.name,
      cashier: p.cashier,
      warehouse: p.warehouse,
      branch: p.branch,
      isLocked: p.isLocked,
      isArchived: p.isArchived
    };
  }
}

export class MemoryPurchaseRepository implements IPurchaseRepository {
  async getAllSuppliers(): Promise<any[]> {
    return store.suppliers;
  }
  async getSupplierById(id: string): Promise<any | null> {
    return store.suppliers.find(s => s.id === id) || null;
  }
  async createSupplier(supplier: any): Promise<any> {
    store.suppliers.push(supplier);
    return supplier;
  }
  async updateSupplier(id: string, supplier: Partial<any>): Promise<any> {
    const idx = store.suppliers.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Supplier not found");
    store.suppliers[idx] = { ...store.suppliers[idx], ...supplier };
    return store.suppliers[idx];
  }
  async deleteSupplier(id: string): Promise<boolean> {
    const idx = store.suppliers.findIndex(s => s.id === id);
    if (idx === -1) return false;
    store.suppliers.splice(idx, 1);
    return true;
  }

  async getAllOrders(): Promise<any[]> {
    return store.purchaseOrders;
  }
  async getOrderById(id: string): Promise<any | null> {
    return store.purchaseOrders.find(o => o.id === id) || null;
  }
  async createOrder(order: any): Promise<any> {
    store.purchaseOrders.push(order);
    return order;
  }
  async updateOrder(id: string, order: Partial<any>): Promise<any> {
    const idx = store.purchaseOrders.findIndex(o => o.id === id);
    if (idx === -1) throw new Error("Purchase Order not found");
    store.purchaseOrders[idx] = { ...store.purchaseOrders[idx], ...order };
    return store.purchaseOrders[idx];
  }

  async getAllReceipts(): Promise<any[]> {
    return store.goodsReceipts;
  }
  async getReceiptById(id: string): Promise<any | null> {
    return store.goodsReceipts.find(r => r.id === id) || null;
  }
  async createReceipt(receipt: any): Promise<any> {
    store.goodsReceipts.push(receipt);
    return receipt;
  }
  async updateReceipt(id: string, receipt: Partial<any>): Promise<any> {
    const idx = store.goodsReceipts.findIndex(r => r.id === id);
    if (idx === -1) throw new Error("Goods receipt not found");
    store.goodsReceipts[idx] = { ...store.goodsReceipts[idx], ...receipt };
    return store.goodsReceipts[idx];
  }
}

export class MemoryStateRepository implements IStateRepository {
  async getCollection(name: string): Promise<any[]> {
    return (store as any)[name] || [];
  }
  async saveCollection(name: string, data: any[]): Promise<void> {
    const target = (store as any)[name];
    if (Array.isArray(target)) {
      target.length = 0;
      target.push(...data);
    } else {
      throw new Error(`Cannot reassign non-array collection: ${name}`);
    }
    store.saveDb();
  }
  async saveDb(): Promise<void> {
    store.saveDb();
  }
}


