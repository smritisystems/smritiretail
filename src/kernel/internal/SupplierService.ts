/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SupplierService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 — Internal Domain Engine
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import logger from "../../core/logging/logger.js";
import { ISupplierService, SupplierRecord } from "../public/ISupplierService.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { SPK } from "../SPK.js";

export class SupplierService implements ISupplierService {
  private localCache: SupplierRecord[] = [];

  public async getAll(): Promise<SupplierRecord[]> {
    try {
      const data = await apiFetchV1("/suppliers/");
      if (Array.isArray(data)) {
        this.localCache = data.map((s: any) => this.normalizeBackendSupplier(s));
        return this.localCache;
      }
    } catch (e) {
      logger.error("[SupplierService] API unreachable.", e as unknown);
      throw e;
    }
    return this.localCache;
  }

  public async getById(id: string): Promise<SupplierRecord | null> {
    const list = await this.getAll();
    return list.find((s) => s.id === id || s.code === id) || null;
  }

  public async getByCode(code: string): Promise<SupplierRecord | null> {
    const list = await this.getAll();
    const clean = code.trim().toLowerCase();
    return list.find((s) => s.code.toLowerCase() === clean) || null;
  }

  public async search(query: string, limit = 50): Promise<SupplierRecord[]> {
    const list = await this.getAll();
    const q = query.trim().toLowerCase();

    return list
      .filter((s) => {
        if (!q) return true;
        const matchName = s.name.toLowerCase().includes(q);
        const matchCode = s.code.toLowerCase().includes(q);
        const matchMobile = s.mobile.includes(q);
        const matchGst = s.gstNumber ? s.gstNumber.toLowerCase().includes(q) : false;

        return matchName || matchCode || matchMobile || matchGst;
      })
      .slice(0, limit);
  }

  public async save(supplierData: Partial<SupplierRecord>): Promise<SupplierRecord> {
    const isNew = !supplierData.id || supplierData.id.startsWith("sup_temp_");
    const id = supplierData.id || `sup_${Date.now()}`;

    const record: SupplierRecord = {
      id,
      code: supplierData.code || `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
      name: supplierData.name || "Unnamed Supplier",
      contactPerson: supplierData.contactPerson || "",
      mobile: supplierData.mobile || "9800000000",
      email: supplierData.email || "",
      gstNumber: supplierData.gstNumber,
      pan: supplierData.pan,
      city: supplierData.city || "Mumbai",
      state: supplierData.state || "Maharashtra",
      paymentTerms: supplierData.paymentTerms || "Net 30 Days",
      creditDays: supplierData.creditDays ?? 30,
      outstanding: supplierData.outstanding ?? 0,
      status: supplierData.status || "Active",
      createdDate: supplierData.createdDate || new Date().toISOString().slice(0, 10)
    };

    try {
      const endpoint = isNew ? "/suppliers/" : `/suppliers/${id}`;
      const method = isNew ? "POST" : "PUT";
      const savedResponse = await apiFetchV1(endpoint, {
        method,
        body: JSON.stringify(record)
      });

      const normalized = this.normalizeBackendSupplier(savedResponse || record);
      this.upsertLocalCache(normalized);
      SPK.events.emit(isNew ? "SupplierCreated" : "SupplierUpdated", normalized.id, normalized);
      return normalized;
    } catch (err) {
      logger.error("[SupplierService] Backend save failed:", err as unknown);
      throw err;
    }
  }

  public async delete(id: string): Promise<boolean> {
    try {
      await apiFetchV1(`/suppliers/${id}`, { method: "DELETE" });
    } catch (e) {
      logger.error("[SupplierService] Backend delete failed:", e as unknown);
      throw e;
    }
    this.localCache = this.localCache.filter((s) => s.id !== id);
    SPK.events.emit("SupplierDeleted", id, { id });
    return true;
  }

  private upsertLocalCache(supplier: SupplierRecord): void {
    const idx = this.localCache.findIndex((s) => s.id === supplier.id);
    if (idx >= 0) {
      this.localCache[idx] = supplier;
    } else {
      this.localCache.unshift(supplier);
    }
  }

  private normalizeBackendSupplier(s: any): SupplierRecord {
    return {
      id: s.id,
      code: s.code || s.supplier_code || `SUP-${s.id}`,
      name: s.name || s.company_name || "Supplier",
      contactPerson: s.contact_person || s.contactPerson || "",
      mobile: s.mobile || s.phone || "",
      email: s.email || "",
      gstNumber: s.gst_number || s.gstNumber || s.gstin,
      pan: s.pan,
      city: s.city || "",
      state: s.state || "",
      paymentTerms: s.payment_terms || s.paymentTerms || "Net 30 Days",
      creditDays: s.credit_days !== undefined ? parseInt(s.credit_days, 10) : (s.creditDays || 30),
      outstanding: s.outstanding !== undefined ? parseFloat(s.outstanding) : 0,
      status: s.status || "Active",
      createdDate: s.created_date || s.createdDate || s.created_at || new Date().toISOString().slice(0, 10)
    };
  }
}
