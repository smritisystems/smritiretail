/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Regional Registry (UCR-002)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UCR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface RegionalConfig {
  defaultLocale: string;       // Default locale string (e.g. "en-IN")
  defaultCurrency: string;     // ISO currency code (e.g. "INR")
  currencySymbol: string;      // Currency symbol (e.g. "₹")
  defaultTimezone: string;     // Timezone string (e.g. "Asia/Kolkata")
  dateFormat: string;          // Date format pattern (e.g. "DD/MM/YYYY")
  timeFormat: "12h" | "24h";
  numberSystem: "indian" | "international"; // Indian numbering (Lakhs/Crores) vs International (Millions/Billions)
}

export class RegionalRegistryService {
  private config: Readonly<RegionalConfig>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.config = Object.freeze({
      defaultLocale: "en-IN",
      defaultCurrency: "INR",
      currencySymbol: "₹",
      defaultTimezone: "Asia/Kolkata",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "12h",
      numberSystem: "indian"
    });
  }

  public getConfig(): Readonly<RegionalConfig> {
    return this.config;
  }

  public updateConfig(overrides: Partial<RegionalConfig>): void {
    this.config = Object.freeze({ ...this.config, ...overrides });
    this.emitChange();
  }

  public formatCurrency(amount: number): string {
    if (this.config.numberSystem === "indian") {
      const formatted = new Intl.NumberFormat(this.config.defaultLocale, {
        style: "currency",
        currency: this.config.defaultCurrency,
        maximumFractionDigits: 2
      }).format(amount);
      return formatted;
    }
    return `${this.config.currencySymbol}${amount.toFixed(2)}`;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const RegionalRegistry = new RegionalRegistryService();
