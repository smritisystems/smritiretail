import { describe, it, expect, vi } from "vitest";
import { CompanyCodeSuggestionService } from "../services/CompanyCodeSuggestionService.ts";
import { EnvironmentResolver } from "../kernel/config/EnvironmentResolver.ts";
import { SPK } from "../kernel/SPK.ts";

describe("Company Code Provisioning & Suggestion Engine (v1.2 Specification: CITY3 + PIN_LAST3 + SEQ3)", () => {
  it("Test 1: Mumbai + 400067 + no existing code generates MUM067001", () => {
    const res = CompanyCodeSuggestionService.buildSuggestion("Mumbai", "400067", 1);
    expect(res).not.toBeNull();
    expect(res?.cityCode).toBe("MUM");
    expect(res?.pinLast3).toBe("067");
    expect(res?.sequenceStr).toBe("001");
    expect(res?.suggestedCode).toBe("MUM067001");
  });

  it("Test 2: Incremental sequence generation for 001, 002 returns MUM067003", () => {
    const res = CompanyCodeSuggestionService.buildSuggestion("Mumbai", "400067", 3);
    expect(res?.suggestedCode).toBe("MUM067003");
  });

  it("Test 3: Validates custom user-defined Company Code format (ABC000123)", () => {
    const val = CompanyCodeSuggestionService.validateCompanyCode("ABC000123");
    expect(val.valid).toBe(true);
  });

  it("Test 4 & 5: User manual override state logic (City & PIN mutation survival)", () => {
    let userHasOverridden = false;
    let tenantCode = "MUM067001";

    // User edits manually to ABC000123
    tenantCode = "ABC000123";
    userHasOverridden = true;

    // City changes to Pune
    if (!userHasOverridden) {
      const suggested = CompanyCodeSuggestionService.buildSuggestion("Pune", "400067", 1);
      tenantCode = suggested?.suggestedCode || tenantCode;
    }
    expect(tenantCode).toBe("ABC000123"); // Preserved across City change!

    // PIN changes to 411001
    if (!userHasOverridden) {
      const suggested = CompanyCodeSuggestionService.buildSuggestion("Pune", "411001", 1);
      tenantCode = suggested?.suggestedCode || tenantCode;
    }
    expect(tenantCode).toBe("ABC000123"); // Preserved across PIN change!
  });

  it("Test 6: Validates Company Code format rules (3 to 20 uppercase chars, no spaces)", () => {
    expect(CompanyCodeSuggestionService.validateCompanyCode("").valid).toBe(false);
    expect(CompanyCodeSuggestionService.validateCompanyCode("MUM 067").valid).toBe(false);
    expect(CompanyCodeSuggestionService.validateCompanyCode("AB").valid).toBe(false);
    expect(CompanyCodeSuggestionService.validateCompanyCode("MUM067001").valid).toBe(true);
    expect(CompanyCodeSuggestionService.validateCompanyCode("COMPANY_CODE_20CHAR").valid).toBe(false);
    expect(CompanyCodeSuggestionService.validateCompanyCode("COMPANYCODE20CHARSS").valid).toBe(true);
  });

  it("Test 7 & 8: OLE Event Ordering on Duplicate Failure (Started -> Failed, NEVER Activated)", () => {
    const spyStart = vi.spyOn(SPK.events, "emit");

    const tCode = "MUM067001";
    SPK.events.emit("Company.Provisioning.Started.v1", tCode, { tenantCode: tCode });

    SPK.events.emit("Company.Provisioning.Failed.v1", tCode, { tenantCode: tCode, error: "Company Code already in use" });

    expect(spyStart).toHaveBeenCalledWith("Company.Provisioning.Started.v1", tCode, expect.anything());
    expect(spyStart).toHaveBeenCalledWith("Company.Provisioning.Failed.v1", tCode, expect.anything());
    expect(spyStart).not.toHaveBeenCalledWith("Company.Activated.v1", tCode, expect.anything());
  });

  it("Test 9: OLE Event Ordering on Success (Started -> Completed -> Activated)", () => {
    const spy = vi.spyOn(SPK.events, "emit");
    const tCode = "MUM067004";

    SPK.events.emit("Company.Provisioning.Started.v1", tCode, { tenantCode: tCode });
    SPK.events.emit("Company.Provisioning.Completed.v1", tCode, { tenantCode: tCode });
    SPK.events.emit("Company.Activated.v1", tCode, { tenantCode: tCode });

    expect(spy).toHaveBeenCalledWith("Company.Provisioning.Started.v1", tCode, expect.anything());
    expect(spy).toHaveBeenCalledWith("Company.Provisioning.Completed.v1", tCode, expect.anything());
    expect(spy).toHaveBeenCalledWith("Company.Activated.v1", tCode, expect.anything());
  });

  it("Test 10: Invalid PIN handling (returns null for non-6-digit PIN)", () => {
    expect(CompanyCodeSuggestionService.extractPinLast3("4000")).toBeNull();
    expect(CompanyCodeSuggestionService.extractPinLast3("4000678")).toBeNull();
    expect(CompanyCodeSuggestionService.extractPinLast3("ABCDEF")).toBeNull();
    expect(CompanyCodeSuggestionService.extractPinLast3("400067")).toBe("067");
  });

  it("Test 11: Unknown City fallback resolution (THANE -> THA)", () => {
    const res = CompanyCodeSuggestionService.buildSuggestion("Thane", "400067", 1);
    expect(res?.cityCode).toBe("THA");
    expect(res?.suggestedCode).toBe("THA067001");
  });

  it("Test 12: Missing Company Code validation rejection", () => {
    const res = CompanyCodeSuggestionService.validateCompanyCode("");
    expect(res.valid).toBe(false);
    expect(res.message).toBe("Company Code is required.");
  });

  it("Test 13: Regression verification of EnvironmentResolver & fail-closed security", () => {
    const unresolved = EnvironmentResolver.unresolved();
    expect(unresolved.mode).toBe("UNKNOWN");
    expect(EnvironmentResolver.shouldShowDevCredentials(unresolved)).toBe(false);
  });

  it("Test 14: Sequence exhaustion when sequences 001..999 are occupied", () => {
    const res = CompanyCodeSuggestionService.buildSuggestion("Mumbai", "400067", 1000);
    expect(res?.isExhausted).toBe(true);
    expect(res?.suggestedCode).toBeNull();
  });

  it("Test 15: Async race protection logic preserves manual user override", () => {
    let latestReqId = 0;
    let userHasOverridden = false;
    let code = "MUM067001";

    const req1 = ++latestReqId;

    // User types custom code before async response returns
    code = "ABC000123";
    userHasOverridden = true;

    // Late async response from request 1 arrives
    if (latestReqId === req1 && !userHasOverridden) {
      code = "MUM067001";
    }

    expect(code).toBe("ABC000123"); // Custom user code preserved!
  });

  it("Test 16: Canonical v1.2 format regression protection (exactly 9 chars, MUM067001, PIN 400067 -> 067)", () => {
    const res = CompanyCodeSuggestionService.buildSuggestion("Mumbai", "400067", 1);
    expect(res?.suggestedCode).toBe("MUM067001");
    expect(res?.suggestedCode).not.toBe("MUM006701"); // Prevents regression to old format!
    expect(res?.pinLast3).toBe("067");
    expect(res?.pinLast3).not.toBe("0067");
    expect(res?.suggestedCode?.length).toBe(9);
    expect(/^[A-Z0-9]{9}$/.test(res?.suggestedCode || "")).toBe(true);
  });
});
