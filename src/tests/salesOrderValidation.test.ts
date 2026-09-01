import { describe, it, expect } from "vitest";
import { validateSalesOrderItems } from "../utils/salesOrderValidation";

describe("Sales order validation", () => {
  it("blocks blank or unresolved item rows before save", () => {
    const result = validateSalesOrderItems([
      {
        id: "line-1",
        stockNo: "ABC123",
        description: "",
        rate: 100,
        quantity: 2,
        value: 200,
        total: 200,
      },
    ]);

    expect(result).toContain("Item 1");
    expect(result).toContain("not found in the database");
  });

  it("accepts a complete database-backed item row", () => {
    const result = validateSalesOrderItems([
      {
        id: "line-1",
        stockNo: "ABC123",
        description: "Premium Cotton Shirt",
        rate: 100,
        quantity: 2,
        value: 200,
        total: 200,
      },
    ]);

    expect(result).toBeNull();
  });
});
