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

function buildDependencyGraph(manifests: any[]) {
  const graph = new Map<string, string[]>();
  for (const manifest of manifests) {
    graph.set(manifest.id, runtimeDependencies(manifest));
  }
  return graph;
}

function hasCycle(graph: Map<string, string[]>): boolean {
  const visited = new Set<string>();
  const stack = new Set<string>();

  function visit(node: string): boolean {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    stack.add(node);

    const edges = graph.get(node) || [];
    for (const neighbor of edges) {
      if (visit(neighbor)) return true;
    }

    stack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (visit(node)) return true;
  }

  return false;
}

describe("manifest dependency validation", () => {
  it("detects cycles in dependsOn relationships", () => {
    const manifests = walkManifests(foundationRoot).map(readManifest);
    const graph = buildDependencyGraph(manifests);
    expect(hasCycle(graph)).toBe(false);
  });
});
