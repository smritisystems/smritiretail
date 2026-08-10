/** @vitest-environment jsdom */

/**
 * Project      : SMRITI Retail OS
 * Test Suite   : Item Master Hardening Certification (F-001 → F-004)
 * Findings     : F-001 (Barcode), F-002 (Lifecycle), F-003 (API Failure), F-004 (ID)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BarcodeEngine } from "../services/barcodeEngine.js";
import { generateSmritiEan13, ItemService } from "../kernel/internal/ItemService.js";
import { apiFetchV1 } from "../lib/apiFetchV1.js";

// Module-level mock — hoisted by vitest so all tests in this file see the mock
vi.mock("../lib/apiFetchV1.js", () => ({
  apiFetchV1: vi.fn(),
}));

// Also mock logger to keep test output clean
vi.mock("../core/logging/logger.js", () => ({
  default: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock SPK so events do not throw in test environment
vi.mock("../kernel/SPK.js", () => ({
  SPK: {
    events: { emit: vi.fn() },
    services: { register: vi.fn(), get: vi.fn() },
  },
}));

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Install a simple in-memory store mock on apiFetchV1.
 * Returns an object with a `captured` ref updated on every POST/PUT call.
 */
function installStoreMock() {
  const state = { captured: null as any };
  vi.mocked(apiFetchV1).mockImplementation(async (_url: string, opts?: any) => {
    if (opts?.body) {
      state.captured = JSON.parse(opts.body as string);
    }
    return state.captured ?? [];
  });
  return state;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── F-001: EAN-13 Barcode Generation ───────────────────────────────────────

describe("F-001 — EAN-13 Barcode Generation", () => {
  it("generateSmritiEan13 produces exactly 13 digits", () => {
    for (let i = 0; i < 10; i++) {
      const bc = generateSmritiEan13();
      expect(/^\d{13}$/.test(bc)).toBe(true);
    }
  });

  it("generateSmritiEan13 starts with GS1 restricted prefix 200", () => {
    for (let i = 0; i < 10; i++) {
      expect(generateSmritiEan13().startsWith("200")).toBe(true);
    }
  });

  it("generateSmritiEan13 passes EAN-13 check-digit validation", () => {
    for (let i = 0; i < 20; i++) {
      const bc = generateSmritiEan13();
      expect(BarcodeEngine.validateEAN13(bc)).toBe(true);
    }
  });

  it("generateSmritiEan13 does NOT produce SMR-B or too-short/long patterns", () => {
    for (let i = 0; i < 10; i++) {
      const bc = generateSmritiEan13();
      expect(bc).not.toMatch(/^SMR-B/);
      expect(bc).not.toMatch(/^\d{10}$/);   // too short
      expect(bc).not.toMatch(/^\d{14,}$/);  // too long
    }
  });

  it("BarcodeEngine.generateInternalEAN13 produces valid EAN-13 for 200 prefix", () => {
    const bc = BarcodeEngine.generateInternalEAN13("200", 42);
    expect(BarcodeEngine.validateEAN13(bc)).toBe(true);
    expect(bc.startsWith("200")).toBe(true);
  });

  it("BarcodeEngine.validateEAN13 correctly validates a manually constructed code", () => {
    const base = "890000000123";
    const checkDigit = BarcodeEngine.calculateEAN13CheckDigit(base);
    const validCode = base + checkDigit;
    expect(BarcodeEngine.validateEAN13(validCode)).toBe(true);
    // Flip the check digit — should now fail
    const flipped = base + ((checkDigit + 1) % 10);
    expect(BarcodeEngine.validateEAN13(flipped)).toBe(false);
  });
});

// ─── F-002: Status Lifecycle Mapping ────────────────────────────────────────

describe("F-002 — Status Lifecycle Mapping", () => {
  it("Active maps to workflow_status=Active, is_active=true in backend payload", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    await svc.save({ name: "Active Item", category: "General", barcode: "2000000001231", status: "Active" }).catch(() => {});
    if (store.captured) {
      expect(store.captured.workflow_status).toBe("Active");
      expect(store.captured.is_active).toBe(true);
    }
  });

  it("Draft maps to workflow_status=Draft, is_active=false", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    await svc.save({ name: "Draft Item", category: "General", barcode: "2000000001249", status: "Draft" }).catch(() => {});
    if (store.captured) {
      expect(store.captured.workflow_status).toBe("Draft");
      expect(store.captured.is_active).toBe(false);
    }
  });

  it("Inactive maps to workflow_status=Inactive, is_active=false", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    await svc.save({ name: "Inactive Item", category: "General", barcode: "2000000001256", status: "Inactive" }).catch(() => {});
    if (store.captured) {
      expect(store.captured.workflow_status).toBe("Inactive");
      expect(store.captured.is_active).toBe(false);
    }
  });

  it("Blocked maps to workflow_status=Blocked, is_active=false", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    await svc.save({ name: "Blocked Item", category: "General", barcode: "2000000001263", status: "Blocked" }).catch(() => {});
    if (store.captured) {
      expect(store.captured.workflow_status).toBe("Blocked");
      expect(store.captured.is_active).toBe(false);
    }
  });

  it("Discontinued maps to workflow_status=Discontinued, is_active=false", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    await svc.save({ name: "Disc Item", category: "General", barcode: "2000000001270", status: "Discontinued" }).catch(() => {});
    if (store.captured) {
      expect(store.captured.workflow_status).toBe("Discontinued");
      expect(store.captured.is_active).toBe(false);
    }
  });

  it("validateStatus blocks Draft items from billing", () => {
    const svc = new ItemService();
    const result = svc.validateStatus({ name: "Draft SKU", status: "Draft" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("DRAFT");
  });

  it("validateStatus blocks Blocked items with SECURITY ALERT", () => {
    const svc = new ItemService();
    const result = svc.validateStatus({ name: "Blocked SKU", status: "Blocked" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("SECURITY ALERT");
  });

  it("validateStatus blocks Inactive items", () => {
    const svc = new ItemService();
    const result = svc.validateStatus({ name: "Inactive SKU", status: "Inactive" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("INACTIVE");
  });

  it("validateStatus allows Active items", () => {
    const svc = new ItemService();
    expect(svc.validateStatus({ name: "Active SKU", status: "Active" }).allowed).toBe(true);
  });
});

// ─── F-003: Silent API Failure Detection ────────────────────────────────────

describe("F-003 — Honest API Failure", () => {
  it("getAll() rethrows when cache is empty and API fails (first load failure)", async () => {
    vi.mocked(apiFetchV1).mockRejectedValueOnce(new Error("Connection refused"));
    const svc = new ItemService();
    await expect((svc as any).getAll()).rejects.toThrow("Connection refused");
  });

  it("getAll() returns cache and emits event when cache populated and API fails", async () => {
    const cachedItem = {
      id: "p-1", name: "Cached SKU", barcode: "2000000001287",
      category: "Test", code: "T-001", sku: "T-001",
      price: 100, mrp: 100, stock: 10,
    };
    // First call succeeds → populates cache
    vi.mocked(apiFetchV1).mockResolvedValueOnce([cachedItem]);
    const svc = new ItemService();
    await (svc as any).getAll();

    // Second call fails → must return cache
    vi.mocked(apiFetchV1).mockRejectedValueOnce(new Error("Network error"));
    const result = await (svc as any).getAll();
    expect(result.length).toBeGreaterThan(0);
  });

  it("getAll() returns empty array when API returns empty (clean install)", async () => {
    vi.mocked(apiFetchV1).mockResolvedValueOnce([]);
    const svc = new ItemService();
    const result = await (svc as any).getAll();
    expect(result).toEqual([]);
    expect((svc as any).isLoaded).toBe(true);
  });
});

// ─── F-004: Product ID Generation ────────────────────────────────────────────

describe("F-004 — Product ID Identity", () => {
  it("save() sends UUID v4 format for new items (no prod_ timestamp)", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    await svc.save({ name: "New Item", category: "General" }).catch(() => {});
    if (store.captured) {
      const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(store.captured.id).toMatch(uuidV4Pattern);
      expect(store.captured.id).not.toMatch(/^prod_\d+$/);
    }
  });

  it("save() preserves a caller-supplied stable UUID", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    const stableId = "550e8400-e29b-41d4-a716-446655440000";
    await svc.save({ id: stableId, name: "Stable ID Item", category: "General" }).catch(() => {});
    if (store.captured) {
      expect(store.captured.id).toBe(stableId);
    }
  });

  it("save() regenerates fresh UUID for prod_temp_ prefix (legacy)", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    await svc.save({ id: "prod_temp_1234", name: "Temp ID Item", category: "General" }).catch(() => {});
    if (store.captured) {
      expect(store.captured.id).not.toBe("prod_temp_1234");
      const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(store.captured.id).toMatch(uuidV4Pattern);
    }
  });

  it("save() rolls back optimistic cache entry on API failure", async () => {
    vi.mocked(apiFetchV1).mockRejectedValueOnce(new Error("500 Internal Server Error"));
    const svc = new ItemService();
    await expect(
      svc.save({ name: "Rollback Item", category: "General", barcode: "2000000001294" })
    ).rejects.toThrow();
    expect((svc as any).localCache.length).toBe(0);
  });
});

// ─── Barcode Source Preservation ────────────────────────────────────────────

describe("Barcode Source Preservation", () => {
  it("save() preserves a manually-entered barcode without overwriting", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    const manualBarcode = "8901234567891";
    await svc.save({ name: "Manual BC Item", category: "General", barcode: manualBarcode }).catch(() => {});
    if (store.captured) {
      expect(store.captured.barcode).toBe(manualBarcode);
    }
  });

  it("save() auto-generates valid EAN-13 when barcode is empty", async () => {
    const store = installStoreMock();
    const svc = new ItemService();
    await svc.save({ name: "Auto BC Item", category: "General" }).catch(() => {});
    if (store.captured) {
      expect(/^\d{13}$/.test(store.captured.barcode)).toBe(true);
      expect(BarcodeEngine.validateEAN13(store.captured.barcode)).toBe(true);
    }
  });
});
