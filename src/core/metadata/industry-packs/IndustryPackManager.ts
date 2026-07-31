/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Metadata Platform (SMP-M)
 * Component    : IndustryPackManager (Zero Code Industry Pack Switcher)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { AttributeDefinition } from "../attributes/AttributeDefinition.js";
import { APPAREL_INDUSTRY_PACK } from "./ApparelPack.js";
import { JEWELLERY_INDUSTRY_PACK } from "./JewelleryPack.js";
import { MEDICAL_INDUSTRY_PACK } from "./MedicalPack.js";
import { ELECTRONICS_INDUSTRY_PACK } from "./ElectronicsPack.js";

export type IndustryType = "apparel" | "jewellery" | "medical" | "electronics" | "fmcg" | "general";

export class IndustryPackManager {
  private static activeIndustry: IndustryType = "apparel";
  private static customOverrides: Map<string, AttributeDefinition[]> = new Map();

  static setIndustry(industry: IndustryType): void {
    this.activeIndustry = industry;
  }

  static getActiveIndustry(): IndustryType {
    return this.activeIndustry;
  }

  static getActivePack(): AttributeDefinition[] {
    if (this.customOverrides.has(this.activeIndustry)) {
      return this.customOverrides.get(this.activeIndustry)!;
    }

    switch (this.activeIndustry) {
      case "apparel":
        return APPAREL_INDUSTRY_PACK;
      case "jewellery":
        return JEWELLERY_INDUSTRY_PACK;
      case "medical":
        return MEDICAL_INDUSTRY_PACK;
      case "electronics":
        return ELECTRONICS_INDUSTRY_PACK;
      case "fmcg":
      case "general":
      default:
        return APPAREL_INDUSTRY_PACK;
    }
  }

  static setCustomPack(industry: IndustryType, pack: AttributeDefinition[]): void {
    this.customOverrides.set(industry, pack);
  }
}
