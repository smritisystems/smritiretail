import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { EcommerceStudioTab } from "../components/ecommerce/EcommerceStudioTab";

describe("EcommerceStudioTab", () => {
  it("renders the ecommerce studio shell", () => {
    const html = renderToStaticMarkup(<EcommerceStudioTab />);

    expect(html).toContain("Unified Commerce Studio");
    expect(html).toContain("B2C E-Commerce");
    expect(html).toContain("Marketplace");
  });
});
