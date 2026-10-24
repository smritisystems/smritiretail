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
});
