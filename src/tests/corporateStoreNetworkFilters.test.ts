import { describe, expect, it } from "vitest";
import {
  filterStoreNetworkItems,
  getStoreNetworkRegions,
  getStoreNetworkTypes,
} from "../components/customer/corporate360/CorporateStoreNetwork";
import type { CorporateStoreItem } from "../components/customer/corporate360/types";

const stores: CorporateStoreItem[] = [
  {
    id: "store-1",
    store_code: "1969",
    store_name: "Reliance Store Guwahati",
    city: "Guwahati",
    state: "ASSAM",
    store_type: "Supermarket",
    status: "Active",
    psv_value: 0,
    addresses: [
      {
        id: "address-1",
        address_type: "Shipping",
        address_line1: "GS Road",
        city: "Guwahati",
        state: "Assam",
        pincode: "781007",
        is_primary: true,
        is_active: true,
      },
    ],
  },
  {
    id: "store-2",
    store_code: "8313",
    store_name: "Reliance Store Tumkur",
    city: "Tumkur",
    state: "Karnataka",
    store_type: "Fashion",
    status: "Inactive",
    psv_value: 0,
  },
  {
    id: "store-3",
    store_code: "1970",
    store_name: "Reliance Store Dibrugarh",
    city: "Dibrugarh",
    state: "Assam",
    store_type: "supermarket",
    status: "Inactive",
    psv_value: 0,
  },
];

describe("Corporate Store Network filters", () => {
  it("deduplicates regions regardless of capitalization", () => {
    expect(getStoreNetworkRegions(stores)).toEqual(["ASSAM", "Karnataka"]);
  });

  it("deduplicates store types regardless of capitalization", () => {
    expect(getStoreNetworkTypes(stores)).toEqual(["Fashion", "Supermarket"]);
  });

  it("searches postal codes in typed addresses", () => {
    expect(filterStoreNetworkItems(stores, "781007", "ALL", "ALL", "ALL").map((store) => store.id))
      .toEqual(["store-1"]);
  });

  it("matches region, type, and status regardless of capitalization", () => {
    expect(filterStoreNetworkItems(stores, "", "assam", "supermarket", "active").map((store) => store.id))
      .toEqual(["store-1"]);
  });
});
