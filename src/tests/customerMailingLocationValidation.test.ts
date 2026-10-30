/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.7.0
 * Created      : 2026-10-25
 * Modified     : 2026-10-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Customer Mailing Location, Postal Code & Commercial Zone Validation Tests
 */

import { describe, it, expect } from "vitest";
import {
  INDIAN_ZONES,
  resolveZoneFromState,
  INDIAN_STATE_TO_ZONE,
  INDIAN_STATE_CODE_TO_ZONE,
} from "../constants/indianStates.ts";
import { INDIAN_STATE_CITY_PIN_DATA } from "../constants/indianLocationData.ts";
import { CustomerAddressEntry } from "../components/customer/types.ts";

describe("Customer Mailing Location: State and Zone Validation Tests", () => {
  describe("Commercial Zone Resolution (resolveZoneFromState)", () => {
    it("defines the canonical 6 commercial zones", () => {
      expect(INDIAN_ZONES).toEqual([
        "North",
        "South",
        "East",
        "West",
        "Central",
        "North East",
      ]);
      expect(INDIAN_ZONES).toHaveLength(6);
    });

    it("correctly resolves West zone states and codes", () => {
      expect(resolveZoneFromState("Maharashtra")).toBe("West");
      expect(resolveZoneFromState("maharashtra")).toBe("West");
      expect(resolveZoneFromState("MH")).toBe("West");
      expect(resolveZoneFromState("27")).toBe("West");
      expect(resolveZoneFromState("Gujarat")).toBe("West");
      expect(resolveZoneFromState("GJ")).toBe("West");
      expect(resolveZoneFromState("24")).toBe("West");
      expect(resolveZoneFromState("Goa")).toBe("West");
      expect(resolveZoneFromState("GA")).toBe("West");
      expect(resolveZoneFromState("Dadra & Nagar Haveli")).toBe("West");
      expect(resolveZoneFromState("Daman & Diu")).toBe("West");
    });

    it("correctly resolves North zone states and codes", () => {
      expect(resolveZoneFromState("Uttar Pradesh")).toBe("North");
      expect(resolveZoneFromState("UP")).toBe("North");
      expect(resolveZoneFromState("09")).toBe("North");
      expect(resolveZoneFromState("Delhi")).toBe("North");
      expect(resolveZoneFromState("DL")).toBe("North");
      expect(resolveZoneFromState("07")).toBe("North");
      expect(resolveZoneFromState("Punjab")).toBe("North");
      expect(resolveZoneFromState("PB")).toBe("North");
      expect(resolveZoneFromState("Haryana")).toBe("North");
      expect(resolveZoneFromState("Rajasthan")).toBe("North");
      expect(resolveZoneFromState("Uttarakhand")).toBe("North");
      expect(resolveZoneFromState("Himachal Pradesh")).toBe("North");
      expect(resolveZoneFromState("Jammu & Kashmir")).toBe("North");
      expect(resolveZoneFromState("Ladakh")).toBe("North");
      expect(resolveZoneFromState("Chandigarh")).toBe("North");
    });

    it("correctly resolves South zone states and codes", () => {
      expect(resolveZoneFromState("Karnataka")).toBe("South");
      expect(resolveZoneFromState("KA")).toBe("South");
      expect(resolveZoneFromState("29")).toBe("South");
      expect(resolveZoneFromState("Tamil Nadu")).toBe("South");
      expect(resolveZoneFromState("TN")).toBe("South");
      expect(resolveZoneFromState("33")).toBe("South");
      expect(resolveZoneFromState("Kerala")).toBe("South");
      expect(resolveZoneFromState("Andhra Pradesh")).toBe("South");
      expect(resolveZoneFromState("Telangana")).toBe("South");
      expect(resolveZoneFromState("Puducherry")).toBe("South");
    });

    it("correctly resolves East zone states and codes", () => {
      expect(resolveZoneFromState("West Bengal")).toBe("East");
      expect(resolveZoneFromState("WB")).toBe("East");
      expect(resolveZoneFromState("19")).toBe("East");
      expect(resolveZoneFromState("Bihar")).toBe("East");
      expect(resolveZoneFromState("Jharkhand")).toBe("East");
      expect(resolveZoneFromState("Odisha")).toBe("East");
      expect(resolveZoneFromState("Andaman & Nicobar Islands")).toBe("East");
    });

    it("correctly resolves Central zone states and codes", () => {
      expect(resolveZoneFromState("Madhya Pradesh")).toBe("Central");
      expect(resolveZoneFromState("MP")).toBe("Central");
      expect(resolveZoneFromState("23")).toBe("Central");
      expect(resolveZoneFromState("Chhattisgarh")).toBe("Central");
      expect(resolveZoneFromState("CG")).toBe("Central");
      expect(resolveZoneFromState("22")).toBe("Central");
    });

    it("correctly resolves North East zone states and codes", () => {
      expect(resolveZoneFromState("Assam")).toBe("North East");
      expect(resolveZoneFromState("AS")).toBe("North East");
      expect(resolveZoneFromState("18")).toBe("North East");
      expect(resolveZoneFromState("Meghalaya")).toBe("North East");
      expect(resolveZoneFromState("Manipur")).toBe("North East");
      expect(resolveZoneFromState("Mizoram")).toBe("North East");
      expect(resolveZoneFromState("Nagaland")).toBe("North East");
      expect(resolveZoneFromState("Tripura")).toBe("North East");
      expect(resolveZoneFromState("Arunachal Pradesh")).toBe("North East");
      expect(resolveZoneFromState("Sikkim")).toBe("North East");
    });

    it("handles unknown or empty inputs gracefully", () => {
      expect(resolveZoneFromState("")).toBe("");
      expect(resolveZoneFromState(undefined)).toBe("");
      expect(resolveZoneFromState("UnknownCountryProvince")).toBe("");
    });
  });

  describe("Postal Code, State and Zone Alignment Scenarios", () => {
    it("verifies every state in INDIAN_STATE_CITY_PIN_DATA resolves to a recognized zone", () => {
      const states = Object.keys(INDIAN_STATE_CITY_PIN_DATA);
      expect(states.length).toBeGreaterThan(30);

      for (const state of states) {
        const zone = resolveZoneFromState(state);
        expect(INDIAN_ZONES).toContain(zone);
      }
    });

    it("simulates postal code auto-resolution setting state and zone", () => {
      // Address starting with empty location fields
      const address: CustomerAddressEntry = {
        code: "001",
        contactPerson: "Gokul Confectionery",
        addressType: "mailing",
        storeCode: "",
        billingStoreCode: "",
        shippingStoreCode: "",
        address1: "Shop 12, Link Road",
        address2: "",
        address3: "",
        address4: "",
        address5: "",
        locality: "",
        city: "",
        postalCode: "",
        state: "",
        zone: "",
        country: "India",
        officePhone: "",
        homePhone: "",
        mobilePhone: "",
        faxNumber: "",
        email1: "",
        email2: "",
        email3: "",
        isDefault: true,
      };

      // User selects or enters PIN 400067 (Kandivali, Mumbai)
      const pinRecord = {
        postal_code: "400067",
        locality: "Kandivali RS SO",
        city: "MUMBAI SUBURBAN",
        state_name: "Maharashtra",
        state_code: "MH",
        zone: "West",
      };

      const resolvedState = pinRecord.state_name;
      const resolvedZone = pinRecord.zone || resolveZoneFromState(resolvedState);

      const updatedAddress = {
        ...address,
        postalCode: pinRecord.postal_code,
        locality: pinRecord.locality,
        city: pinRecord.city,
        state: resolvedState,
        zone: resolvedZone,
      };

      expect(updatedAddress.postalCode).toBe("400067");
      expect(updatedAddress.state).toBe("Maharashtra");
      expect(updatedAddress.zone).toBe("West");
      expect(updatedAddress.city).toBe("MUMBAI SUBURBAN");
    });

    it("simulates state change auto-syncing zone and detecting PIN mismatch", () => {
      // Address set to Mumbai, Maharashtra, West Zone
      const currentAddress: CustomerAddressEntry = {
        code: "001",
        contactPerson: "Test Customer",
        addressType: "mailing",
        storeCode: "",
        billingStoreCode: "",
        shippingStoreCode: "",
        address1: "Line 1",
        address2: "",
        address3: "",
        address4: "",
        address5: "",
        locality: "",
        city: "Mumbai",
        postalCode: "400067",
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
        isDefault: true,
      };

      // User manually changes state to "Uttar Pradesh"
      const newState = "Uttar Pradesh";
      const newZone = resolveZoneFromState(newState);

      expect(newZone).toBe("North");

      // Check if existing PIN (400067) belongs to newState
      const expectedPinState = "Maharashtra";
      const isMismatch = newState.toLowerCase() !== expectedPinState.toLowerCase();

      expect(isMismatch).toBe(true);

      // Verify that after updating, the zone reflects North for UP
      const updated = {
        ...currentAddress,
        state: newState,
        zone: newZone,
      };

      expect(updated.state).toBe("Uttar Pradesh");
      expect(updated.zone).toBe("North");
    });
  });
});
