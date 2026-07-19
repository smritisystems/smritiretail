/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

interface HsnGstMapping {
  hsnPrefix: string;
  rate: number;
  description: string;
}

// Master Indian HSN to GST percentage lookup table
export const HSN_GST_MASTER: HsnGstMapping[] = [
  { hsnPrefix: "09", rate: 5.0, description: "Spices, Coffee, Tea" },
  { hsnPrefix: "10", rate: 5.0, description: "Cereals, Grains" },
  { hsnPrefix: "11", rate: 5.0, description: "Milling Products, Flour" },
  { hsnPrefix: "19", rate: 5.0, description: "Preparations of Cereals" },
  { hsnPrefix: "61", rate: 12.0, description: "Articles of Apparel (Knitted)" },
  { hsnPrefix: "62", rate: 12.0, description: "Articles of Apparel (Not Knitted)" },
  { hsnPrefix: "63", rate: 12.0, description: "Made up Textile Articles" },
  { hsnPrefix: "84", rate: 18.0, description: "Machinery and Mechanical Appliances" },
  { hsnPrefix: "85", rate: 18.0, description: "Electrical Machinery, Electronics" },
  { hsnPrefix: "87", rate: 28.0, description: "Motor Vehicles, Luxury Spares" },
  { hsnPrefix: "99", rate: 18.0, description: "Services (GST on Services)" }
];

/**
 * Resolves the applicable GST percentage rate for a given HSN code.
 * Searches from longest match to shortest match based on prefix.
 * Falls back to 18.0% (Standard Indian GST rate) if no prefix matches.
 */
export function getGstRateByHsn(hsn: string | null | undefined): number {
  if (!hsn) return 18.0;

  const cleanedHsn = hsn.trim().replace(/[^0-9]/g, "");
  if (!cleanedHsn) return 18.0;

  // Match prefix
  for (const mapping of HSN_GST_MASTER) {
    if (cleanedHsn.startsWith(mapping.hsnPrefix)) {
      return mapping.rate;
    }
  }

  // Standard fallback rate
  return 18.0;
}
