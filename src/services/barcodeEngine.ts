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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

export interface BarcodeRecord {
  id: string;
  value: string;
  type: string;
  mode: "Auto" | "Imported" | "GS1 Professional";
  entity: string;
  status: "Active" | "Inactive";
  date: string;
}

export const BarcodeEngine = {
  calculateEAN13CheckDigit: (code12: string): number => {
    if (code12.length !== 12) return -1;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code12[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
  },

  generateInternalEAN13: (prefix: string, nextId: number): string => {
    const base = prefix + nextId.toString().padStart(12 - prefix.length, '0');
    const checkDigit = BarcodeEngine.calculateEAN13CheckDigit(base);
    return base + checkDigit;
  },

  validateEAN13: (barcode: string): boolean => {
    if (!/^\d{13}$/.test(barcode)) return false;
    const base = barcode.substring(0, 12);
    const checkDigit = parseInt(barcode[12]);
    return BarcodeEngine.calculateEAN13CheckDigit(base) === checkDigit;
  },

  validateUPCA: (barcode: string): boolean => {
    if (!/^\d{12}$/.test(barcode)) return false;
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const remainder = sum % 10;
    const checkDigit = remainder === 0 ? 0 : 10 - remainder;
    return checkDigit === parseInt(barcode[11]);
  },

  validateEAN8: (barcode: string): boolean => {
    if (!/^\d{8}$/.test(barcode)) return false;
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const remainder = sum % 10;
    const checkDigit = remainder === 0 ? 0 : 10 - remainder;
    return checkDigit === parseInt(barcode[7]);
  },

  validateCode128: (barcode: string): boolean => {
    return /^[\x20-\x7F]+$/.test(barcode);
  },

  generateGS1_128: (companyPrefix: string, itemRef: string, batch?: string, expiry?: string): string => {
    let barcode = "";
    const gtinBase = companyPrefix + itemRef.padStart(13 - companyPrefix.length, '0');
    let sum = 0;
    for(let i=0; i<13; i++) {
        const digit = parseInt(gtinBase[i]);
        sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const rem = sum % 10;
    const cd = rem === 0 ? 0 : 10 - rem;
    const gtin = gtinBase + cd;
    barcode += `(01)${gtin}`;

    if (batch) barcode += `(10)${batch}`;
    if (expiry) barcode += `(17)${expiry}`;
    return barcode;
  },

  generateGS1_DigitalLink: (domain: string, companyPrefix: string, itemRef: string, batch?: string, expiry?: string): string => {
    const gtinBase = companyPrefix + itemRef.padStart(13 - companyPrefix.length, '0');
    let sum = 0;
    for(let i=0; i<13; i++) {
        const digit = parseInt(gtinBase[i]);
        sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const rem = sum % 10;
    const cd = rem === 0 ? 0 : 10 - rem;
    const gtin = gtinBase + cd;

    let link = `https://${domain}/01/${gtin}`;
    if (batch) link += `?10=${batch}`;
    if (expiry) link += `${batch ? '&' : '?'}17=${expiry}`;
    return link;
  }
};
