/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.43
 * Created      : 2026-10-09
 * Modified     : 2026-10-09
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal Test Suite
 */

import { describe, it, expect } from "vitest";
import {
  toCanonicalPaymentMode,
  CANONICAL_PAYMENT_MODES,
  CanonicalPaymentMode,
} from "../components/billing/types.ts";
import {
  LAUNCHPAD_CATALOG,
  getVisibleLaunchpadTiles,
  getQuickActionTiles,
  mapModuleToGroup,
  synthesizeLaunchpadCatalogWithRemoteMenus,
  TileData,
} from "../components/launchpad/launchpadCatalog.ts";

describe("Phase 5: Payment Mode Harmonization & Normalization", () => {
  it("normalizes standard legacy display strings to canonical uppercase codes", () => {
    expect(toCanonicalPaymentMode("Cash")).toBe("CASH");
    expect(toCanonicalPaymentMode("Credit Card")).toBe("CARD");
    expect(toCanonicalPaymentMode("Debit Card")).toBe("CARD");
    expect(toCanonicalPaymentMode("UPI")).toBe("UPI");
    expect(toCanonicalPaymentMode("Cheque")).toBe("CHEQUE");
    expect(toCanonicalPaymentMode("Credit Note")).toBe("CREDIT_NOTE");
    expect(toCanonicalPaymentMode("Split")).toBe("SPLIT");
    expect(toCanonicalPaymentMode("Credit")).toBe("CREDIT");
    expect(toCanonicalPaymentMode("On Account")).toBe("ON_ACCOUNT");
  });

  it("handles alternative financial aliases and banking transfers", () => {
    expect(toCanonicalPaymentMode("CHECK")).toBe("CHEQUE");
    expect(toCanonicalPaymentMode("bank-transfer")).toBe("BANK_TRANSFER");
    expect(toCanonicalPaymentMode("NEFT")).toBe("BANK_TRANSFER");
    expect(toCanonicalPaymentMode("RTGS")).toBe("BANK_TRANSFER");
    expect(toCanonicalPaymentMode("IMPS")).toBe("BANK_TRANSFER");
    expect(toCanonicalPaymentMode("WIRE")).toBe("BANK_TRANSFER");
    expect(toCanonicalPaymentMode("CN")).toBe("CREDIT_NOTE");
    expect(toCanonicalPaymentMode("DUE")).toBe("CREDIT");
    expect(toCanonicalPaymentMode("ACCOUNT")).toBe("ON_ACCOUNT");
    expect(toCanonicalPaymentMode("Store Credit")).toBe("STORE_CREDIT");
    expect(toCanonicalPaymentMode("Loyalty Points")).toBe("LOYALTY");
    expect(toCanonicalPaymentMode("Reward Points")).toBe("LOYALTY");
    expect(toCanonicalPaymentMode("Gift Card")).toBe("GIFT_VOUCHER");
    expect(toCanonicalPaymentMode("Voucher")).toBe("GIFT_VOUCHER");
  });

  it("gracefully falls back to CASH for null, undefined, or empty inputs", () => {
    expect(toCanonicalPaymentMode(null)).toBe("CASH");
    expect(toCanonicalPaymentMode(undefined)).toBe("CASH");
    expect(toCanonicalPaymentMode("")).toBe("CASH");
    expect(toCanonicalPaymentMode("   ")).toBe("CASH");
  });

  it("preserves authoritative canonical tokens without distortion", () => {
    CANONICAL_PAYMENT_MODES.forEach((mode: CanonicalPaymentMode) => {
      expect(toCanonicalPaymentMode(mode)).toBe(mode);
    });
  });
});

describe("Phase 5: Fiori Launchpad Dynamic Control Plane Harmonization", () => {
  it("falls back to local static catalog when remote menus are empty or missing", () => {
    const fallbackEmpty = synthesizeLaunchpadCatalogWithRemoteMenus([], LAUNCHPAD_CATALOG);
    expect(fallbackEmpty.length).toBe(LAUNCHPAD_CATALOG.length);

    const fallbackNull = synthesizeLaunchpadCatalogWithRemoteMenus(null as any, LAUNCHPAD_CATALOG);
    expect(fallbackNull.length).toBe(LAUNCHPAD_CATALOG.length);
  });

  it("updates existing catalog tiles when remote menus supply overrides", () => {
    const remoteMenus = [
      {
        id: "billing-workspace",
        title: "Enterprise Fast-Track Billing",
        icon: "flash_on",
        badge: "V6-ENHANCED",
        module: "Retail Operations",
      },
    ];

    const synthesized = synthesizeLaunchpadCatalogWithRemoteMenus(remoteMenus, LAUNCHPAD_CATALOG);
    const billingTile = synthesized.find((t) => t.id === "billing-workspace");

    expect(billingTile).toBeDefined();
    expect(billingTile?.title).toBe("Enterprise Fast-Track Billing");
    expect(billingTile?.icon).toBe("flash_on");
    expect(billingTile?.tag).toBe("V6-ENHANCED");
    // Retains local shortcut and quick action status
    expect(billingTile?.shortcut).toBe("F1");
    expect(billingTile?.isQuickAction).toBe(true);
  });

  it("synthesizes and appends novel remote control plane modules", () => {
    const remoteMenus = [
      {
        id: "menu-compliance-portal",
        title: "NIC E-Way Bill Auto-Recon",
        route: "/compliance/nic-auto-recon",
        icon: "fact_check",
        badge: "STATUTORY",
        module: "Tax & Compliance",
      },
    ];

    const synthesized = synthesizeLaunchpadCatalogWithRemoteMenus(remoteMenus, LAUNCHPAD_CATALOG);
    const novelTile = synthesized.find((t) => t.id === "compliance/nic-auto-recon");

    expect(novelTile).toBeDefined();
    expect(novelTile?.title).toBe("NIC E-Way Bill Auto-Recon");
    expect(novelTile?.group).toBe("Finance & Compliance");
    expect(novelTile?.tag).toBe("STATUTORY");
  });

  it("maps modules to standard group names accurately", () => {
    expect(mapModuleToGroup("retail-pos")).toBe("Retail Operations");
    expect(mapModuleToGroup("inventory_management")).toBe("Master Data & Stock");
    expect(mapModuleToGroup("tax_compliance")).toBe("Finance & Compliance");
    expect(mapModuleToGroup("bi_analytics")).toBe("Analytics & Reporting");
    expect(mapModuleToGroup("unknown_custom")).toBe("Administration & Control");
  });

  it("preserves deny-by-default role filtering on synthesized catalogs", () => {
    const remoteMenus = [
      {
        id: "novel-admin-tool",
        title: "Admin Deep Console",
        route: "/admin/console",
        icon: "terminal",
        module: "Security",
      },
    ];

    const synthesized = synthesizeLaunchpadCatalogWithRemoteMenus(remoteMenus, LAUNCHPAD_CATALOG);
    const cashierTiles = getVisibleLaunchpadTiles("CASHIER", synthesized);
    const sysadminTiles = getVisibleLaunchpadTiles("SYSADMIN", synthesized);

    // Sysadmin sees all tiles including synthesized ones
    expect(sysadminTiles.some((t) => t.id === "admin/console")).toBe(true);
    // Cashier sees quick action billing terminal
    expect(cashierTiles.some((t) => t.id === "billing-workspace")).toBe(true);
  });
});
