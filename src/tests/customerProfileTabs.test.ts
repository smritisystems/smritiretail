import { describe, expect, it } from "vitest";
import { getCustomerProfileTabLabels } from "../components/customer/customerProfileTabs.ts";

describe("customer profile tabs", () => {
  it("uses retail labels for individual and walk-in profiles", () => {
    expect(getCustomerProfileTabLabels({ customerType: "Walk-In" })).toEqual({
      form: "Profile & Contact",
      retail: "Retail & Loyalty",
      additional: "Account Settings",
    });
    expect(getCustomerProfileTabLabels({ customerType: "VIP" }).retail).toBe("Retail & Loyalty");
  });

  it("uses trade labels for wholesale and distribution profiles", () => {
    expect(getCustomerProfileTabLabels({ customerType: "Wholesale" })).toEqual({
      form: "Business Profile",
      retail: "Trade Governance",
      additional: "Credit & Delivery",
    });
    expect(getCustomerProfileTabLabels({ customerType: "Distribution" }).additional).toBe("Credit & Delivery");
  });

  it("recognizes corporate profiles through their existing account markers", () => {
    expect(getCustomerProfileTabLabels({ customerGroupId: "CG-Corporate" }).form).toBe("Identity & Compliance");
    expect(getCustomerProfileTabLabels({ customerType: "Corporate" }).additional).toBe("Commercial & Account Terms");
  });
});
