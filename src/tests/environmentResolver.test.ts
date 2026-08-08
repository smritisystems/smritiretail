import { describe, it, expect } from "vitest";
import { EnvironmentResolver } from "../kernel/config/EnvironmentResolver.ts";

describe("EnvironmentResolver Architecture (Rule PROD-004 & PROD-005 Compliance)", () => {
  it("resolves localhost + development to DEVELOPMENT mode with dev credentials allowed", () => {
    const env = EnvironmentResolver.resolve({
      hostname: "127.0.0.1",
      viteEnv: "development"
    });

    expect(env.mode).toBe("DEVELOPMENT");
    expect(env.databaseName).toBe("smriti_dev");
    expect(env.badgeLabel).toBe("LOCAL STANDALONE");
    expect(env.isProduction).toBe(false);

    const showDev = EnvironmentResolver.shouldShowDevCredentials(env);
    expect(showDev).toBe(true);
  });

  it("resolves localhost + explicit production backend override to PRODUCTION mode and hides dev credentials", () => {
    const env = EnvironmentResolver.resolve({
      hostname: "localhost",
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

  it("guarantees dev credentials are NEVER rendered in production regardless of URL or flags", () => {
    const prodEnv1 = EnvironmentResolver.resolve({ hostname: "127.0.0.1", localOverride: "production" });
    const prodEnv2 = EnvironmentResolver.resolve({ backendEnvType: "PRODUCTION" });
    const prodEnv3 = EnvironmentResolver.resolve({ hostname: "production-app.com" });

    expect(EnvironmentResolver.shouldShowDevCredentials(prodEnv1)).toBe(false);
    expect(EnvironmentResolver.shouldShowDevCredentials(prodEnv2)).toBe(false);
    expect(EnvironmentResolver.shouldShowDevCredentials(prodEnv3)).toBe(false);
  });
});
