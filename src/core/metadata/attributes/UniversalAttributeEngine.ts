/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Metadata Platform (SMP-M)
 * Component    : UniversalAttributeEngine (UAME Core Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { AttributeDefinition } from "./AttributeDefinition.js";
import { IndustryPackManager, IndustryType } from "../industry-packs/IndustryPackManager.js";
import { globalMetadataCache } from "../caching/MetadataCache.js";

export class UniversalAttributeEngine {
  private static dynamicDefinitions: Map<string, AttributeDefinition> = new Map();
  private static labelOverrides: Map<string, string> = new Map();

  /**
   * Initializes or refreshes attribute definitions from active Industry Pack
   */
  static getAttributes(industry?: IndustryType): AttributeDefinition[] {
    const currentIndustry = industry || IndustryPackManager.getActiveIndustry();
    const cacheKey = `attrs_${currentIndustry}`;
    const cached = globalMetadataCache.get(cacheKey);
    if (cached) return cached;

    const basePack = IndustryPackManager.getActivePack();
    const result = basePack.map((def) => {
      const overrideLabel = this.labelOverrides.get(def.attributeCode);
      const dynamicDef = this.dynamicDefinitions.get(def.attributeCode);
      const merged = { ...def, ...(dynamicDef || {}) };
      if (overrideLabel) {
        merged.displayLabel = overrideLabel;
      }
      return merged;
    });

    globalMetadataCache.set(cacheKey, result);
    return result;
  }

  /**
   * Gets filterable attributes for dynamic Range Filters
   */
  static getFilterableAttributes(industry?: IndustryType): AttributeDefinition[] {
    return this.getAttributes(industry).filter((attr) => attr.behavior.filterable && attr.behavior.visible);
  }

  /**
   * Gets printable attributes for ZPL / PRN label resolution
   */
  static getPrintableAttributes(industry?: IndustryType): AttributeDefinition[] {
    return this.getAttributes(industry).filter((attr) => attr.behavior.printable && attr.behavior.visible);
  }

  /**
   * Renames a display label with ZERO code changes (UA-005)
   */
  static setCustomDisplayLabel(attributeCode: string, newLabel: string): void {
    this.labelOverrides.set(attributeCode, newLabel);
    globalMetadataCache.clear();
  }

  /**
   * Registers a custom user attribute at runtime (UA-006)
   */
  static registerCustomAttribute(definition: AttributeDefinition): void {
    this.dynamicDefinitions.set(definition.attributeCode, definition);
    globalMetadataCache.clear();
  }

  /**
   * Resolves attribute values from an item dictionary
   */
  static resolveValues(item: any, industry?: IndustryType): Record<string, string> {
    const attributes = this.getAttributes(industry);
    const resolved: Record<string, string> = {};

    for (const attr of attributes) {
      const code = attr.attributeCode;
      let val = item[code] || item[attr.internalName] || (item.attributes && item.attributes[code]);
      if (val === undefined || val === null) {
        val = attr.defaultValue || "-";
      }
      resolved[code] = String(val);
      resolved[attr.displayLabel] = String(val);
    }

    return resolved;
  }
}
