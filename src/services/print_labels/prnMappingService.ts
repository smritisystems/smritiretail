/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (9-Tier Automatic PRN Rule Mapping Resolver)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import { UniversalLabelItem } from "../universalLabelPrinterService.ts";

export type PRNRulePriorityTier = 
  | "Item" 
  | "Barcode" 
  | "Variant" 
  | "Style" 
  | "Brand" 
  | "Category" 
  | "Department" 
  | "Company" 
  | "Default";

export interface PRNMappingRule {
  id: string;
  tier: PRNRulePriorityTier;
  matchPattern: string; // SKU code, Barcode, Brand name, etc.
  templateName: string;
  templateScript: string;
  protocol: "ZPL" | "TSPL" | "EPL" | "CPCL" | "PRN" | "PDF";
  description: string;
  isActive: boolean;
}

export const DEFAULT_PRN_MAPPING_RULES: PRNMappingRule[] = [
  { id: "rule-01", tier: "Item", matchPattern: "000006", templateName: "Garment_Luxury_Hangtag.prn", templateScript: "^XA... luxury hangtag ...^XZ", protocol: "ZPL", description: "Direct Item SKU Rule", isActive: true },
  { id: "rule-02", tier: "Brand", matchPattern: "Beanstalk", templateName: "Garment_Beanstalk_Standard.prn", templateScript: "^XA... beanstalk tag ...^XZ", protocol: "ZPL", description: "Brand Specific Rule", isActive: true },
  { id: "rule-03", tier: "Category", matchPattern: "Shirt", templateName: "Apparel_Shirt_2Track.prn", templateScript: "SIZE 50 mm, 35 mm... TSPL", protocol: "TSPL", description: "Category Rule", isActive: true },
  { id: "rule-04", tier: "Department", matchPattern: "Apparel", templateName: "Apparel_Generic_Tag.prn", templateScript: "SIZE 50 mm, 35 mm...", protocol: "TSPL", description: "Department Rule", isActive: true },
  { id: "rule-05", tier: "Default", matchPattern: "*", templateName: "Standard_Retail_Tag.prn", templateScript: "^XA^FO50,50...^XZ", protocol: "ZPL", description: "Fallback Default System Rule", isActive: true },
];

const LOCAL_STORAGE_RULES_KEY = "smriti_prn_mapping_rules_v1";

export const getStoredPRNMappingRules = (): PRNMappingRule[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RULES_KEY);
    if (!raw) return DEFAULT_PRN_MAPPING_RULES;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_PRN_MAPPING_RULES;
  }
};

export const savePRNMappingRules = (rules: PRNMappingRule[]): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(rules));
  } catch (err) {
    console.error("Failed to save PRN mapping rules:", err);
  }
};

/**
 * 9-Tier Priority Rule Hierarchy Resolver:
 * Item -> Barcode -> Variant -> Style -> Brand -> Category -> Department -> Company -> Default
 * First matching rule wins.
 */
export const resolvePRNMappingForRule = (item: UniversalLabelItem, rulesOverride?: PRNMappingRule[]): { rule: PRNMappingRule; matchedTier: PRNRulePriorityTier } => {
  const rules = rulesOverride || getStoredPRNMappingRules();
  const activeRules = rules.filter(r => r.isActive);

  // 1. Tier: Item SKU / Stock No
  const itemMatch = activeRules.find(r => r.tier === "Item" && (r.matchPattern === item.stock_no || r.matchPattern === item.item_code));
  if (itemMatch) return { rule: itemMatch, matchedTier: "Item" };

  // 2. Tier: Barcode
  const barcodeMatch = activeRules.find(r => r.tier === "Barcode" && r.matchPattern === item.barcode);
  if (barcodeMatch) return { rule: barcodeMatch, matchedTier: "Barcode" };

  // 3. Tier: Variant (Shade/Color + Size)
  const variantPattern = `${item.shade || item.color || ""}-${item.size || ""}`;
  const variantMatch = activeRules.find(r => r.tier === "Variant" && (r.matchPattern === variantPattern || r.matchPattern === item.size));
  if (variantMatch) return { rule: variantMatch, matchedTier: "Variant" };

  // 4. Tier: Style
  if (item.style) {
    const styleMatch = activeRules.find(r => r.tier === "Style" && r.matchPattern.toLowerCase() === item.style?.toLowerCase());
    if (styleMatch) return { rule: styleMatch, matchedTier: "Style" };
  }

  // 5. Tier: Brand
  if (item.brand) {
    const brandMatch = activeRules.find(r => r.tier === "Brand" && r.matchPattern.toLowerCase() === item.brand?.toLowerCase());
    if (brandMatch) return { rule: brandMatch, matchedTier: "Brand" };
  }

  // 6. Tier: Category / Product
  const categoryStr = item.category || item.product || "";
  if (categoryStr) {
    const catMatch = activeRules.find(r => r.tier === "Category" && r.matchPattern.toLowerCase() === categoryStr.toLowerCase());
    if (catMatch) return { rule: catMatch, matchedTier: "Category" };
  }

  // 7. Tier: Department
  const deptStr = (item as any).department || "";
  if (deptStr) {
    const deptMatch = activeRules.find(r => r.tier === "Department" && r.matchPattern.toLowerCase() === deptStr.toLowerCase());
    if (deptMatch) return { rule: deptMatch, matchedTier: "Department" };
  }

  // 8. Tier: Company
  const compMatch = activeRules.find(r => r.tier === "Company");
  if (compMatch) return { rule: compMatch, matchedTier: "Company" };

  // 9. Tier: Default Fallback
  const defaultRule = activeRules.find(r => r.tier === "Default") || DEFAULT_PRN_MAPPING_RULES[DEFAULT_PRN_MAPPING_RULES.length - 1];
  return { rule: defaultRule, matchedTier: "Default" };
};
