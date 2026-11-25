/**
 * Project      : SMRITI Retail OS
 * Author       : SMRITI Systems
 * Classification: Guided usability tests
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuidedHome } from "../components/dashboard/GuidedHome.tsx";
import { GuidedSetupWizard } from "../components/SetupWizard/GuidedSetupWizard.tsx";
import { PlainLanguageHelp } from "../components/common/PlainLanguageHelp.tsx";

vi.mock("../lib/apiFetchV1.ts", () => ({
  apiFetchV1: vi.fn(),
}));

describe("guided nontechnical usability", () => {
  it("shows plain role actions for cashiers", () => {
    const markup = renderToStaticMarkup(
      <GuidedHome currentUser={{ role: "CASHIER", name: "Kishore" }} onNavigateTab={() => {}} />,
    );
    expect(markup).toContain("Welcome, Kishore");
    expect(markup).toContain("Sell items");
    expect(markup).toContain("Close counter");
    expect(markup).toContain("Unpaid on today");
  });

  it("shows relevant tasks for inventory managers without cashier shortcuts", () => {
    const markup = renderToStaticMarkup(
      <GuidedHome currentUser={{ role: "INVENTORY_MANAGER", name: "Ravi" }} />,
    );
    expect(markup).toContain("Receive goods");
    expect(markup).toContain("Check stock");
    expect(markup).not.toContain("Sell items");
  });

  it("normalizes display role names and avoids cashier fallbacks for unknown roles", () => {
    const storeManager = renderToStaticMarkup(
      <GuidedHome currentUser={{ role: "Store Manager", name: "Mina" }} />,
    );
    expect(storeManager).toContain("Review staff");

    const unknownRole = renderToStaticMarkup(
      <GuidedHome currentUser={{ role: "UNMAPPED_ROLE", name: "Sam" }} />,
    );
    expect(unknownRole).toContain("Quick tasks are not set up for your role yet");
    expect(unknownRole).not.toContain("Sell items");
  });

  it("starts setup with human-oriented questions", () => {
    const markup = renderToStaticMarkup(<GuidedSetupWizard />);
    expect(markup).toContain("Get your shop ready");
    expect(markup).toContain("What is your shop called?");
  });

  it("provides plain-language explanations", () => {
    const markup = renderToStaticMarkup(<PlainLanguageHelp />);
    expect(markup).toContain("Help");
  });
});
