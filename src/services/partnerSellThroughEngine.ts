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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { PSVParty, PSVPartySkuTracking } from "../types";

/**
 * Computes the quantity currently lying with a partner for a single SKU.
 * Formula: lying-with-partner = invoicedQty - confirmedSoldQty - returnedQty
 */
export function computeSkuLyingWithPartner(sku: PSVPartySkuTracking): number {
  const lying = sku.invoicedQty - sku.confirmedSoldQty - sku.returnedQty;
  return Math.max(0, lying);
}

/**
 * Computes the sell-through percentage for a single SKU.
 * Formula: sell-through % = (confirmedSoldQty / invoicedQty) * 100
 */
export function computeSkuSellThrough(sku: PSVPartySkuTracking): number {
  if (sku.invoicedQty <= 0) {
    return 0;
  }
  const pct = (sku.confirmedSoldQty / sku.invoicedQty) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Computes the overall lying-with-partner stock across all SKUs tracked for a PSVParty.
 */
export function computeTotalLyingWithPartner(party: PSVParty): number {
  if (!party.skuTracking || party.skuTracking.length === 0) {
    return party.stockCount || 0; // fallback to aggregate stock count if no per-SKU data
  }
  return party.skuTracking.reduce((sum, sku) => sum + computeSkuLyingWithPartner(sku), 0);
}

/**
 * Computes the overall sell-through percentage across all SKUs tracked for a PSVParty.
 */
export function computeOverallSellThrough(party: PSVParty): number {
  if (!party.skuTracking || party.skuTracking.length === 0) {
    return party.sellThrough || 0; // fallback to aggregate sell-through if no per-SKU data
  }

  let totalInvoiced = 0;
  let totalSold = 0;

  for (const sku of party.skuTracking) {
    totalInvoiced += sku.invoicedQty;
    totalSold += sku.confirmedSoldQty;
  }

  if (totalInvoiced <= 0) {
    return 0;
  }

  const pct = (totalSold / totalInvoiced) * 100;
  return Math.min(100, Math.max(0, pct));
}
