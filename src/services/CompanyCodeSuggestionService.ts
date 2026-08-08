/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : Company Code Suggestion & Resolver Service (SWP-001 / OLE Compliant)
 * Standard     : CITY(3) + PIN_LAST3(3) + SEQUENCE(3) Generation & Validation Engine (v1.2)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.0.0
 */

export interface CodeSuggestionResult {
  prefix: string;
  sequenceStr: string;
  suggestedCode: string | null;
  isExhausted: boolean;
  cityCode: string;
  pinLast3: string;
}

const CITY_CODE_MAP: Record<string, string> = {
  MUMBAI: "MUM",
  PUNE: "PUN",
  DELHI: "DEL",
  "NEW DELHI": "DEL",
  BENGALURU: "BLR",
  BANGALORE: "BLR",
  HYDERABAD: "HYD",
  CHENNAI: "CHE",
  MADRAS: "CHE",
  KOLKATA: "KOL",
  CALCUTTA: "KOL",
  AHMEDABAD: "AMD",
  JAIPUR: "JAI",
  NAGPUR: "NAG",
  NASHIK: "NSK",
  SURAT: "SUR",
};

export class CompanyCodeSuggestionService {
  /**
   * Resolves a 3-character uppercase City Code from input string.
   */
  public static resolveCityCode(cityInput: string): string {
    if (!cityInput) return "XXX";
    const cleaned = cityInput.trim().toUpperCase();
    if (CITY_CODE_MAP[cleaned]) {
      return CITY_CODE_MAP[cleaned];
    }
    // Fallback: extract first 3 alphanumeric characters
    const alphaOnly = cleaned.replace(/[^A-Z0-9]/g, "");
    if (alphaOnly.length >= 3) {
      return alphaOnly.substring(0, 3);
    }
    return (alphaOnly + "XXX").substring(0, 3);
  }

  /**
   * Extracts and validates the last 3 digits of a 6-digit Indian PIN code.
   */
  public static extractPinLast3(pinInput: string): string | null {
    if (!pinInput) return null;
    const cleaned = pinInput.trim().replace(/\D/g, "");
    if (cleaned.length !== 6) return null;
    return cleaned.substring(3);
  }

  /**
   * Generates the 6-character prefix: CITY(3) + PIN_LAST3(3).
   */
  public static generatePrefix(cityInput: string, pinInput: string): string | null {
    const cityCode = this.resolveCityCode(cityInput);
    const pinLast3 = this.extractPinLast3(pinInput);
    if (!pinLast3) return null;
    return `${cityCode}${pinLast3}`;
  }

  /**
   * Formats a 3-digit sequence integer (1 -> "001", 999 -> "999").
   * Returns null if sequence > 999 (sequence exhaustion).
   */
  public static formatSequence(sequenceNum: number): string | null {
    if (sequenceNum < 1 || sequenceNum > 999) return null;
    return sequenceNum.toString().padStart(3, "0");
  }

  /**
   * Generates full 9-character code suggestion: CITY(3) + PIN_LAST3(3) + SEQUENCE(3).
   * Example: Mumbai + 400067 -> MUM067001
   */
  public static buildSuggestion(
    cityInput: string,
    pinInput: string,
    nextSeqNum: number = 1
  ): CodeSuggestionResult | null {
    const cityCode = this.resolveCityCode(cityInput);
    const pinLast3 = this.extractPinLast3(pinInput);
    if (!pinLast3) return null;

    const prefix = `${cityCode}${pinLast3}`;
    const seqStr = this.formatSequence(nextSeqNum);

    if (!seqStr) {
      return {
        prefix,
        sequenceStr: "",
        suggestedCode: null,
        isExhausted: true,
        cityCode,
        pinLast3,
      };
    }

    return {
      prefix,
      sequenceStr: seqStr,
      suggestedCode: `${prefix}${seqStr}`,
      isExhausted: false,
      cityCode,
      pinLast3,
    };
  }

  /**
   * Canonical validation for Company / Tenant Codes.
   * Generated format: 9 characters (MUM067001).
   * User-defined custom format: 3 to 20 uppercase alphanumeric characters (e.g. ABC000123).
   */
  public static validateCompanyCode(code: string): { valid: boolean; message?: string } {
    if (!code || !code.trim()) {
      return { valid: false, message: "Company Code is required." };
    }
    const trimmed = code.trim().toUpperCase();
    if (/\s/.test(trimmed)) {
      return { valid: false, message: "Company Code must not contain spaces." };
    }
    if (!/^[A-Z0-9]{3,20}$/.test(trimmed)) {
      return {
        valid: false,
        message: "Company Code must be 3 to 20 uppercase alphanumeric characters (no special characters).",
      };
    }
    return { valid: true };
  }
}
