import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const foundationRoot = path.join(repoRoot, "src/product-foundation");
const requiredFiles = [
  "manifest.json",
  "README.md",
  "api",
  "domain",
  "application",
  "tests",
];

function getCapabilityDirs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name));
}

function isCapabilityDir(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'manifest.json')) && fs.existsSync(path.join(dir, 'README.md'));
}

describe("product foundation engine contract", () => {
  it("ensures every capability uses the standard engine layout", () => {
    const modules = getCapabilityDirs(foundationRoot);
    const capabilities = modules.flatMap(getCapabilityDirs).filter(isCapabilityDir);

    expect(capabilities.length).toBeGreaterThan(0);

    for (const capabilityDir of capabilities) {
      const hasManifest = fs.existsSync(path.join(capabilityDir, "manifest.json"));
      const hasReadme = fs.existsSync(path.join(capabilityDir, "README.md"));
      expect(hasManifest).toBe(true);
      expect(hasReadme).toBe(true);

      for (const required of requiredFiles.slice(2)) {
        expect(fs.existsSync(path.join(capabilityDir, required))).toBe(true);
      }
    }
  });
});
