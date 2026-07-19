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
 * * Version    : 3.15.0
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-13
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { Product, Customer, CustomerGroup, POSProfile, Shift, SalesInvoice, AuditLog, SyncQueueItem } from "../domain/entities.js";
import { User } from "../../types.js";

export interface IProductRepository {
  getAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(id: string, product: Partial<Product>): Promise<Product>;
  delete(id: string): Promise<boolean>;
  addBarcode(id: string, value: string): Promise<Product>;
  deleteBarcode(id: string, value: string): Promise<Product>;
}

export interface ICustomerRepository {
  getAll(): Promise<Customer[]>;
  getById(id: string): Promise<Customer | null>;
  getAllGroups(): Promise<CustomerGroup[]>;
  updateOutstanding(id: string, amount: number): Promise<Customer>;
  create(customer: Customer): Promise<Customer>;
  update(id: string, customer: Partial<Customer>): Promise<Customer>;
  createGroup(group: CustomerGroup): Promise<CustomerGroup>;
  updateGroup(id: string, group: Partial<CustomerGroup>): Promise<CustomerGroup>;
}

export interface IShiftRepository {
  getAll(): Promise<Shift[]>;
  getById(id: string): Promise<Shift | null>;
  getOpenShift(id: string): Promise<Shift | null>;
  create(shift: Shift): Promise<Shift>;
  updateStats(id: string, salesCount: number, salesValue: number): Promise<Shift>;
  close(id: string, closingCash: number): Promise<Shift>;
}

export interface ISalesInvoiceRepository {
  getAll(): Promise<SalesInvoice[]>;
  getById(id: string): Promise<SalesInvoice | null>;
  create(invoice: SalesInvoice): Promise<SalesInvoice>;
  update(id: string, invoice: Partial<SalesInvoice>): Promise<SalesInvoice>;
}

export interface IAuditRepository {
  getAll(): Promise<AuditLog[]>;
  log(audit: Omit<AuditLog, "id">): Promise<void>;
}

export interface ISyncRepository {
  getQueue(): Promise<SyncQueueItem[]>;
  enqueue(item: Omit<SyncQueueItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">): Promise<SyncQueueItem>;
  updateStatus(id: number, status: "pending" | "synced" | "failed", lastAttempt?: string, errorMsg?: string): Promise<void>;
  incrementRetry(id: number): Promise<void>;
}

export interface IUserRepository {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  getByUsername(username: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  delete(id: string): Promise<boolean>;
}

export interface IPOSProfileRepository {
  getAll(): Promise<POSProfile[]>;
  getById(id: string): Promise<POSProfile | null>;
  create(profile: POSProfile): Promise<POSProfile>;
  update(id: string, profile: Partial<POSProfile>): Promise<POSProfile>;
}

export interface IPurchaseRepository {
  getAllSuppliers(): Promise<any[]>;
  getSupplierById(id: string): Promise<any | null>;
  createSupplier(supplier: any): Promise<any>;
  updateSupplier(id: string, supplier: Partial<any>): Promise<any>;
  deleteSupplier(id: string): Promise<boolean>;

  getAllOrders(): Promise<any[]>;
  getOrderById(id: string): Promise<any | null>;
  createOrder(order: any): Promise<any>;
  updateOrder(id: string, order: Partial<any>): Promise<any>;

  getAllReceipts(): Promise<any[]>;
  getReceiptById(id: string): Promise<any | null>;
  createReceipt(receipt: any): Promise<any>;
  updateReceipt(id: string, receipt: Partial<any>): Promise<any>;
}

export interface IStateRepository {
  getCollection(name: string): Promise<any[]>;
  saveCollection(name: string, data: any[]): Promise<void>;
  saveDb(): Promise<void>;
}


