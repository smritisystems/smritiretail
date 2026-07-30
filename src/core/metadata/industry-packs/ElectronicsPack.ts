/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Metadata Platform (SMP-M)
 * Component    : ElectronicsPack (Electronics, Appliances & Hardware Pack)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { AttributeDefinition } from "../attributes/AttributeDefinition.js";

export const ELECTRONICS_INDUSTRY_PACK: AttributeDefinition[] = [
  {
    attributeCode: "modelNo",
    internalName: "ModelNo",
    displayLabel: "Model Number",
    description: "Manufacturer Product Model Number",
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
    category: "Specifications",
    version: 1,
    published: true,
  },
  {
    attributeCode: "voltage",
    internalName: "Voltage",
    displayLabel: "Operating Voltage / Phase",
    description: "Electrical Voltage Rating (e.g., 220V Single Phase)",
    businessDomain: "global",
    dataType: "text",
    controlType: "textbox",
    behavior: {
      visible: true,
      editable: true,
      mandatory: false,
      printable: true,
      searchable: true,
      filterable: true,
      sortable: true,
      barcodeVisible: true,
      mobileVisible: true,
      aiVisible: true,
    },
    sequence: 2,
    category: "Electrical",
    version: 1,
    published: true,
  },
  {
    attributeCode: "warranty",
    internalName: "Warranty",
    displayLabel: "Warranty Period",
    description: "Manufacturer Warranty (e.g. 1 Year Onsite)",
    businessDomain: "global",
    dataType: "text",
    controlType: "dropdown",
    options: [
      { label: "No Warranty", value: "None" },
      { label: "6 Months", value: "6 Months" },
      { label: "1 Year Standard", value: "1 Year" },
      { label: "2 Years Extended", value: "2 Years" },
      { label: "5 Years Comprehensive", value: "5 Years" },
    ],
    behavior: {
      visible: true,
      editable: true,
      mandatory: false,
      printable: true,
      searchable: true,
      filterable: true,
      sortable: true,
      barcodeVisible: true,
      mobileVisible: true,
      aiVisible: true,
    },
    sequence: 3,
    category: "Service",
    version: 1,
    published: true,
  },
];
