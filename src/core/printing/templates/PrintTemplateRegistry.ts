/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : PrintTemplateEngine & PrintTemplateRegistry (Rendering Layer)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Status       : FROZEN — APPROVED
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

const DEFAULT_ZPL_SCRIPT = "^XA^FO50,50^ADN,36,20^FD{ITEM_NAME}^FS^FO50,100^BY2^BCN,60,Y,N,N^FD{BARCODE}^FS^FO50,180^ADN,24,15^FDMRP: Rs. {MRP}^FS^XZ";

export interface PrintTemplateDefinition {
  id: string;
  name: string;
  category: "BARCODE_TAG" | "JEWELLERY_TAG" | "PHARMA_LABEL" | "RECEIPT" | "INVOICE";
  driverId: "zpl" | "tspl" | "epl" | "esc_pos" | "raw";
  widthMm: number;
  heightMm: number;
  script: string;
  isDefault?: boolean;
  industryPack?: string;
}

export class PrintTemplateRegistry {
  private static templates: Map<string, PrintTemplateDefinition> = new Map([
    [
      "tattly_threads_dual_tag",
      {
        id: "tattly_threads_dual_tag",
        name: "Tattly Threads Dual Sticky Barcode Tag (100 x 50.7 mm)",
        category: "BARCODE_TAG",
        driverId: "zpl",
        widthMm: 100,
        heightMm: 50.7,
        script: DEFAULT_ZPL_SCRIPT,
        isDefault: true,
        industryPack: "Apparel & Garments",
      },
    ],
    [
      "jewellery_gold_tag",
      {
        id: "jewellery_gold_tag",
        name: "Jewellery Dumbbell Purity Tag (50 x 15 mm)",
        category: "JEWELLERY_TAG",
        driverId: "zpl",
        widthMm: 50,
        heightMm: 15,
        script: `^XA^FO10,10^A0N,25,25^FD{itemName}^FS^FO10,40^A0N,20,20^FDPurity: {purity}^FS^FO10,65^BY1^BCN,30,N,N^FD{barcode}^FS^XZ`,
        industryPack: "Jewellery & Gold",
      },
    ],
    [
      "pharma_batch_label",
      {
        id: "pharma_batch_label",
        name: "Pharma Medicine Batch & Expiry Tag (50 x 25 mm)",
        category: "PHARMA_LABEL",
        driverId: "tspl",
        widthMm: 50,
        heightMm: 25,
        script: `SIZE 50 mm, 25 mm\nGAP 2 mm, 0\nCLS\nTEXT 10,10,"2",0,1,1,"{itemName}"\nTEXT 10,35,"1",0,1,1,"Batch: {batchNo} Exp: {expDate}"\nBARCODE 10,60,"128",30,1,0,2,2,"{barcode}"\nPRINT 1,1`,
        industryPack: "Pharmacy & Healthcare",
      },
    ],
  ]);

  /**
   * Returns all registered PRN/ZPL templates
   */
  static getTemplates(): PrintTemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  /**
   * Gets a specific template by ID
   */
  static getTemplate(templateId: string): PrintTemplateDefinition {
    return this.templates.get(templateId) || this.templates.get("tattly_threads_dual_tag")!;
  }

  /**
   * Registers or updates a PRN file/script template dynamically
   */
  static registerTemplate(template: PrintTemplateDefinition): void {
    this.templates.set(template.id, template);
  }
}
