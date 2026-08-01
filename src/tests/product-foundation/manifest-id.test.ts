import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const foundationRoot = path.join(repoRoot, "src/product-foundation");

function walkManifests(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const manifests: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      manifests.push(...walkManifests(fullPath));
    } else if (entry.isFile() && entry.name === "manifest.json") {
      manifests.push(fullPath);
    }
  }

  return manifests;
}

describe("product foundation manifest ids", () => {
  it("uses stable immutable capability ids for published manifests", () => {
    const manifests = walkManifests(foundationRoot);
    const ids = manifests.map((manifestPath) => JSON.parse(fs.readFileSync(manifestPath, "utf8")).id);

    expect(ids).toEqual(expect.arrayContaining(["commerce.pricing", "finance.gst", "workflow.approval", "inventory.stock-ledger"]));
  });
});
