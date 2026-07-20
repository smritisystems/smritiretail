/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.1.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { useState, useEffect } from "react";
import { WorkspaceMode, WORKSPACE_MODE_CONFIGS } from "./adaptive_workspace_store.ts";

export type IndustryPackType = 
  | "GENERAL_RETAIL"
  | "FOOTWEAR"
  | "APPAREL"
  | "MEDICAL"
  | "ELECTRONICS"
  | "RESTAURANT"
  | "JEWELLERY"
  | "WHOLESALE";

export interface ExperiencePolicy {
  policyId: string;
  name: string;
  recommendedPrimaryButtons: number;
  configuredPrimaryButtonOverride?: number;
  maxFieldsPerBillingRow: number;
  configuredMaxFieldsOverride?: number;
  maxCheckoutClicksTarget: number;
  allowUserOverrides: boolean;
}

export interface IndustryPackConfig {
  id: IndustryPackType;
  name: string;
  description: string;
  defaultMode: WorkspaceMode;
  customFields: string[];
  recommendedPolicy: ExperiencePolicy;
}

export const INDUSTRY_PACKS: Record<IndustryPackType, IndustryPackConfig> = {
  GENERAL_RETAIL: {
    id: "GENERAL_RETAIL",
    name: "General Retail & Supermarket",
    description: "High-speed barcode scanning & quick checkout flow.",
    defaultMode: "SIMPLE",
    customFields: ["barcode", "batch", "expiry"],
    recommendedPolicy: {
      policyId: "pol_general",
      name: "General Retail Standard Policy",
      recommendedPrimaryButtons: 7,
      maxFieldsPerBillingRow: 6,
      maxCheckoutClicksTarget: 4,
      allowUserOverrides: true,
    },
  },
  FOOTWEAR: {
    id: "FOOTWEAR",
    name: "Footwear & Shoes",
    description: "Size-Color-Style matrix grid layout with size breakdown.",
    defaultMode: "HYBRID",
    customFields: ["size", "color", "style_code", "brand"],
    recommendedPolicy: {
      policyId: "pol_footwear",
      name: "Footwear Matrix Policy",
      recommendedPrimaryButtons: 7,
      configuredPrimaryButtonOverride: 9, // Admin override to 9 buttons
      maxFieldsPerBillingRow: 8,
      maxCheckoutClicksTarget: 4,
      allowUserOverrides: true,
    },
  },
  APPAREL: {
    id: "APPAREL",
    name: "Apparel & Garments",
    description: "Variant matrix, fitting size, season, and material composition.",
    defaultMode: "HYBRID",
    customFields: ["size", "color", "fit", "season", "hsn_code"],
    recommendedPolicy: {
      policyId: "pol_apparel",
      name: "Apparel Fashion Policy",
      recommendedPrimaryButtons: 7,
      configuredPrimaryButtonOverride: 8,
      maxFieldsPerBillingRow: 8,
      maxCheckoutClicksTarget: 4,
      allowUserOverrides: true,
    },
  },
  MEDICAL: {
    id: "MEDICAL",
    name: "Medical & Pharmacy",
    description: "Batch number, expiry alert, salt composition, and doctor prescription.",
    defaultMode: "HYBRID",
    customFields: ["batch_no", "expiry_date", "salt_composition", "schedule_h"],
    recommendedPolicy: {
      policyId: "pol_medical",
      name: "Pharmacy Compliance Policy",
      recommendedPrimaryButtons: 7,
      maxFieldsPerBillingRow: 8,
      maxCheckoutClicksTarget: 4,
      allowUserOverrides: true,
    },
  },
  ELECTRONICS: {
    id: "ELECTRONICS",
    name: "Electronics & Appliances",
    description: "IMEI, serial tracking, warranty card generation, and serial audit.",
    defaultMode: "HYBRID",
    customFields: ["imei_no", "serial_no", "warranty_months", "model_no"],
    recommendedPolicy: {
      policyId: "pol_electronics",
      name: "Electronics Serial Policy",
      recommendedPrimaryButtons: 7,
      maxFieldsPerBillingRow: 7,
      maxCheckoutClicksTarget: 4,
      allowUserOverrides: true,
    },
  },
  RESTAURANT: {
    id: "RESTAURANT",
    name: "Restaurant & QSR",
    description: "Table booking, KOT printing, modifier selection, and room service.",
    defaultMode: "SIMPLE",
    customFields: ["table_no", "waiter_name", "kot_notes"],
    recommendedPolicy: {
      policyId: "pol_restaurant",
      name: "QSR Touch Policy",
      recommendedPrimaryButtons: 4,
      maxFieldsPerBillingRow: 4,
      maxCheckoutClicksTarget: 3,
      allowUserOverrides: true,
    },
  },
  JEWELLERY: {
    id: "JEWELLERY",
    name: "Jewellery & Precious Metals",
    description: "Gold purity, gross weight, net weight, making charges, and stone value.",
    defaultMode: "HYBRID",
    customFields: ["purity_karat", "gross_wt_gms", "net_wt_gms", "making_charge_per_gm"],
    recommendedPolicy: {
      policyId: "pol_jewellery",
      name: "Jewellery Valuation Policy",
      recommendedPrimaryButtons: 7,
      configuredPrimaryButtonOverride: 10,
      maxFieldsPerBillingRow: 10,
      maxCheckoutClicksTarget: 5,
      allowUserOverrides: true,
    },
  },
  WHOLESALE: {
    id: "WHOLESALE",
    name: "Wholesale & B2B Distribution",
    description: "Bulk carton quantity, credit terms, transport Bilty, and GST E-Way Bill.",
    defaultMode: "ADVANCED",
    customFields: ["carton_qty", "credit_days", "transporter_name", "eway_bill_no"],
    recommendedPolicy: {
      policyId: "pol_wholesale",
      name: "B2B Distribution Policy",
      recommendedPrimaryButtons: 12,
      configuredPrimaryButtonOverride: 12,
      maxFieldsPerBillingRow: 12,
      maxCheckoutClicksTarget: 5,
      allowUserOverrides: true,
    },
  },
};

const SAEF_STORAGE_KEY = "smriti_saef_pack";

class SAEFExperienceStore {
  private activePack: IndustryPackType = "GENERAL_RETAIL";
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(SAEF_STORAGE_KEY) as IndustryPackType;
      if (saved && INDUSTRY_PACKS[saved]) {
        this.activePack = saved;
      }
    }
  }

  public getActivePack(): IndustryPackConfig {
    return INDUSTRY_PACKS[this.activePack];
  }

  public setActivePack(packId: IndustryPackType) {
    if (INDUSTRY_PACKS[packId]) {
      this.activePack = packId;
      if (typeof window !== "undefined") {
        localStorage.setItem(SAEF_STORAGE_KEY, packId);
      }
      this.notify();
    }
  }

  public getEffectiveMaxButtons(mode: WorkspaceMode): number {
    const packConfig = this.getActivePack();
    const policy = packConfig.recommendedPolicy;
    
    // Priority: Admin configured override -> Policy recommended -> Mode default
    if (policy.configuredPrimaryButtonOverride) {
      return policy.configuredPrimaryButtonOverride;
    }
    return WORKSPACE_MODE_CONFIGS[mode]?.maxPrimaryButtons || 7;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const saefExperienceStore = new SAEFExperienceStore();

export function useSAEFExperience() {
  const [pack, setPackState] = useState<IndustryPackConfig>(saefExperienceStore.getActivePack());

  useEffect(() => {
    const unsubscribe = saefExperienceStore.subscribe(() => {
      setPackState(saefExperienceStore.getActivePack());
    });
    return unsubscribe;
  }, []);

  return {
    pack,
    setActivePack: (packId: IndustryPackType) => saefExperienceStore.setActivePack(packId),
    getEffectiveMaxButtons: (mode: WorkspaceMode) => saefExperienceStore.getEffectiveMaxButtons(mode),
  };
}
