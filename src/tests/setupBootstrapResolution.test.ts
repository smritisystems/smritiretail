import { describe, expect, it } from "vitest";
import { resolveSetupCompletionStatus } from "../utils/setupBootstrap";

describe("resolveSetupCompletionStatus", () => {
  it("keeps the user in the last known good workspace when the local setup flag is already completed", () => {
    expect(resolveSetupCompletionStatus(true, false)).toBe(true);
  });

  it("returns false only when both the local cache and the remote status are incomplete", () => {
    expect(resolveSetupCompletionStatus(false, false)).toBe(false);
  });
});
