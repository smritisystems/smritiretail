import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const catalogPath = path.join(repoRoot, "src/product-foundation/CAPABILITY_CATALOG.json");

function readCatalog() {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

describe("product foundation release rings", () => {
  it("keeps the catalog aligned to the supported rollout rings", () => {
    const catalog = readCatalog();
    const rings = new Set<string>();
    const validRings = ["Experimental", "Pilot", "General Availability", "Foundation Standard"];

    for (const module of catalog.modules) {
      for (const capability of module.capabilities) {
        rings.add(capability.releaseRing);
      }
    }

    expect(rings.size).toBeGreaterThan(0);
    for (const ring of rings) {
      expect(validRings).toContain(ring);
    }
  });
});
