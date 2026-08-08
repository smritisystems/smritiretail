import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { EcommerceStudioTab } from "./EcommerceStudioTab";

describe("EcommerceStudioTab", () => {
  it("renders the ecommerce studio shell", () => {
    const html = renderToStaticMarkup(<EcommerceStudioTab />);

    expect(html).toContain("E-Commerce Studio");
    expect(html).toContain("Order Management");
    expect(html).toContain("Storefront & Catalog");
  });
});
