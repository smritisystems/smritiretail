import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { EcommerceStudioTab } from "../components/ecommerce/EcommerceStudioTab";

describe("EcommerceStudioTab", () => {
  it("renders the commerce studio shell with channels", () => {
    const html = renderToStaticMarkup(createElement(EcommerceStudioTab));

    expect(html).toContain("Unified Commerce Studio");
    expect(html).toContain("Retail POS");
    expect(html).toContain("B2C E-Commerce");
    expect(html).toContain("Marketplace");
  });
});
