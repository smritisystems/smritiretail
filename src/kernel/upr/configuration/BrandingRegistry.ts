/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Branding Registry (UCR-001)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UCR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface BrandingDefinition {
  appTitle: string;            // Platform UI title
  logoUrl: string;             // Corporate logo asset URL
  faviconUrl?: string;
  themeMode: "light" | "dark" | "system";
  primaryColor: string;        // Primary brand accent HEX color
  accentColor: string;
  companyName: string;
  copyrightText: string;
}

export class BrandingRegistryService {
  private branding: Readonly<BrandingDefinition>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.branding = Object.freeze({
      appTitle: "SMRITI Retail OS",
      logoUrl: "/assets/smriti-logo.svg",
      themeMode: "system",
      primaryColor: "#0a6ed1",
      accentColor: "#38bdf8",
      companyName: "SMRITI Systems Private Limited",
      copyrightText: "© SMRITIBooks.com. All Rights Reserved."
    });
  }

  public getBranding(): Readonly<BrandingDefinition> {
    return this.branding;
  }

  public updateBranding(overrides: Partial<BrandingDefinition>): void {
    this.branding = Object.freeze({ ...this.branding, ...overrides });
    this.emitChange();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const BrandingRegistry = new BrandingRegistryService();
