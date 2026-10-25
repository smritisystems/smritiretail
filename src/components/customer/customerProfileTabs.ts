export type CustomerProfileTabKey = "form" | "retail" | "additional";

export interface CustomerProfileTabLabels {
  form: string;
  retail: string;
  additional: string;
}

const RETAIL_PROFILE_TABS: CustomerProfileTabLabels = {
  form: "Profile & Contact",
  retail: "Retail & Loyalty",
  additional: "Account Settings",
};

const TRADE_PROFILE_TABS: CustomerProfileTabLabels = {
  form: "Business Profile",
  retail: "Trade Governance",
  additional: "Credit & Delivery",
};

const CORPORATE_PROFILE_TABS: CustomerProfileTabLabels = {
  form: "Identity & Compliance",
  retail: "Corporate Governance",
  additional: "Commercial & Account Terms",
};

export function getCustomerProfileTabLabels(customer: {
  customerType?: string | null;
  environment?: string | null;
  customerGroupId?: string | null;
  customer_group_id?: string | null;
  code?: string | null;
  name?: string | null;
}): CustomerProfileTabLabels {
  const type = customer.customerType?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const group = (customer.customerGroupId || customer.customer_group_id || "").toUpperCase();
  const isCorporate = type === "CORPORATE"
    || customer.environment?.toUpperCase() === "CORPORATE"
    || group === "CG-CORPORATE"
    || Boolean(customer.code?.startsWith("RRL"))
    || Boolean(customer.name?.toLowerCase().includes("reliance"));
  if (isCorporate) return CORPORATE_PROFILE_TABS;

  if (["WHOLESALE", "DISTRIBUTION", "DISTRIBUTOR", "TRADE", "B2B"].includes(type || "")) {
    return TRADE_PROFILE_TABS;
  }

  return RETAIL_PROFILE_TABS;
}
