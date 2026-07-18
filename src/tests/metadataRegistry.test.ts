import { describe, expect, it, beforeEach } from "vitest";
import { MetadataRegistry, type ModuleMetadata } from "../services/metadataRegistry.ts";

const sampleMetadata: ModuleMetadata = {
  id: "test-module",
  name: "Test Module",
  version: "v1.0",
  owner: "Test Owner",
  description: "A test module.",
};

describe("MetadataRegistry", () => {
  beforeEach(() => {
    MetadataRegistry.clear();
  });

  it("registers and returns module metadata", () => {
    MetadataRegistry.registerModule(sampleMetadata);
    const module = MetadataRegistry.getModule("test-module");

    expect(module).toEqual(sampleMetadata);
    expect(MetadataRegistry.getModules()).toHaveLength(1);
  });

  it("returns undefined for missing module ids", () => {
    expect(MetadataRegistry.getModule("missing")).toBeUndefined();
  });

  it("prevents duplicate registration with different metadata", () => {
    MetadataRegistry.registerModule(sampleMetadata);
    expect(() => {
      MetadataRegistry.registerModule({
        ...sampleMetadata,
        version: "v1.1",
      });
    }).toThrowError(/already registered with different metadata/);
  });

  it("allows repeat registration of identical metadata", () => {
    MetadataRegistry.registerModule(sampleMetadata);
    expect(() => MetadataRegistry.registerModule(sampleMetadata)).not.toThrow();
    expect(MetadataRegistry.getModules()).toHaveLength(1);
  });

  it("notifies subscribers when metadata changes", () => {
    let updates = 0;
    const unsubscribe = MetadataRegistry.subscribe(() => {
      updates += 1;
    });

    MetadataRegistry.registerModule(sampleMetadata);
    expect(updates).toBe(1);

    MetadataRegistry.clear();
    expect(updates).toBe(2);

    unsubscribe();
    MetadataRegistry.registerModule(sampleMetadata);
    expect(updates).toBe(2);
  });
});
