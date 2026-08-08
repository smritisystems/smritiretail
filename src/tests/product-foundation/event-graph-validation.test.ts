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

const validEventLifecycleStates = new Set(["Register", "Publishable", "Deprecated", "Retired"]);

describe("event graph validation", () => {
  it("ensures publishes and subscribes reference valid event names and lifecycle states", () => {
    const manifests = walkManifests(foundationRoot).map(readManifest);
    const publishedEvents = new Set<string>();
    const retiredEvents = new Set<string>();

    for (const manifest of manifests) {
      const lifecycle = manifest.events?.lifecycle ?? {};
      for (const [eventName, state] of Object.entries(lifecycle)) {
        expect(validEventLifecycleStates.has(state as string)).toBe(true);
      }

      for (const eventName of manifest.events?.publishes || []) {
        publishedEvents.add(eventName);
        if (lifecycle[eventName] === "Retired") {
          retiredEvents.add(eventName);
        }
      }
    }

    for (const manifest of manifests) {
      for (const eventName of manifest.events?.subscribes || []) {
        expect(publishedEvents.has(eventName)).toBe(true);
        expect(retiredEvents.has(eventName)).toBe(false);
      }
    }
  });
});
