/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : PrintVariableDictionary (Variable Mapping Contract — Rule SUPP-011)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Status       : FROZEN — APPROVED
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export interface VariableContract {
  name: string;
  description: string;
  source: string; // e.g. "Item.barcode", "SMP-M Attribute"
  dataType: "String" | "Number" | "Date" | "Currency";
  exampleValue: string;
  modules: string[];
}

export class PrintVariableDictionary {
  private static variables: Map<string, VariableContract> = new Map([
    [
      "barcode",
      {
        name: "barcode",
        description: "Primary product EAN-13 or Code-128 barcode number",
        source: "Item.barcode",
        dataType: "String",
        exampleValue: "8901234567890",
        modules: ["BARCODE", "POS", "INVENTORY"],
      },
    ],
    [
      "mrp",
      {
        name: "mrp",
        description: "Maximum Retail Price (Incl. of all taxes)",
        source: "Item.mrp",
        dataType: "Currency",
        exampleValue: "1299.00",
        modules: ["BARCODE", "SALES", "POS"],
      },
    ],
    [
      "pkd_date",
      {
        name: "pkd_date",
        description: "Manufacturing / Packaging Date (MM/YYYY)",
        source: "Item.pkd_date",
        dataType: "Date",
        exampleValue: "05/2025",
        modules: ["BARCODE", "INVENTORY"],
      },
    ],
    [
      "style",
      {
        name: "style",
        description: "Article Number / Style Code",
        source: "Item.style",
        dataType: "String",
        exampleValue: "ART-890",
        modules: ["BARCODE"],
      },
    ],
    [
      "color",
      {
        name: "color",
        description: "Garment / Item Color",
        source: "Item.color",
        dataType: "String",
        exampleValue: "Navy Blue",
        modules: ["BARCODE"],
      },
    ],
    [
      "size",
      {
        name: "size",
        description: "Size Code (UK/US/EUR)",
        source: "Item.size",
        dataType: "String",
        exampleValue: "8",
        modules: ["BARCODE"],
      },
    ],
  ]);

  static getVariables(): VariableContract[] {
    return Array.from(this.variables.values());
  }

  static getVariable(name: string): VariableContract | undefined {
    return this.variables.get(name);
  }
}
