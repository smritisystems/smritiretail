/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : CustomerService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 — Internal Domain Engine
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { Customer } from "../../types.js";
import { ICustomerService } from "../public/ICustomerService.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { getCustomers, addCustomer } from "../../services/customerStore.js";
import { SPK } from "../SPK.js";
import logger from "../../core/logging/logger.js";

export class CustomerService implements ICustomerService {
  private localCache: Customer[] = [];

  constructor() {
    // SCS-WSC-002: Flush company-sensitive cache on workspace switch.
    SPK.events.on("Workspace.Changed.v1", () => {
      this.localCache = [];
    });
  }

  public async getAll(): Promise<Customer[]> {
    try {
      const data = await apiFetchV1("/customers/");
      if (Array.isArray(data)) {
        this.localCache = data.map((c: any) => this.normalizeBackendCustomer(c));
        return this.localCache;
      }
    } catch (e) {
      logger.warn("[CustomerService] Backend API unreachable. Loading from customerStore.", e as unknown);
    }

    // Fallback to customerStore (backend-derived performance cache only)
    const storeCustomers = getCustomers();
    if (storeCustomers && storeCustomers.length > 0) {
      this.localCache = storeCustomers;
    }
    return this.localCache;
  }

  public async getById(id: string): Promise<Customer | null> {
    const customers = await this.getAll();
    return customers.find((c) => c.id === id) || null;
  }

  public async getByMobile(mobile: string): Promise<Customer | null> {
    const customers = await this.getAll();
    const clean = mobile.trim();
    return customers.find((c) => c.mobile === clean) || null;
  }

  public async search(query: string, group?: string, limit = 50): Promise<Customer[]> {
    const customers = await this.getAll();
    const q = query.trim().toLowerCase();

    return customers
      .filter((c) => {
        const matchesGroup = !group || group === "ALL" || c.customerGroupId === group;
        if (!matchesGroup) return false;

        if (!q) return true;
        const matchName = c.name.toLowerCase().includes(q);
        const matchMobile = c.mobile.includes(q);
        const matchGst = c.gstNumber ? c.gstNumber.toLowerCase().includes(q) : false;
        const matchEmail = c.email ? c.email.toLowerCase().includes(q) : false;

        return matchName || matchMobile || matchGst || matchEmail;
      })
      .slice(0, limit);
  }

  public async save(customerData: Partial<Customer>): Promise<Customer> {
    const isNew = !customerData.id || customerData.id.startsWith("cust_temp_");
    const id = customerData.id || `cust_${Date.now()}`;

    const cust: Customer = {
      id,
      name: customerData.name || "Walk-in Retail Customer",
      mobile: customerData.mobile || "9876543210",
      email: customerData.email || `${(customerData.name || "customer").toLowerCase().replace(/\s+/g, "")}@example.com`,
      customerGroupId: customerData.customerGroupId || "CG-Regular",
      gstNumber: customerData.gstNumber,
      status: customerData.status || "Active",
      address: customerData.address || "",
      city: customerData.city || "Mumbai",
      state: customerData.state || "Maharashtra",
      pincode: customerData.pincode || "400001",
      creditLimit: customerData.creditLimit ?? 0,
      outstanding: customerData.outstanding ?? 0,
      loyaltyPoints: customerData.loyaltyPoints ?? 0,
      createdAt: customerData.createdAt || customerData.createdDate || new Date().toISOString(),
      createdDate: customerData.createdDate || customerData.createdAt || new Date().toISOString().slice(0, 10)
    };

    try {
      const endpoint = isNew ? "/customers/" : `/customers/${id}`;
      const method = isNew ? "POST" : "PUT";
      const savedResponse = await apiFetchV1(endpoint, {
        method,
        body: JSON.stringify(cust)
      });

      const normalized = this.normalizeBackendCustomer(savedResponse || cust);
      this.upsertLocalCache(normalized);
      addCustomer(normalized);

      SPK.events.emit(isNew ? "CustomerCreated" : "CustomerUpdated", normalized.id, normalized);
      return normalized;
    } catch (err) {
      // SCS-INV-001: Never silently return a local/fake customer ID.
      // A locally-generated ID (cust_${Date.now()}) has no DB row and will
      // be rejected by the invoice orchestrator's customer-tenant validation.
      // Surface the error so the Quick Add modal can display it to the user.
      logger.error("[CustomerService] Backend customer save failed — not caching locally to prevent fake ID propagation.", err as unknown);
      throw err;
    }
  }

  public async delete(id: string): Promise<boolean> {
    try {
      await apiFetchV1(`/customers/${id}`, { method: "DELETE" });
    } catch (e) {
      logger.warn("[CustomerService] Offline delete warning.", e as unknown);
    }
    this.localCache = this.localCache.filter((c) => c.id !== id);
    SPK.events.emit("CustomerDeleted", id, { id });
    return true;
  }

  private upsertLocalCache(customer: Customer): void {
    const idx = this.localCache.findIndex((c) => c.id === customer.id);
    if (idx >= 0) {
      this.localCache[idx] = customer;
    } else {
      this.localCache.unshift(customer);
    }
  }

  private normalizeBackendCustomer(c: any): Customer {
    return {
      id: c.id,
      name: c.name || "Customer",
      mobile: c.mobile || c.phone || "",
      email: c.email || "",
      customerGroupId: c.customer_group_id || c.customerGroupId || "CG-Regular",
      gstNumber: c.gst_number || c.gstNumber || c.gstin,
      status: c.status || "Active",
      address: c.address || "",
      city: c.city || "",
      state: c.state || "",
      pincode: c.pincode || "",
      creditLimit: c.credit_limit !== undefined ? parseFloat(c.credit_limit) : (c.creditLimit || 0),
      outstanding: c.outstanding !== undefined ? parseFloat(c.outstanding) : (c.outstanding || 0),
      loyaltyPoints: c.loyalty_points !== undefined ? c.loyalty_points : (c.loyaltyPoints || 0),
      createdAt: c.created_at || c.createdAt || new Date().toISOString(),
      createdDate: c.created_date || c.createdDate || c.created_at || new Date().toISOString().slice(0, 10)
    };
  }
}
