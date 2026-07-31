/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : ISupplierService Public Interface Contract
 * Standard     : SMAP Constitution v1.0 — Public Contract (Level 2)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface SupplierRecord {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  mobile: string;
  email?: string;
  gstNumber?: string;
  pan?: string;
  city?: string;
  state?: string;
  paymentTerms?: string;
  creditDays?: number;
  outstanding?: number;
  status: "Active" | "Inactive" | "Blocked" | string;
  createdDate?: string;
}

export interface ISupplierService {
  /**
   * Resolve a supplier by surrogate ID / UUID
   */
  getById(id: string): Promise<SupplierRecord | null>;

  /**
   * Resolve a supplier by vendor code or mobile
   */
  getByCode(code: string): Promise<SupplierRecord | null>;

  /**
   * Search suppliers by name, code, mobile, GSTIN, or city
   */
  search(query: string, limit?: number): Promise<SupplierRecord[]>;

  /**
   * Create or update a supplier record through UVE validation and Command Bus
   */
  save(supplier: Partial<SupplierRecord>): Promise<SupplierRecord>;

  /**
   * Soft-delete a supplier record
   */
  delete(id: string): Promise<boolean>;

  /**
   * Fetch all active suppliers from SSOT
   */
  getAll(): Promise<SupplierRecord[]>;
}
