/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-23
 * Modified     : 2026-10-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Customer 360 Dashboard Test Suite
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Customer360DashboardView } from "../components/customer/corporate360/Customer360DashboardView.tsx";
import { CorporateCustomer360 } from "../components/customer/corporate360/CorporateCustomer360.tsx";
import { CorporateCustomerTabs } from "../components/customer/corporate360/CorporateCustomerTabs.tsx";

const customer = {
  id: "cust-001",
  code: "CUST-001",
  name: "Northwind Retail",
  customer_type: "Business",
  status: "Active",
  is_active: true,
  credit_limit: 250000,
  credit_used: 40000,
  credit_days: 30,
  credit_hold: false,
  show_child_customers_in_billing: true,
  dependants: [{ dependant_customer_code: "CH-001", dependant_customer_name: "Northwind Outlet", status: "Active" }],
  billing_locations: [{ id: "bill-1", location_name: "Head Office", city: "Pune", is_default: true }],
  delivery_locations: [{ id: "loc-1", store_code: "NW-01", location_name: "Pune Store", city: "Pune", status: "Active" }],
  gst_registrations: [{ id: "gst-1", gstin: "27ABCDE1234F1Z5", state_name: "Maharashtra", status: "ACTIVE", is_primary: true }],
  invoices: [{ id: "inv-1", invoice_number: "INV-001", date: "2026-10-20", total_amount: 1180, status: "PAID" }],
};

describe("Customer 360 dashboard", () => {
  it("does not select a customer implicitly when the dashboard opens without context", () => {
    const html = renderToStaticMarkup(<CorporateCustomer360 onBack={vi.fn()} />);
    expect(html).toContain("Select a customer to view the dashboard");
    expect(html).toContain("Open Customer Master");
    expect(html).not.toContain("Reliance");
  });

  it("handles draft customer records cleanly without issuing live API requests", () => {
    const html = renderToStaticMarkup(<CorporateCustomer360 customerId="cust-draft-1792937624940" onBack={vi.fn()} />);
    expect(html).toContain("Save customer to view 360° dashboard");
    expect(html).toContain("This customer record is a new draft.");
    expect(html).toContain("Open Customer Master");
  });

  it("shows customer-specific summary data and omits unsourced prototype values", () => {
    const html = renderToStaticMarkup(<Customer360DashboardView customer={customer} />);
    expect(html).toContain("Northwind Retail");
    expect(html).toContain("CUST-001");
    expect(html).toContain("1 / 1");
    expect(html).toContain("₹2,50,000");
    expect(html).not.toContain("Reliance");
    expect(html).not.toContain("AABCR1718E");
    expect(html).not.toContain("2,456");
    expect(html).not.toContain("85 stores");
  });

  it("uses verified customer purchase metrics without showing fabricated growth rates", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView
        customer={{ ...customer, outstanding: 5400 }}
        corporate360Data={{
          customer,
          kpis: {
            total_orders: 24,
            orders_growth_pct: 18,
            total_purchase_value: 85400,
            purchase_growth_pct: 22,
            average_order_value: 0,
            aov_growth_pct: 6,
            last_order_date: "28 Oct 2026",
            last_order_relative: "Recent",
            total_stores: 0,
            active_stores: 0,
            active_stores_pct: 0,
            total_psv_value: 0,
            psv_stores_count: 0,
          },
          store_network: [],
          psv_summary: {
            total_value: 0,
            in_stock_value: 0,
            in_stock_stores: 0,
            low_stock_value: 0,
            low_stock_stores: 0,
            out_of_stock_value: 0,
            out_of_stock_stores: 0,
          },
          store_type_distribution: [],
          recent_orders: [],
          purchase_trend: [],
        }}
      />,
    );

    expect(html).toContain("Total purchases");
    expect(html).toContain("Outstanding balance");
    expect(html).toContain("Invoices");
    expect(html).toContain("Last purchase");
    expect(html).toContain("₹85,400");
    expect(html).toContain("₹5,400");
    expect(html).toContain("28 Oct 2026");
    expect(html).not.toContain("22%");
    expect(html).not.toContain("18%");
    expect(html).not.toContain("6%");
  });

  it("keeps customer creation and editing inside the Customer 360 experience", () => {
    const viewHtml = renderToStaticMarkup(
      <Customer360DashboardView
        customer={customer}
        onCreateCustomer={vi.fn()}
        onEditCustomer={vi.fn()}
      />,
    );
    expect(viewHtml).toContain("New customer");
    expect(viewHtml).toContain("Edit customer");

    const editHtml = renderToStaticMarkup(
      <Customer360DashboardView
        customer={customer}
        isEditing
        onCustomerChange={vi.fn()}
        onCancelEdit={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(editHtml).toContain("Edit customer profile");
    expect(editHtml).toContain("Customer name");
    expect(editHtml).toContain("Mobile number");
    expect(editHtml).toContain("GSTIN");
    expect(editHtml).toContain("Payment terms");
    expect(editHtml).toContain("Save changes");
    expect(editHtml).toContain("Cancel");
    expect(editHtml).not.toContain("Basic Details");
  });

  it("explains the business consequence when the customer is inactive", () => {
    const html = renderToStaticMarkup(<Customer360DashboardView customer={{ ...customer, status: "Inactive", is_active: false }} />);
    expect(html).toContain("New billing is blocked.");
    expect(html).toContain("This customer is inactive");
    expect(html).not.toContain(">Deactivate<");
  });

  it("shows a pending PSV action and explains why approval matters", () => {
    const html = renderToStaticMarkup(
      <Customer360DashboardView customer={customer} initialPsvSummary={{
        total_items: 1,
        total_document_qty: 10,
        total_received_qty: 10,
        total_approved_qty: 6,
        total_pending_approval_qty: 4,
        total_short_qty: 0,
        total_excess_qty: 0,
      }} />,
    );
    expect(html).toContain("4 units await PSV approval.");
    expect(html).toContain("Unapproved receipts are not included in approved stock.");
    expect(html).toContain("Review reconciliation");
  });

  it("shows unsaved changes only when the parent reports a dirty record", () => {
    const save = vi.fn();
    const html = renderToStaticMarkup(<Customer360DashboardView customer={customer} isDirty onSave={save} />);
    expect(html).toContain("Changes are not saved.");
    expect(html).toContain("Save changes");
  });

  it("shows real persisted locations and registrations without sample rows", () => {
    const html = renderToStaticMarkup(<Customer360DashboardView customer={customer} initialTab="corporate_tax" />);
    expect(html).toContain("27ABCDE1234F1Z5");
    expect(html).toContain("Maharashtra");
    expect(html).not.toContain("Reliance Retail Mumbai HQ");
    expect(html).not.toContain("27AABCR1234F1Z5");
  });

  it("shows company terms, customer relationships, sales, and PSV as separate business sections", () => {
    const keys = ["commercial", "parent_child", "sales_invoices", "psv"] as const;
    const labels = keys.map((activeTab) => renderToStaticMarkup(<CorporateCustomerTabs activeTab={activeTab} onTabChange={() => undefined} />));
    expect(labels.join(" ")).toContain("Commercial Terms");
    expect(labels.join(" ")).toContain("Parent");
    expect(labels.join(" ")).toContain("Sales &amp; Invoices");
    expect(labels.join(" ")).toContain("PSV Reconciliation");
    expect(labels.join(" ")).not.toContain("Contacts &amp; Documents");
    expect(labels.join(" ")).not.toContain("Activity &amp; Audit");
  });

  it("keeps credit holds visible as a billing decision and points to commercial terms", () => {
    const html = renderToStaticMarkup(<Customer360DashboardView customer={{ ...customer, credit_hold: true }} />);
    expect(html).toContain("Credit invoices are on hold.");
    expect(html).toContain("Review terms");
  });

  it("renders ShopperStop 360° page with identity, linked children, addresses, and store network", () => {
    const shopperStopCustomer = {
      id: "01a17307-6fb6-7000-a97d-da721ae573f5",
      code: "CUST-68351893",
      name: "ShopperStop",
      customer_type: "Corporate",
      status: "Active",
      is_active: true,
      credit_limit: 1000000,
      credit_used: 150000,
      credit_days: 45,
      credit_hold: false,
      show_child_customers_in_billing: true,
      dependants: [
        {
          dependant_customer_id: "01a173ba-a6e5-7000-b172-0812ecf669e7",
          dependant_customer_code: "CUST-68351894",
          dependant_customer_name: "ShopperStop Demo Branch",
          relation: "Child",
          status: "Active",
          is_active: true,
        },
        {
          dependant_customer_id: "01a1756f-39fb-7000-b2c4-c5d3b8541867",
          dependant_customer_code: "CUST-68351895",
          dependant_customer_name: "abcd",
          relation: "Child",
          status: "Active",
          is_active: true,
        },
      ],
      billing_locations: [
        {
          id: "bill-loc-1",
          billing_store_code: "BIL-GKP-01",
          location_name: "Gorakhpur Central Hub",
          city: "Gorakhpur",
          state: "Uttar Pradesh",
          is_default: true,
        },
      ],
      delivery_locations: [
        {
          id: "del-loc-1",
          store_code: "SHP-MUM-01",
          location_name: "ShopperStop Bandra Flagship",
          city: "Mumbai",
          state: "Maharashtra",
          status: "Active",
        },
        {
          id: "del-loc-2",
          store_code: "SHP-DEL-02",
          location_name: "ShopperStop Connaught Place",
          city: "New Delhi",
          state: "Delhi",
          status: "Active",
        },
      ],
      gst_registrations: [
        {
          id: "gst-shp-1",
          gstin: "09AAACS1234D1Z8",
          state_name: "Uttar Pradesh",
          status: "ACTIVE",
          is_primary: true,
        },
      ],
      invoices: [],
    };

    // 1. Overview tab shows identity, child count metric, and stores count metric
    const overviewHtml = renderToStaticMarkup(<Customer360DashboardView customer={shopperStopCustomer} initialTab="overview" />);
    expect(overviewHtml).toContain("ShopperStop");
    expect(overviewHtml).toContain("CUST-68351893");
    expect(overviewHtml).toContain("Child customers");
    expect(overviewHtml).toContain("2 / 2");

    // 2. Parent-child tab displays linked children
    const parentChildHtml = renderToStaticMarkup(<Customer360DashboardView customer={shopperStopCustomer} initialTab="parent_child" />);
    expect(parentChildHtml).toContain("ShopperStop Demo Branch");
    expect(parentChildHtml).toContain("CUST-68351894");
    expect(parentChildHtml).toContain("abcd");
    expect(parentChildHtml).toContain("CUST-68351895");

    // 3. Addresses tab displays billing & delivery addresses
    const addressesHtml = renderToStaticMarkup(<Customer360DashboardView customer={shopperStopCustomer} initialTab="addresses" />);
    expect(addressesHtml).toContain("Gorakhpur Central Hub");
    expect(addressesHtml).toContain("Gorakhpur");
    expect(addressesHtml).toContain("SHP-MUM-01");

    // 4. Stores tab displays store network
    const storesHtml = renderToStaticMarkup(<Customer360DashboardView customer={shopperStopCustomer} initialTab="stores" />);
    expect(storesHtml).toContain("SHP-MUM-01");
    expect(storesHtml).toContain("ShopperStop Bandra Flagship");
    expect(storesHtml).toContain("SHP-DEL-02");
    expect(storesHtml).toContain("ShopperStop Connaught Place");
  });
});
