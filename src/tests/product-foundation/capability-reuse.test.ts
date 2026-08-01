import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const catalogPath = path.join(repoRoot, "src/product-foundation/CAPABILITY_CATALOG.json");

function readCatalog() {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

describe("product foundation capability reuse", () => {
  it("marks shared capabilities as reused by more than one studio", () => {
    const catalog = readCatalog();
    const shared = catalog.modules
      .flatMap((module: any) => module.capabilities)
      .filter((capability: any) => capability.studios.length >= 2);

    expect(shared.length).toBeGreaterThan(0);
  });

  it("tracks at least one capability in the product foundation core modules", () => {
    const catalog = readCatalog();
    const capabilityNames = catalog.modules.flatMap((module: any) => module.capabilities.map((capability: any) => capability.name));

    expect(capabilityNames).toEqual(expect.arrayContaining(["pricing", "gst", "approval", "stock-ledger"]));
  });
});
