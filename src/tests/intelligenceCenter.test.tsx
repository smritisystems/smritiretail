/** @vitest-environment jsdom */

/**
 * Project      : SMRITI Retail OS
 * Module       : Intelligence Center Workspace Unit Test Suite
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React from "react";
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { IntelligenceCenterWorkspace } from "../studio/intelligence/dashboard/IntelligenceCenterWorkspace.tsx";
import { SPK } from "../kernel/SPK.ts";

describe("IntelligenceCenterWorkspace (Developer Studio UI)", () => {
  it("should calculate and render platform integrity scorecard metrics", () => {
    const scorecard = SPK.navigation.auditPlatformIntegrity();
    expect(scorecard).toBeDefined();
    expect(scorecard.categories.length).toEqual(13);
    expect(scorecard.overallScore).toBeGreaterThan(0);
  });

  it("should render IntelligenceCenterWorkspace component without crashing", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<IntelligenceCenterWorkspace />);
    });

    expect(container.textContent).toContain("SMRITI Intelligence Center");
    expect(container.textContent).toContain("Capability Discovery Engine");
  });
});
