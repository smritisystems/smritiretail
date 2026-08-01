import { describe, it, expect } from "vitest";
import PlatformKernelValidator from "../kernel/PlatformKernelValidator.js";

describe("Runtime: Platform Kernel Validation", () => {
  it("should validate kernel metadata and policies without errors", () => {
    const validation = PlatformKernelValidator.validate();
    expect(validation.valid).toBe(true);
  });
});
