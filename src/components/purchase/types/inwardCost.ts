/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "INWARD_COST_TYPES")
 */

export interface InwardCostTypeOption {
  id: string;
  code: string;
  name: string;
  category: string;
  is_capitalizable: boolean;
  default_allocation_method: "VALUE" | "QUANTITY" | "WEIGHT";
  requires_document: boolean;
  requires_transporter: boolean;
  is_active: boolean;
}

export interface InwardCostItem {
  id: string;
  component_type: string;
  description: string;
  amount: number;
  taxable_amount: number;
  tax_amount: number;
  tax_rate: number;
  total_amount: number;
  itc_eligible: boolean;
  is_capitalizable: boolean;
  allocation_method: "VALUE" | "QUANTITY" | "WEIGHT";
  transporter_name?: string;
  document_type?: string;
  document_no?: string;
  document_date?: string;
  vehicle_no?: string;
  status: "DRAFT" | "READY" | "ALLOCATED";
}

export interface AllocationPreviewLine {
  grn_item_id?: string;
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  rate: number;
  purchase_value: number;
  share_percent: number;
  allocated_amount: number;
  allocated_per_unit: number;
  net_landed_cost_per_unit: number;
}

export interface AllocationPreviewResult {
  component_type: string;
  allocation_method: string;
  total_component_amount: number;
  reconciled_total: number;
  is_balanced: boolean;
  variance: number;
  lines: AllocationPreviewLine[];
}

export interface WhyThisCostData {
  sku: string;
  product_name: string;
  po_rate: number;
  invoice_rate: number;
  trade_discount_per_unit: number;
  net_purchase_rate: number;
  quantity: number;
  total_addon_per_unit: number;
  final_landed_cost: number;
  mrp?: number;
  margin_percent?: number;
  components: {
    component_type: string;
    component_name: string;
    allocated_amount: number;
    allocated_per_unit: number;
    allocation_method: string;
    document_no?: string;
    transporter_name?: string;
  }[];
}

export interface GrnPostedSummary {
  grn_no: string;
  receipt_id: string;
  supplier_name: string;
  total_units: number;
  purchase_cost: number;
  additional_landed_costs: number;
  total_inventory_cost: number;
  cost_components_count: number;
}
