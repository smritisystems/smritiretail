import { test, expect } from "vitest";
import { initializePostgres } from "../db/init";

test("trigger db seeding", async () => {
  console.log("Triggering database initialization and seeding...");
  await initializePostgres();
  expect(true).toBe(true);
}, 60000);
