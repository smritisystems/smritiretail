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
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

export interface MasterConfig {
  id: string;
  name: string;
  category: string;
  icon: string;
  fields: MasterField[];
  status?: "planned" | "live";
  isLookup?: boolean;
}

export interface MasterField {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "date" | "textarea";
  required?: boolean;
  options?: string[]; // For select type
}

// Enterprise Global Audit & Governance Fields (implicitly added to all masters)
export const GLOBAL_AUDIT_FIELDS: MasterField[] = [
  {
    name: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Inactive", "Draft", "Approved"],
    required: true,
  },
  { name: "created_by", label: "Created By", type: "text" },
  { name: "modified_by", label: "Modified By", type: "text" },
  { name: "created_at", label: "Created At", type: "date" },
  { name: "updated_at", label: "Updated At", type: "date" },
  { name: "notes", label: "Notes", type: "textarea" },
];

export const MASTER_REGISTRY: MasterConfig[] = [
  // Organization (Multi-Company, Multi-Branch, Multi-Store)
  {
    id: "company",
    name: "Company",
    category: "Organization",
    icon: "business",
    status: "live",
    fields: [
      { name: "code", label: "Company Code", type: "text", required: true },
      { name: "name", label: "Company Name", type: "text", required: true },
      { name: "abbr", label: "Abbreviation", type: "text" },
      { name: "tax_id", label: "Tax ID / GSTIN", type: "text", required: true },
      {
        name: "currency",
        label: "Base Currency",
        type: "select",
        options: ["INR", "USD", "EUR", "GBP"],
        required: true,
      },
      {
        name: "address",
        label: "Registered Address",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "branch",
    name: "Branch",
    category: "Organization",
    icon: "account_tree",
    status: "live",
    fields: [
      { name: "code", label: "Branch Code", type: "text", required: true },
      { name: "name", label: "Branch Name", type: "text", required: true },
      {
        name: "company",
        label: "Company",
        type: "select",
        options: [],
        required: true,
      },
      { name: "address", label: "Branch Address", type: "textarea" },
    ],
  },
  {
    id: "store",
    name: "Store",
    category: "Organization",
    icon: "store",
    status: "live",
    fields: [
      { name: "code", label: "Store Code", type: "text", required: true },
      { name: "name", label: "Store Name", type: "text", required: true },
      {
        name: "branch",
        label: "Branch",
        type: "select",
        options: [],
        required: true,
      },
      {
        name: "store_type",
        label: "Store Type",
        type: "select",
        options: ["Company Owned", "Franchise", "Kiosk"],
      },
      { name: "address", label: "Store Address", type: "textarea" },
    ],
  },
  {
    id: "warehouse",
    name: "Warehouse",
    category: "Organization",
    icon: "warehouse",
    status: "live",
    fields: [
      { name: "code", label: "Warehouse Code", type: "text", required: true },
      { name: "name", label: "Warehouse Name", type: "text", required: true },
      {
        name: "branch",
        label: "Linked Branch",
        type: "select",
        options: [],
      },
      { name: "is_transit", label: "Is Transit Warehouse", type: "checkbox" },
      { name: "address", label: "Warehouse Address", type: "textarea" },
    ],
  },
];
