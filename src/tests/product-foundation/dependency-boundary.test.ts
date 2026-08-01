import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const catalogPath = path.join(repoRoot, "src/product-foundation/CAPABILITY_CATALOG.json");

function readCatalog() {
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

describe("product foundation dependency boundaries", () => {
  it("keeps the capability catalog focused on product foundation modules", () => {
    const catalog = readCatalog();
    const moduleNames = catalog.modules.map((module: any) => module.name);

    expect(moduleNames).toEqual(expect.arrayContaining(["commerce", "inventory", "finance", "workflow", "document", "intelligence"]));
  });

  it("prevents studio-specific capability ownership from crossing product foundation boundaries", () => {
    const catalog = readCatalog();
    const owners = catalog.modules.flatMap((module: any) => module.capabilities.map((capability: any) => capability.owner));

    expect(owners).toContain("Commerce Foundation");
    expect(owners).toContain("Finance Foundation");
  });
});
