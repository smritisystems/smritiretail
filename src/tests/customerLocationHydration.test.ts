import { describe, expect, it } from "vitest";
import {
  getLocationIdsToDeactivate,
  mergeCanonicalLocationsIntoAddresses
} from "../components/customer/CustMasterWs.tsx";

describe("customer canonical location hydration", () => {
  it("merges delivery and billing locations into one customer address collection", () => {
    const addresses = mergeCanonicalLocationsIntoAddresses(
      [],
      [{
        id: "loc-blr",
        store_code: "BLR-002",
        location_name: "Bengaluru Branch",
        address_line1: "12 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        state_code: "29",
        pincode: "560001",
        is_default: true
      }],
      [{
        id: "bill-ho",
        billing_store_code: "REL-HO",
        location_name: "Head Office",
        address_line1: "1 Corporate Park",
        city: "Mumbai",
        state: "Maharashtra",
        state_code: "27",
        pincode: "400001",
        is_default: true
      }]
    );

    expect(addresses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "loc-blr",
        addressType: "shipping",
        shippingStoreCode: "BLR-002",
        city: "Bengaluru"
      }),
      expect.objectContaining({
        id: "bill-ho",
        addressType: "billing",
        billingStoreCode: "REL-HO",
        city: "Mumbai"
      })
    ]));
  });

  it("does not duplicate a hydrated location when the editor already has its store code", () => {
    const addresses = mergeCanonicalLocationsIntoAddresses(
      [{
        id: "loc-blr",
        code: "loc-blr",
        addressType: "shipping",
        shippingStoreCode: "BLR-002",
        city: "Old Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        address1: "Old address",
        address2: "",
        address3: "",
        address4: "",
        address5: "",
        locality: "",
        zone: "South",
        country: "India",
        contactPerson: "Branch",
        officePhone: "",
        homePhone: "",
        mobilePhone: "",
        faxNumber: "",
        email1: "",
        email2: "",
        email3: "",
        isDefault: true
      }],
      [{
        id: "loc-blr",
        store_code: "BLR-002",
        location_name: "Bengaluru Branch",
        address_line1: "12 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        state_code: "29",
        pincode: "560001",
        is_default: true
      }],
      []
    );

    expect(addresses.filter(address => address.shippingStoreCode === "BLR-002")).toHaveLength(1);
    expect(addresses.find(address => address.id === "loc-blr")?.city).toBe("Bengaluru");
  });

  it("collapses same-type duplicate addresses by normalized address content", () => {
    const addresses = mergeCanonicalLocationsIntoAddresses([
      {
        id: "mail-1",
        code: "001",
        addressType: "mailing",
        address1: "12 MG Road,",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
        isDefault: true
      },
      {
        id: "mail-2",
        code: "002",
        addressType: "mailing",
        address1: "12  MG Road",
        city: " Bengaluru ",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
        contactPerson: "Updated Contact",
        isDefault: false
      }
    ]);

    expect(addresses.filter(address => address.addressType === "mailing")).toHaveLength(1);
    expect(addresses.find(address => address.addressType === "mailing")?.contactPerson).toBe("Updated Contact");
    expect(addresses.find(address => address.addressType === "mailing")?.isDefault).toBe(true);
  });

  it("does not deactivate a location whose store code was renamed", () => {
    const knownAddressIds = new Set(["loc-blr"]);
    const submittedLocationIds = new Set(["loc-blr"]);

    expect(getLocationIdsToDeactivate(
      [{ id: "loc-blr" }, { id: "loc-del" }],
      knownAddressIds,
      submittedLocationIds
    )).toEqual([]);
  });
});