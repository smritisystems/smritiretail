import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const capabilityRoot = path.join(repoRoot, "src/product-foundation");
const manifestPath = path.join(capabilityRoot, "CAPABILITY_CATALOG.json");

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

describe("product foundation manifest validation", () => {
  it("requires every capability to be represented in the catalog", () => {
    const catalog = readJson(manifestPath);
    const capabilityNames = catalog.modules.flatMap((module: any) => module.capabilities.map((capability: any) => capability.name));

    expect(capabilityNames.length).toBeGreaterThan(0);
    expect(capabilityNames).toContain("pricing");
    expect(capabilityNames).toContain("gst");
  });

  it("allows only valid release rings", () => {
    const catalog = readJson(manifestPath);
    const validRings = ["Experimental", "Pilot", "General Availability", "Foundation Standard"];

    for (const module of catalog.modules) {
      for (const capability of module.capabilities) {
        expect(validRings).toContain(capability.releaseRing);
      }
    }
  });

  it("keeps capability ownership unique per module", () => {
    const catalog = readJson(manifestPath);

    for (const module of catalog.modules) {
      const owners = new Set(module.capabilities.map((capability: any) => capability.owner));
      expect(owners.size).toBeLessThanOrEqual(1);
    }
  });
});
