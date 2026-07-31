/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Metadata Platform (SMP-M)
 * Component    : MedicalPack (Pharma, Pharmacy & Healthcare Pack)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { AttributeDefinition } from "../attributes/AttributeDefinition.js";

export const MEDICAL_INDUSTRY_PACK: AttributeDefinition[] = [
  {
    attributeCode: "genericName",
    internalName: "GenericName",
    displayLabel: "Generic Molecule Name",
    description: "Active Pharmaceutical Ingredient (API) / Molecule",
    businessDomain: "global",
    dataType: "text",
    controlType: "textbox",
    behavior: {
      visible: true,
      editable: true,
      mandatory: true,
      printable: true,
      searchable: true,
      filterable: true,
      sortable: true,
      barcodeVisible: true,
      mobileVisible: true,
      aiVisible: true,
    },
    sequence: 1,
    category: "Pharma",
    version: 1,
    published: true,
  },
  {
    attributeCode: "schedule",
    internalName: "Schedule",
    displayLabel: "Schedule Category",
    description: "Drug Control Schedule (Schedule H, H1, X, OTC)",
    businessDomain: "global",
    dataType: "dropdown",
    controlType: "dropdown",
    options: [
      { label: "OTC (Over The Counter)", value: "OTC" },
      { label: "Schedule H (Prescription Drug)", value: "Schedule H" },
      { label: "Schedule H1 (Controlled Drug)", value: "Schedule H1" },
      { label: "Schedule X (Narcotics)", value: "Schedule X" },
    ],
    behavior: {
      visible: true,
      editable: true,
      mandatory: true,
      printable: true,
      searchable: true,
      filterable: true,
      sortable: true,
      barcodeVisible: true,
      mobileVisible: true,
      aiVisible: true,
    },
    sequence: 2,
    category: "Pharma",
    version: 1,
    published: true,
  },
  {
    attributeCode: "batchNo",
    internalName: "BatchNo",
    displayLabel: "Batch Number",
    description: "Manufacturing Lot / Batch ID",
    businessDomain: "global",
    dataType: "text",
    controlType: "textbox",
    behavior: {
      visible: true,
      editable: true,
      mandatory: true,
      printable: true,
      searchable: true,
      filterable: true,
      sortable: true,
      barcodeVisible: true,
      mobileVisible: true,
      aiVisible: true,
    },
    sequence: 3,
    category: "Tracking",
    version: 1,
    published: true,
  },
  {
    attributeCode: "expiryDate",
    internalName: "ExpiryDate",
    displayLabel: "Expiry Date (MM/YY)",
    description: "Drug Expiration Date",
    businessDomain: "global",
    dataType: "date",
    controlType: "datepicker",
    behavior: {
      visible: true,
      editable: true,
      mandatory: true,
      printable: true,
      searchable: true,
      filterable: true,
      sortable: true,
      barcodeVisible: true,
      mobileVisible: true,
      aiVisible: true,
    },
    sequence: 4,
    category: "Tracking",
    version: 1,
    published: true,
  },
];
