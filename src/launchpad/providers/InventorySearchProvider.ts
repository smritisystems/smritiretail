/**
 * Project      : SMRITI Retail OS
 * Module       : Inventory Search Provider (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { LaunchpadSearchProvider, SearchResultItem } from "../types/launchpadTypes.ts";
import { SearchProviderRegistry } from "../registry/SearchProviderRegistry.ts";

export const InventorySearchProvider: LaunchpadSearchProvider = {
  id: "search-provider-inventory",
  name: "Product & Barcode Search",
  search: async (query: string): Promise<SearchResultItem[]> => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const mockItems = [
      { sku: "SKU-1001", name: "Premium Basmati Rice 5kg", barcode: "8901234567890", price: "₹450.00" },
      { sku: "SKU-1002", name: "Refined Sunflower Oil 1L", barcode: "8901234567891", price: "₹140.00" },
      { sku: "SKU-1003", name: "Whole Wheat Atta 10kg", barcode: "8901234567892", price: "₹380.00" }
    ];

    return mockItems
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.barcode.includes(q)
      )
      .map((item) => ({
        id: `inv-${item.sku}`,
        title: item.name,
        subtitle: `SKU: ${item.sku} | Barcode: ${item.barcode} | MRP: ${item.price}`,
        category: "Product Master",
        targetTab: "item-master",
        iconName: "Package"
      }));
  }
};

SearchProviderRegistry.register(InventorySearchProvider);
