/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : ICustomerService Public Interface Contract
 * Standard     : SMAP Constitution v1.0 — Public Contract (Level 2)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { Customer } from "../../types.js";

export interface ICustomerService {
  /**
   * Resolve a customer by primary ID / UUID
   */
  getById(id: string): Promise<Customer | null>;

  /**
   * Resolve a customer by primary mobile number
   */
  getByMobile(mobile: string): Promise<Customer | null>;

  /**
   * Search customers by name, mobile, GSTIN, or customer group
   */
  search(query: string, group?: string, limit?: number): Promise<Customer[]>;

  /**
   * Create or update a customer record through UVE validation and Command Bus
   */
  save(customer: Partial<Customer>): Promise<Customer>;

  /**
   * Soft-delete a customer record
   */
  delete(id: string): Promise<boolean>;

  /**
   * Fetch all active customers from SSOT
   */
  getAll(): Promise<Customer[]>;
}
