/**
 * Project      : SMRITI Retail OS
 * Module       : Sales Search Provider (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { LaunchpadSearchProvider, SearchResultItem } from "../types/launchpadTypes.ts";
import { SearchProviderRegistry } from "../registry/SearchProviderRegistry.ts";

export const SalesSearchProvider: LaunchpadSearchProvider = {
  id: "search-provider-sales",
  name: "Sales & Invoices Search",
  search: async (query: string): Promise<SearchResultItem[]> => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const mockInvoices = [
      { id: "INV-2026-001", customer: "Apex Retailers", total: "₹4,500" },
      { id: "INV-2026-002", customer: "Walk-in Cashier", total: "₹1,250" },
      { id: "QT-2026-088", customer: "Metro Distributors", total: "₹12,400" }
    ];

    return mockInvoices
      .filter((inv) => inv.id.toLowerCase().includes(q) || inv.customer.toLowerCase().includes(q))
      .map((inv) => ({
        id: `sales-${inv.id}`,
        title: `${inv.id} - ${inv.customer}`,
        subtitle: `Total Bill: ${inv.total}`,
        category: "Sales Invoices",
        targetTab: "sales",
        iconName: "Receipt"
      }));
  }
};

SearchProviderRegistry.register(SalesSearchProvider);
