import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StoreDayTenderVarianceCard } from "../components/billing/propos/ProPosStoreDayPanel";

describe("Store Day tender reconciliation", () => {
  it("does not present a total when some assigned shifts lack terminal reconciliation", () => {
    const markup = renderToStaticMarkup(
      <StoreDayTenderVarianceCard
        label="Card settlement reconciliation"
        variance={null}
        reconciledShifts={1}
        assignedShifts={2}
      />
    );

    expect(markup).toContain("Verified for 1 of 2 assigned shifts");
    expect(markup).toContain("Total difference is hidden");
    expect(markup).not.toContain("Total difference:");
  });

  it("shows a total difference when every assigned shift is reconciled", () => {
    const markup = renderToStaticMarkup(
      <StoreDayTenderVarianceCard
        label="UPI settlement reconciliation"
        variance="-5.50"
        reconciledShifts={2}
        assignedShifts={2}
      />
    );

    expect(markup).toContain("Total difference:");
    expect(markup).toContain("-₹5.50");
    expect(markup).toContain("Variance detected");
  });
});
