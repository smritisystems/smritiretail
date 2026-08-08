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

function readManifest(manifestPath: string) {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function runtimeDependencies(manifest: any): string[] {
  if (Array.isArray(manifest.dependencies)) {
    return manifest.dependencies;
  }
  return manifest.dependencies?.runtime ?? manifest.dependsOn ?? [];
}

describe("product foundation dependency graph", () => {
  it("validates runtime dependency categories and consumedBy declarations", () => {
    const manifests = walkManifests(foundationRoot).map(readManifest);
    const ids = manifests.map((manifest) => manifest.id);

    for (const manifest of manifests) {
      expect(Array.isArray(manifest.dependsOn)).toBe(true);
      expect(Array.isArray(manifest.consumedBy)).toBe(true);
      expect(Array.isArray(runtimeDependencies(manifest))).toBe(true);
      expect(manifest.dependsOn).toEqual(expect.arrayContaining(runtimeDependencies(manifest)));
      expect(runtimeDependencies(manifest)).toEqual(expect.arrayContaining(manifest.dependsOn));

      for (const dependency of runtimeDependencies(manifest)) {
        expect(ids).toContain(dependency);
      }
    }
  });
});
