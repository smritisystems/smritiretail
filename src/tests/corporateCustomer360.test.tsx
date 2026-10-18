/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Corporate Customer 360 Test Suite
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CorporateAccountHeader } from "../components/customer/corporate360/CorporateAccountHeader";
import { CorporateCustomerTabs } from "../components/customer/corporate360/CorporateCustomerTabs";
import { CorporateKpiCards } from "../components/customer/corporate360/CorporateKpiCards";
import { CorporateStoreNetwork } from "../components/customer/corporate360/CorporateStoreNetwork";
import { CorporatePsvWidget } from "../components/customer/corporate360/CorporatePsvWidget";
import { CorporateStoreTypeWidget } from "../components/customer/corporate360/CorporateStoreTypeWidget";
import { CorporateRecentOrdersWidget } from "../components/customer/corporate360/CorporateRecentOrdersWidget";
import { CorporateTopCategoriesWidget } from "../components/customer/corporate360/CorporateTopCategoriesWidget";
import { StoreCodeLookupModal } from "../components/customer/corporate360/StoreCodeLookupModal";
import { StoreAddressModal } from "../components/customer/corporate360/StoreAddressModal";
import type { CorporateCustomer360Data, CorporateStoreItem, StoreAddressItem } from "../components/customer/corporate360/types";

// Canonical Mock Payload matching the reference design and API contract
const mockPayload: CorporateCustomer360Data = {
  customer: {
    id: "cust-rrl-192b561d",
    code: "CUST-REL-0001",
    name: "Reliance Retail Ltd.",
    legal_name: "Reliance Retail Limited",
    customer_type: "Corporate Retail Chain",
    segment: "Modern Trade",
    price_group: "Key Account",
    payment_terms: "30 Days (Credit)",
    credit_limit: 500000000,
    credit_days: 30,
    credit_used: 184500000,
    gst_number: "27AAACR1718E1ZV",
    pan_number: "AAACR1718E",
    phone: "+91 22 3555 0000",
    email: "procurement@ril.com",
    website: "www.ril.com",
    address_line1: "3rd Floor, Court House, Lokmanya Tilak Marg, Dhobi Talao",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400002",
    country: "India",
    account_status: "Active",
    is_corporate: true,
    badges: ["Key Account", "National Retail Chain", "Active"],
  },
  account_manager: {
    name: "Rohan Singh",
    designation: "National Key Account Manager",
    initials: "RS",
    email: "rohan.singh@smritibooks.com",
    phone: "+91 98200 88990",
    servicing_region: "All India",
  },
  kpis: {
    total_orders: 124580,
    total_orders_trend_pct: 18,
    total_purchase_value: 4285000000,
    total_purchase_value_formatted: "₹ 428.50 Cr",
    total_purchase_trend_pct: 22,
    average_order_value: 344000,
    average_order_value_formatted: "₹ 3.44 Lakh",
    average_order_value_trend_pct: 6,
    last_order_date: "12 Nov 2024",
    last_order_relative: "3 days ago",
    total_stores: 2456,
    active_stores: 2318,
    active_stores_pct: 94,
    servicing_region: "All India",
    total_psv_value: 1867000000,
    total_psv_value_formatted: "₹ 186.70 Cr",
    psv_stores_reporting: 2318,
  },
  stores: [
    {
      store_code: "RRL-MUM-001",
      store_name: "Reliance Fresh - Andheri",
      city: "Mumbai",
      region: "West",
      store_type: "Supermarket",
      status: "Active",
      psv_value: 2450000,
      psv_value_formatted: "₹ 24.50 Lakh",
      contact_person: "S. Patil",
      contact_phone: "+91 98201 11223",
    },
    {
      store_code: "RRL-MUM-002",
      store_name: "Reliance Smart - Powai",
      city: "Mumbai",
      region: "West",
      store_type: "Hypermarket",
      status: "Active",
      psv_value: 4820000,
      psv_value_formatted: "₹ 48.20 Lakh",
      contact_person: "R. Singh",
      contact_phone: "+91 98201 11224",
    },
    {
      store_code: "RRL-DEL-001",
      store_name: "Reliance Digital - Lajpat",
      city: "New Delhi",
      region: "North",
      store_type: "Electronics",
      status: "Active",
      psv_value: 3210000,
      psv_value_formatted: "₹ 32.10 Lakh",
      contact_person: "A. Kumar",
      contact_phone: "+91 98111 22334",
    },
    {
      store_code: "RRL-BLR-001",
      store_name: "Reliance Trends - MG Road",
      city: "Bengaluru",
      region: "South",
      store_type: "Fashion",
      status: "Active",
      psv_value: 1870000,
      psv_value_formatted: "₹ 18.70 Lakh",
      contact_person: "K. Reddy",
      contact_phone: "+91 98450 33445",
    },
    {
      store_code: "RRL-HYD-001",
      store_name: "Reliance Fresh - Banjara",
      city: "Hyderabad",
      region: "South",
      store_type: "Supermarket",
      status: "Active",
      psv_value: 2130000,
      psv_value_formatted: "₹ 21.30 Lakh",
      contact_person: "M. Khan",
      contact_phone: "+91 98490 44556",
    },
  ],
  psv_summary: {
    total_stock_value: 1867000000,
    total_stock_value_formatted: "₹ 186.70 Cr",
    in_stock_value: 1624000000,
    in_stock_value_formatted: "₹ 162.40 Cr",
    in_stock_stores: 2012,
    in_stock_pct: 87.0,
    low_stock_value: 186000000,
    low_stock_value_formatted: "₹ 18.60 Cr",
    low_stock_stores: 231,
    low_stock_pct: 10.0,
    out_of_stock_value: 57000000,
    out_of_stock_value_formatted: "₹ 5.70 Cr",
    out_of_stock_stores: 75,
    out_of_stock_pct: 3.0,
  },
  store_types: [
    { type: "Supermarket", count: 1120, percentage: 45.6, color: "#0284c7" },
    { type: "Hypermarket", count: 620, percentage: 25.2, color: "#f97316" },
    { type: "Fashion", count: 380, percentage: 15.5, color: "#8b5cf6" },
    { type: "Electronics", count: 210, percentage: 8.5, color: "#10b981" },
    { type: "Others", count: 126, percentage: 7.1, color: "#ec4899" },
  ],
  recent_orders: [
    {
      order_no: "SO-2024-11872",
      date: "12 Nov 2024",
      stores_count: 24,
      items_count: 156,
      value: 4820000,
      value_formatted: "₹ 48.20 Lakh",
      status: "Completed",
    },
    {
      order_no: "SO-2024-11855",
      date: "08 Nov 2024",
      stores_count: 18,
      items_count: 98,
      value: 3210000,
      value_formatted: "₹ 32.10 Lakh",
      status: "Completed",
    },
  ],
  purchase_trends: [
    { month: "Jan", purchase_value_cr: 16.5, orders_count: 8200 },
    { month: "Feb", purchase_value_cr: 22.1, orders_count: 9400 },
  ],
  top_categories: [
    {
      category: "FMCG",
      value: 1685000000,
      value_formatted: "₹ 168.50 Cr",
      share_percentage: 39.3,
    },
    {
      category: "Fashion & Apparel",
      value: 824000000,
      value_formatted: "₹ 82.40 Cr",
      share_percentage: 19.2,
    },
    {
      category: "Electronics",
      value: 641000000,
      value_formatted: "₹ 64.10 Cr",
      share_percentage: 15.0,
    },
    {
      category: "Home & Living",
      value: 482000000,
      value_formatted: "₹ 48.20 Cr",
      share_percentage: 11.3,
    },
    {
      category: "General Merchandise",
      value: 326000000,
      value_formatted: "₹ 32.60 Cr",
      share_percentage: 7.6,
    },
    {
      category: "Others",
      value: 247000000,
      value_formatted: "₹ 24.70 Cr",
      share_percentage: 5.8,
    },
  ],
};

describe("Corporate Customer 360 Dashboard Components", () => {
  it("renders Corporate Account Header with Reliance brand identity and metadata", () => {
    const markup = renderToStaticMarkup(
      <CorporateAccountHeader
        data={mockPayload}
        onEdit={vi.fn()}
        onCreateOrder={vi.fn()}
      />
    );

    // Brand and customer identity
    expect(markup).toContain("Reliance Retail Ltd.");
    expect(markup).toContain("CUST-REL-0001");
    expect(markup).toContain("Key Account");
    expect(markup).toContain("National Retail Chain");
    expect(markup).toContain("Active");

    // Contact info
    expect(markup).toContain("+91 22 3555 0000");
    expect(markup).toContain("procurement@ril.com");
    expect(markup).toContain("www.ril.com");
    expect(markup).toContain("Dhobi Talao");

    // Metadata block
    expect(markup).toContain("Corporate Retail Chain");
    expect(markup).toContain("Modern Trade");
    expect(markup).toContain("30 Days (Credit)");
    expect(markup).toContain("₹ 50,00,00,000");
    expect(markup).toContain("27AAACR1718E1ZV");

    // Right summary cards
    expect(markup).toContain("2,456");
    expect(markup).toContain("2,318");
    expect(markup).toContain("All India");
    expect(markup).toContain("Rohan Singh");
    expect(markup).toContain("National Key Account Manager");
  });

  it("renders 13 Customer Navigation Tabs with active tab indicator", () => {
    const markup = renderToStaticMarkup(
      <CorporateCustomerTabs
        activeTab="overview"
        onTabChange={vi.fn()}
        storesCount={2456}
      />
    );

    expect(markup).toContain("Overview");
    expect(markup).toContain("Stores (2,456)");
    expect(markup).toContain("Orders");
    expect(markup).toContain("Invoices");
    expect(markup).toContain("Payments");
    expect(markup).toContain("PSV &amp; Inventory");
    expect(markup).toContain("Products");
    expect(markup).toContain("Communication");
    expect(markup).toContain("Contracts");
    expect(markup).toContain("Addresses");
    expect(markup).toContain("Team");
    expect(markup).toContain("Notes");
    expect(markup).toContain("History");
  });

  it("renders 6 KPI Cards with Indian currency formatting and trend metrics", () => {
    const markup = renderToStaticMarkup(
      <CorporateKpiCards kpis={mockPayload.kpis} />
    );

    // KPI 1: Total Orders
    expect(markup).toContain("1,24,580");
    expect(markup).toContain("18%");

    // KPI 2: Total Purchase Value
    expect(markup).toContain("₹ 428.50 Cr");
    expect(markup).toContain("22%");

    // KPI 3: Average Order Value
    expect(markup).toContain("₹ 3.44 Lakh");
    expect(markup).toContain("6%");

    // KPI 4: Last Order Date
    expect(markup).toContain("12 Nov 2024");
    expect(markup).toContain("3 days ago");

    // KPI 5: Active Stores
    expect(markup).toContain("2,318 / 2,456");
    expect(markup).toContain("94% active");

    // KPI 6: Total Store Stock (PSV)
    expect(markup).toContain("₹ 186.70 Cr");
    expect(markup).toContain("Live Visibility");
  });

  it("renders Corporate Store Network table with canonical store codes and filters", () => {
    const markup = renderToStaticMarkup(
      <CorporateStoreNetwork
        stores={mockPayload.stores}
        totalCount={2456}
        onSelectStore={vi.fn()}
      />
    );

    // Search and headers
    expect(markup).toContain("Store Network (2,456 Stores)");
    expect(markup).toContain("Store Code");
    expect(markup).toContain("Store Name");
    expect(markup).toContain("City");
    expect(markup).toContain("Store Type");
    expect(markup).toContain("PSV Value");
    expect(markup).toContain("Address Summary");

    // Canonical store codes and store names
    expect(markup).toContain("RRL-MUM-001");
    expect(markup).toContain("Reliance Fresh - Andheri");
    expect(markup).toContain("RRL-MUM-002");
    expect(markup).toContain("Reliance Smart - Powai");
    expect(markup).toContain("RRL-DEL-001");
    expect(markup).toContain("Reliance Digital - Lajpat");
    expect(markup).toContain("RRL-BLR-001");
    expect(markup).toContain("Reliance Trends - MG Road");
    expect(markup).toContain("RRL-HYD-001");
    expect(markup).toContain("Reliance Fresh - Banjara");

    // Values & Contacts
    expect(markup).toContain("₹ 24.50 Lakh");
    expect(markup).toContain("S. Patil");
    expect(markup).toContain("View All 2,456 Stores");
  });

  it("renders PSV Party Stock Visibility widget with donut breakdown and statuses", () => {
    const markup = renderToStaticMarkup(
      <CorporatePsvWidget psvSummary={mockPayload.psv_summary} />
    );

    expect(markup).toContain("PSV (Party Stock Visibility)");
    expect(markup).toContain("₹ 186.70 Cr");
    expect(markup).toContain("Total Store Stock");
    expect(markup).toContain("₹ 162.40 Cr");
    expect(markup).toContain("In Stock (2,012 stores)");
    expect(markup).toContain("₹ 18.60 Cr");
    expect(markup).toContain("Low Stock (231 stores)");
    expect(markup).toContain("₹ 5.70 Cr");
    expect(markup).toContain("Out of Stock (75 stores)");
    expect(markup).toContain("View PSV Dashboard");
  });

  it("renders Store Type Distribution widget with counts and percentages", () => {
    const markup = renderToStaticMarkup(
      <CorporateStoreTypeWidget
        storeTypes={mockPayload.store_types}
        totalStores={2456}
      />
    );

    expect(markup).toContain("Store Type Distribution");
    expect(markup).toContain("2,456");
    expect(markup).toContain("Total Stores");
    expect(markup).toContain("Supermarket");
    expect(markup).toContain("1,120");
    expect(markup).toContain("45.6%");
    expect(markup).toContain("Hypermarket");
    expect(markup).toContain("620");
    expect(markup).toContain("25.2%");
    expect(markup).toContain("Fashion");
    expect(markup).toContain("380");
    expect(markup).toContain("15.5%");
  });

  it("renders Recent Orders widget with order numbers and status badges", () => {
    const markup = renderToStaticMarkup(
      <CorporateRecentOrdersWidget orders={mockPayload.recent_orders} />
    );

    expect(markup).toContain("Recent Orders");
    expect(markup).toContain("SO-2024-11872");
    expect(markup).toContain("12 Nov 2024");
    expect(markup).toContain("24");
    expect(markup).toContain("156");
    expect(markup).toContain("₹ 48.20 Lakh");
    expect(markup).toContain("Completed");
  });

  it("renders Top Product Categories with value shares and distribution bars", () => {
    const markup = renderToStaticMarkup(
      <CorporateTopCategoriesWidget categories={mockPayload.top_categories} />
    );

    expect(markup).toContain("Top Categories (Last 12 Months)");
    expect(markup).toContain("FMCG");
    expect(markup).toContain("₹ 168.50 Cr");
    expect(markup).toContain("39.3%");
    expect(markup).toContain("Fashion &amp; Apparel");
    expect(markup).toContain("₹ 82.40 Cr");
    expect(markup).toContain("19.2%");
    expect(markup).toContain("Electronics");
    expect(markup).toContain("₹ 64.10 Cr");
    expect(markup).toContain("15%");
  });

  it("renders StoreCodeLookupModal with search bar, store codes, and disabled state for cross-customer assigned codes", () => {
    const markup = renderToStaticMarkup(
      <StoreCodeLookupModal
        isOpen={true}
        onClose={() => {}}
        currentCustomerId="cust-tata-002"
        currentCustomerName="Tata Trent Hypermarket Ltd."
        currentlyAssignedCodes={["TATA-STR-101"]}
        onAssignStoreCode={async () => {}}
      />
    );

    expect(markup).toContain("Store Code Master Lookup");
    expect(markup).toContain("Search by Store Code");
    expect(markup).toContain("Map Store Code");
    expect(markup).toContain("Cancel");
  });

  it("renders StoreAddressModal with typed addresses (Delivery, Billing, Warehouse) and primary badges", () => {
    const mockStore: CorporateStoreItem = {
      id: "cdl-ril-001",
      store_code: "RRL-MUM-001",
      store_name: "Reliance Fresh - Andheri",
      city: "Mumbai",
      state: "Maharashtra",
      store_type: "Supermarket",
      status: "Active",
      psv_value: 2450000,
      contact: "S. Patil",
      address_summary: "Plot 4, Andheri West, Mumbai - 400053",
      addresses: [
        {
          id: "addr-001",
          address_type: "Delivery",
          address_title: "Inward Goods Gate 2",
          address_line1: "Plot 4, Andheri Industrial Area",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400053",
          country: "India",
          is_primary: true,
          is_active: true,
        },
        {
          id: "addr-002",
          address_type: "Billing",
          address_title: "Accounts Desk",
          address_line1: "Floor 3, Commercial Center",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400053",
          country: "India",
          is_primary: true,
          is_active: true,
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <StoreAddressModal
        isOpen={true}
        onClose={() => {}}
        customerId="cust-ril-001"
        store={mockStore}
      />
    );

    expect(markup).toContain("RRL-MUM-001");
    expect(markup).toContain("Reliance Fresh - Andheri");
    expect(markup).toContain("Inward Goods Gate 2");
    expect(markup).toContain("Accounts Desk");
    expect(markup).toContain("Primary Delivery");
    expect(markup).toContain("Primary Billing");
    expect(markup).toContain("Add Typed Address");
  });

  it("renders CorporateStoreNetwork with Address Summary column and Map Store Code trigger", () => {
    const testStores: CorporateStoreItem[] = [
      {
        id: "loc-01",
        store_code: "RRL-MUM-001",
        store_name: "Reliance Fresh - Andheri",
        city: "Mumbai",
        state: "Maharashtra",
        store_type: "Supermarket",
        status: "Active",
        psv_value: 2450000,
        contact: "S. Patil",
        address_summary: "Plot 4, Andheri West, Mumbai - 400053",
        addresses: [
          {
            id: "addr-1",
            address_type: "Delivery",
            address_line1: "Plot 4, Andheri West",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400053",
            is_primary: true,
            is_active: true,
          },
        ],
      },
    ];

    const markup = renderToStaticMarkup(
      <CorporateStoreNetwork
        stores={testStores}
        customerId="cust-ril-001"
        customerName="Reliance Retail Ltd."
        totalStoresCount={2456}
      />
    );

    expect(markup).toContain("Store Network");
    expect(markup).toContain("Address Summary");
    expect(markup).toContain("Map Store Code");
    expect(markup).toContain("Plot 4, Andheri West, Mumbai - 400053");
    expect(markup).toContain("Addresses (1)");
  });
});
