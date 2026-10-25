/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.7.1
 * Created      : 2026-10-25
 * Modified     : 2026-10-25
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Customer Address Save Validation & Untouched Placeholder Exemption Suite
 */

import { describe, it, expect } from "vitest";
import {
  CustomerAddressEntry,
  isAddressEntryPlaceholder,
  findMissingStoreCodeAddress
} from "../components/customer/types.ts";

describe("Customer Address Save Validation & Untouched Placeholder Handling", () => {
  // Baseline system default placeholder synthesized during normalization
  const createDefaultPlaceholder = (
    code: string,
    addressType: "mailing" | "billing" | "shipping"
  ): CustomerAddressEntry => ({
    code,
    addressType,
    contactPerson: "",
    storeCode: "",
    billingStoreCode: "",
    shippingStoreCode: "",
    address1: "",
    address2: "",
    address3: "",
    address4: "",
    address5: "",
    locality: "",
    city: "Gorakhpur",
    postalCode: "",
    state: "Uttar Pradesh",
    zone: "North",
    country: "India",
    officePhone: "",
    homePhone: "",
    mobilePhone: "",
    faxNumber: "",
    email1: "",
    email2: "",
    email3: "",
    isDefault: false
  });

  const createValidMailingAddress = (code: string = "001"): CustomerAddressEntry => ({
    code,
    addressType: "mailing",
    contactPerson: "ShopperStop Operations",
    storeCode: "",
    billingStoreCode: "",
    shippingStoreCode: "",
    address1: "Shop 12, Link Road Commercial Complex",
    address2: "Opposite Inorbit Mall",
    address3: "",
    address4: "",
    address5: "",
    locality: "Malad West",
    city: "Mumbai",
    postalCode: "400064",
    state: "Maharashtra",
    zone: "West",
    country: "India",
    officePhone: "022-28765432",
    homePhone: "",
    mobilePhone: "9000000001",
    faxNumber: "",
    email1: "contact@shopperstop.example",
    email2: "",
    email3: "",
    isDefault: true
  });

  describe("isAddressEntryPlaceholder", () => {
    it("identifies unedited default billing and shipping placeholders as placeholders", () => {
      const billingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");

      expect(isAddressEntryPlaceholder(billingPlaceholder)).toBe(true);
      expect(isAddressEntryPlaceholder(shippingPlaceholder)).toBe(true);
    });

    it("identifies empty address entries without ID as placeholders", () => {
      expect(isAddressEntryPlaceholder({ addressType: "billing" })).toBe(true);
      expect(isAddressEntryPlaceholder(undefined)).toBe(true);
    });

    it("returns false if an entry has a persisted database ID", () => {
      const persisted = {
        ...createDefaultPlaceholder("002", "billing"),
        id: "loc_billing_001"
      };
      expect(isAddressEntryPlaceholder(persisted)).toBe(false);
    });

    it("returns false if an entry has substantive address line 1", () => {
      const edited = {
        ...createDefaultPlaceholder("002", "billing"),
        address1: "Plot 42, Electronics City Phase 1"
      };
      expect(isAddressEntryPlaceholder(edited)).toBe(false);
    });

    it("returns false if an entry has a postal code or locality", () => {
      const editedPin = {
        ...createDefaultPlaceholder("002", "billing"),
        postalCode: "560100"
      };
      const editedLocality = {
        ...createDefaultPlaceholder("003", "shipping"),
        locality: "Whitefield"
      };
      expect(isAddressEntryPlaceholder(editedPin)).toBe(false);
      expect(isAddressEntryPlaceholder(editedLocality)).toBe(false);
    });

    it("returns false if an entry has GSTIN or location name", () => {
      const withGstin = {
        ...createDefaultPlaceholder("002", "billing"),
        gstin: "27AAPFU0939F1ZV"
      };
      const withLocName = {
        ...createDefaultPlaceholder("003", "shipping"),
        locationName: "Central Logistics Hub"
      };
      expect(isAddressEntryPlaceholder(withGstin)).toBe(false);
      expect(isAddressEntryPlaceholder(withLocName)).toBe(false);
    });

    it("returns false if an entry has custom contact or communication details", () => {
      const withContact = {
        ...createDefaultPlaceholder("002", "billing"),
        contactPerson: "Accounts Payable Manager"
      };
      const withPhone = {
        ...createDefaultPlaceholder("003", "shipping"),
        mobilePhone: "9820011111"
      };
      expect(isAddressEntryPlaceholder(withContact, "ShopperStop")).toBe(false);
      expect(isAddressEntryPlaceholder(withPhone)).toBe(false);
    });

    it("returns false if city or state was actively customized from baseline default", () => {
      const customCity = {
        ...createDefaultPlaceholder("002", "billing"),
        city: "Bengaluru"
      };
      expect(isAddressEntryPlaceholder(customCity)).toBe(false);
    });
  });

  describe("findMissingStoreCodeAddress", () => {
    it("REGRESSION: permits saving a valid Mailing address when addressList contains untouched billing & shipping placeholders", () => {
      const mailing = createValidMailingAddress("001");
      const billingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");

      const addressList = [mailing, billingPlaceholder, shippingPlaceholder];
      const initialAddresses = [mailing, billingPlaceholder, shippingPlaceholder];

      // Must NOT reject with missing billing store code
      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeUndefined();
    });

    it("REGRESSION: permits adding a second Mailing address while untouched placeholders exist", () => {
      const mailing1 = createValidMailingAddress("001");
      const billingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");
      const mailing2: CustomerAddressEntry = {
        ...createValidMailingAddress("004"),
        address1: "Andheri Warehouse Office",
        postalCode: "400053",
        isDefault: false
      };

      const initialAddresses = [mailing1, billingPlaceholder, shippingPlaceholder];
      const addressList = [mailing1, billingPlaceholder, shippingPlaceholder, mailing2];

      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeUndefined();
    });

    it("REJECTION: rejects a newly added Billing address when billingStoreCode is missing", () => {
      const mailing = createValidMailingAddress("001");
      const billingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");

      // User clicked "Add new address" and set type to "billing" without billingStoreCode
      const newBillingAddress: CustomerAddressEntry = {
        code: "004",
        addressType: "billing",
        contactPerson: "ShopperStop Finance",
        storeCode: "",
        billingStoreCode: "", // MISSING
        shippingStoreCode: "",
        address1: "123 BKC Corporate Tower",
        address2: "",
        address3: "",
        address4: "",
        address5: "",
        locality: "Bandra Kurla Complex",
        city: "Mumbai",
        postalCode: "400051",
        state: "Maharashtra",
        zone: "West",
        country: "India",
        officePhone: "",
        homePhone: "",
        mobilePhone: "",
        faxNumber: "",
        email1: "",
        email2: "",
        email3: "",
        isDefault: false
      };

      const initialAddresses = [mailing, billingPlaceholder, shippingPlaceholder];
      const addressList = [mailing, billingPlaceholder, shippingPlaceholder, newBillingAddress];

      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeDefined();
      expect(missing?.code).toBe("004");
      expect(missing?.addressType).toBe("billing");
    });

    it("REJECTION: rejects a newly added Shipping address when shippingStoreCode is missing", () => {
      const mailing = createValidMailingAddress("001");
      const billingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");

      // User clicked "Add new address" and set type to "shipping" without shippingStoreCode
      const newShippingAddress: CustomerAddressEntry = {
        code: "004",
        addressType: "shipping",
        contactPerson: "ShopperStop Logistics",
        storeCode: "",
        billingStoreCode: "",
        shippingStoreCode: "", // MISSING
        address1: "Godown 7, Bhiwandi Logistics Park",
        address2: "",
        address3: "",
        address4: "",
        address5: "",
        locality: "Bhiwandi",
        city: "Thane",
        postalCode: "421302",
        state: "Maharashtra",
        zone: "West",
        country: "India",
        officePhone: "",
        homePhone: "",
        mobilePhone: "",
        faxNumber: "",
        email1: "",
        email2: "",
        email3: "",
        isDefault: false
      };

      const initialAddresses = [mailing, billingPlaceholder, shippingPlaceholder];
      const addressList = [mailing, billingPlaceholder, shippingPlaceholder, newShippingAddress];

      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeDefined();
      expect(missing?.code).toBe("004");
      expect(missing?.addressType).toBe("shipping");
    });

    it("ACCEPTANCE: permits a newly added Billing address when billingStoreCode is provided", () => {
      const mailing = createValidMailingAddress("001");
      const billingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");

      const newBillingAddress: CustomerAddressEntry = {
        code: "004",
        addressType: "billing",
        contactPerson: "ShopperStop Finance",
        storeCode: "",
        billingStoreCode: "BILL-BKC-01", // PROVIDED
        shippingStoreCode: "",
        address1: "123 BKC Corporate Tower",
        address2: "",
        address3: "",
        address4: "",
        address5: "",
        locality: "Bandra Kurla Complex",
        city: "Mumbai",
        postalCode: "400051",
        state: "Maharashtra",
        zone: "West",
        country: "India",
        officePhone: "",
        homePhone: "",
        mobilePhone: "",
        faxNumber: "",
        email1: "",
        email2: "",
        email3: "",
        isDefault: false
      };

      const initialAddresses = [mailing, billingPlaceholder, shippingPlaceholder];
      const addressList = [mailing, billingPlaceholder, shippingPlaceholder, newBillingAddress];

      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeUndefined();
    });

    it("ACCEPTANCE: permits a newly added Shipping address when shippingStoreCode is provided", () => {
      const mailing = createValidMailingAddress("001");
      const billingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");

      const newShippingAddress: CustomerAddressEntry = {
        code: "004",
        addressType: "shipping",
        contactPerson: "ShopperStop Logistics",
        storeCode: "",
        billingStoreCode: "",
        shippingStoreCode: "SHIP-BHW-01", // PROVIDED
        address1: "Godown 7, Bhiwandi Logistics Park",
        address2: "",
        address3: "",
        address4: "",
        address5: "",
        locality: "Bhiwandi",
        city: "Thane",
        postalCode: "421302",
        state: "Maharashtra",
        zone: "West",
        country: "India",
        officePhone: "",
        homePhone: "",
        mobilePhone: "",
        faxNumber: "",
        email1: "",
        email2: "",
        email3: "",
        isDefault: false
      };

      const initialAddresses = [mailing, billingPlaceholder, shippingPlaceholder];
      const addressList = [mailing, billingPlaceholder, shippingPlaceholder, newShippingAddress];

      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeUndefined();
    });

    it("REJECTION: rejects an existing placeholder Billing address that was actively edited without a store code", () => {
      const mailing = createValidMailingAddress("001");
      const initialBillingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");

      // User selected address index 1 (the billing placeholder) and typed street address lines,
      // but left billingStoreCode empty
      const editedBillingAddress: CustomerAddressEntry = {
        ...initialBillingPlaceholder,
        address1: "Corporate Headquarters, MG Road",
        postalCode: "560001",
        city: "Bengaluru",
        state: "Karnataka",
        zone: "South",
        billingStoreCode: "" // Still missing
      };

      const initialAddresses = [mailing, initialBillingPlaceholder, shippingPlaceholder];
      const addressList = [mailing, editedBillingAddress, shippingPlaceholder];

      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeDefined();
      expect(missing?.code).toBe("002");
      expect(missing?.addressType).toBe("billing");
    });

    it("ACCEPTANCE: permits an existing placeholder Billing address that was edited WITH a store code", () => {
      const mailing = createValidMailingAddress("001");
      const initialBillingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");

      const editedBillingAddress: CustomerAddressEntry = {
        ...initialBillingPlaceholder,
        address1: "Corporate Headquarters, MG Road",
        postalCode: "560001",
        city: "Bengaluru",
        state: "Karnataka",
        zone: "South",
        billingStoreCode: "BILL-BLR-HQ" // Provided
      };

      const initialAddresses = [mailing, initialBillingPlaceholder, shippingPlaceholder];
      const addressList = [mailing, editedBillingAddress, shippingPlaceholder];

      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeUndefined();
    });

    it("SAFETY: preserves existing persisted database records with an ID even if storeCode was empty", () => {
      const persistedBilling: CustomerAddressEntry = {
        ...createDefaultPlaceholder("002", "billing"),
        id: "loc_billing_persisted_legacy",
        address1: "Old Legacy Office",
        billingStoreCode: "" // Legacy record without store code
      };

      const addressList = [persistedBilling];
      const initialAddresses = [persistedBilling];

      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeUndefined();
    });

    it("FLEXIBILITY: switching addressType from billing back to mailing relieves store code requirement", () => {
      const mailing = createValidMailingAddress("001");
      const billingPlaceholder = createDefaultPlaceholder("002", "billing");
      const shippingPlaceholder = createDefaultPlaceholder("003", "shipping");

      // Address was switched back to mailing
      const switchedToMailing: CustomerAddressEntry = {
        code: "004",
        addressType: "mailing",
        contactPerson: "ShopperStop Branch",
        storeCode: "",
        billingStoreCode: "",
        shippingStoreCode: "",
        address1: "Sub-office Malad",
        address2: "",
        address3: "",
        address4: "",
        address5: "",
        locality: "",
        city: "Mumbai",
        postalCode: "400064",
        state: "Maharashtra",
        zone: "West",
        country: "India",
        officePhone: "",
        homePhone: "",
        mobilePhone: "",
        faxNumber: "",
        email1: "",
        email2: "",
        email3: "",
        isDefault: false
      };

      const initialAddresses = [mailing, billingPlaceholder, shippingPlaceholder];
      const addressList = [mailing, billingPlaceholder, shippingPlaceholder, switchedToMailing];

      const missing = findMissingStoreCodeAddress(addressList, initialAddresses, "ShopperStop");
      expect(missing).toBeUndefined();
    });
  });
});
