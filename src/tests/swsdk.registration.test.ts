import { beforeEach, describe, expect, it } from "vitest";
import { WorkspaceRegistry, type WorkspaceBundle } from "../sdk/swsdk/runtime/WorkspaceRegistry.js";
import { createRegistrationSignature, type RegistrationManifest } from "../sdk/swsdk/runtime/RegistrationService.js";

describe("SWSDK workspace registration", () => {
  beforeEach(() => {
    WorkspaceRegistry.getInstance().clear();
  });

  const bundle: WorkspaceBundle = {
    manifest: {
      schemaVersion: "1.0",
      workspaceId: "demo.workspace",
      title: "Demo Workspace",
      module: "Platform",
      icon: "cube",
      route: "/demo",
      category: "Operations",
      supports: {
        drafts: false,
        resume: false,
        tabs: true,
        attachments: false,
        workflow: false,
        timeline: false,
        print: false,
        export: false,
        analytics: false,
        barcode: false,
        notifications: false
      }
    },
    capabilities: {
      schemaVersion: "1.0",
      workspaceId: "demo.workspace",
      capabilities: ["analytics"]
    }
  };

  const validRegistration = (): RegistrationManifest => {
    const registration: RegistrationManifest = {
      workspaceId: "demo.workspace",
      manifestVersion: "1.0",
      registeredAt: "2026-08-01T00:00:00.000Z",
      publisher: "smriti-platform",
      signature: {
        algorithm: "sha256",
        value: "",
        key: "test-secret"
      },
      compatibility: {
        constitution: "1.x",
        spc: "1.x",
        sdk: "1.x",
        designSystem: "1.x"
      }
    };
    registration.signature.value = createRegistrationSignature(registration);
    return registration;
  };

  it("accepts a valid registration manifest and persists registration state", () => {
    const registry = WorkspaceRegistry.getInstance();
    const registration = validRegistration();

    const result = registry.registerWorkspace(bundle, registration);

    expect(result.valid).toBe(true);
    expect(result.stage).toBe("Registration");
    expect(registry.getRegistrationRecord("demo.workspace")?.status).toBe("registered");
    expect(registry.getRegistrationRecord("demo.workspace")?.manifest.publisher).toBe("smriti-platform");
  });

  it("rejects a manifest whose signature does not match the canonical payload", () => {
    const registry = WorkspaceRegistry.getInstance();
    const registration = validRegistration();
    registration.signature.value = "deadbeef";

    const result = registry.registerWorkspace(bundle, registration);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("Signature Validation Failed"))).toBe(true);
  });

  it("rejects incompatible compatibility metadata", () => {
    const registry = WorkspaceRegistry.getInstance();
    const registration = validRegistration();
    registration.compatibility.spc = "2.0";

    const result = registry.registerWorkspace(bundle, registration);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("Compatibility Validation Failed"))).toBe(true);
  });
});
