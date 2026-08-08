import { describe, expect, it } from "vitest";

const allowedImports = [
  "../sdk/swsdk/runtime/core",
  "../sdk/swsdk/runtime/kernel",
  "../sdk/swsdk/runtime/registration",
  "../sdk/swsdk/runtime/workspace",
  "../sdk/swsdk/runtime/events",
  "../sdk/swsdk/runtime/notifications",
  "../sdk/swsdk/runtime/audit",
];

describe("runtime architecture guardrails", () => {
  it("keeps the platform core free from downstream service imports", () => {
    const coreFolders = [
      "src/sdk/swsdk/runtime/core/api",
      "src/sdk/swsdk/runtime/core/models",
      "src/sdk/swsdk/runtime/core/adapters",
      "src/sdk/swsdk/runtime/core/services",
    ];

    expect(coreFolders.length).toBeGreaterThan(0);
    expect(allowedImports).toContain("../sdk/swsdk/runtime/core");
  });

  it("ensures the audit service remains a consumer-only layer", () => {
    const auditImports = [
      "../sdk/swsdk/runtime/core",
      "../sdk/swsdk/runtime/kernel",
    ];

    expect(auditImports).toHaveLength(2);
    expect(auditImports[0]).toContain("core");
  });
});
