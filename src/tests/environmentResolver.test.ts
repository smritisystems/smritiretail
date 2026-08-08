import { describe, it, expect } from "vitest";
import { EnvironmentResolver } from "../kernel/config/EnvironmentResolver.ts";

describe("EnvironmentResolver Architecture (Rule PROD-004 & PROD-005 Compliance)", () => {
  it("initializes in UNKNOWN unresolved state with dev credentials HIDDEN (Fail-Closed Initial State)", () => {
    const unresolved = EnvironmentResolver.unresolved();

    expect(unresolved.mode).toBe("UNKNOWN");
    expect(unresolved.badgeLabel).toBe("RESOLVING...");
    expect(unresolved.isProduction).toBe(false);

    const showDev = EnvironmentResolver.shouldShowDevCredentials(unresolved);
    expect(showDev).toBe(false);
  });

  it("resolves localhost + development backend to DEVELOPMENT mode with dev credentials allowed AFTER resolution", () => {
    const env = EnvironmentResolver.resolve({
      hostname: "127.0.0.1",
      backendEnvType: "DEVELOPMENT",
      viteEnv: "development"
    });

    expect(env.mode).toBe("DEVELOPMENT");
    expect(env.databaseName).toBe("smriti_dev");
    expect(env.isProduction).toBe(false);

    const showDev = EnvironmentResolver.shouldShowDevCredentials(env);
    expect(showDev).toBe(true);
  });

  it("resolves localhost + PRODUCTION backend to PRODUCTION mode and hides dev credentials (eliminated split-brain)", () => {
    const env = EnvironmentResolver.resolve({
      hostname: "127.0.0.1",
      backendEnvType: "PRODUCTION",
      backendDbName: "smriti_prod"
    });

    expect(env.mode).toBe("PRODUCTION");
    expect(env.databaseName).toBe("smriti_prod");
    expect(env.badgeLabel).toBe("PRODUCTION");
    expect(env.isProduction).toBe(true);

    const showDev = EnvironmentResolver.shouldShowDevCredentials(env);
    expect(showDev).toBe(false);
  });

  it("resolves staging domain to STAGING mode and hides dev credentials", () => {
    const env = EnvironmentResolver.resolve({
      hostname: "staging.smritibooks.com",
      backendEnvType: "STAGING"
    });

    expect(env.mode).toBe("STAGING");
    expect(env.databaseName).toBe("smriti_staging");
    expect(env.badgeLabel).toBe("STAGING");
    expect(env.isProduction).toBe(false);

    const showDev = EnvironmentResolver.shouldShowDevCredentials(env);
    expect(showDev).toBe(false);
  });

  it("resolves production domain to PRODUCTION mode and hides dev credentials", () => {
    const env = EnvironmentResolver.resolve({
      hostname: "app.smritibooks.com",
      viteEnv: "production"
    });

    expect(env.mode).toBe("PRODUCTION");
    expect(env.databaseName).toBe("smriti_prod");
    expect(env.badgeLabel).toBe("PRODUCTION");
    expect(env.isProduction).toBe(true);

    const showDev = EnvironmentResolver.shouldShowDevCredentials(env);
    expect(showDev).toBe(false);
  });

  it("enforces fail-closed security rule: dev credentials HIDDEN when environment is UNKNOWN, null, or non-DEV", () => {
    const unknownEnv = EnvironmentResolver.unresolved();

    expect(EnvironmentResolver.shouldShowDevCredentials(unknownEnv)).toBe(false);
    expect(EnvironmentResolver.shouldShowDevCredentials(null as any)).toBe(false);
    expect(EnvironmentResolver.shouldShowDevCredentials(undefined as any)).toBe(false);
  });

  it("guarantees dev credentials are NEVER rendered under production backend regardless of hostname", () => {
    const prodEnvLocal = EnvironmentResolver.resolve({ hostname: "127.0.0.1", backendEnvType: "PRODUCTION" });
    const prodEnvOverride = EnvironmentResolver.resolve({ hostname: "localhost", localOverride: "production" });
    const prodEnvRemote = EnvironmentResolver.resolve({ hostname: "production-app.com", backendEnvType: "PRODUCTION" });

    expect(EnvironmentResolver.shouldShowDevCredentials(prodEnvLocal)).toBe(false);
    expect(EnvironmentResolver.shouldShowDevCredentials(prodEnvOverride)).toBe(false);
    expect(EnvironmentResolver.shouldShowDevCredentials(prodEnvRemote)).toBe(false);
  });
});
