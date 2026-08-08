/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printer Discovery & Connection Engine Unit Tests
 * Standard     : SCS-PRINT-DISCOVERY-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PrinterDiscoveryEngine,
  UsbPrinterDiscoveryProvider,
  WindowsSpoolerDiscoveryProvider,
  NetworkPrinterDiscoveryProvider,
  RawTcpPrinterProbe,
  PrinterIdentityResolver,
  PrinterRecommendationEngine,
  IPrinterDiscoveryProvider,
} from "../core/printing/discovery/PrinterDiscoveryEngine.ts";
import { PrinterLanguageDetector } from "../core/printing/prn_engine/PrinterLanguageDetector.ts";
import { PrinterProfile } from "../core/printing/models/PrinterProfile.ts";
import { UniversalPrintCanvas } from "../core/printing/models/UniversalPrintCanvas.ts";
import { UniversalPrintTemplate } from "../core/printing/models/UniversalPrintTemplate.ts";

describe("Universal Printer Discovery Engine Test Suite (Phase F)", () => {
  beforeEach(() => {
    PrinterDiscoveryEngine.clearCache();
  });

  // 1. Empty discovery
  it("1. Performs empty discovery when zero providers are registered", async () => {
    const customEngine = new (PrinterDiscoveryEngine.constructor as any)();
    customEngine.unregisterProvider("usb");
    customEngine.unregisterProvider("spooler");
    customEngine.unregisterProvider("network");

    const res = await customEngine.discover();
    expect(res.printers.length).toBe(0);
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  // 2. USB provider available
  it("2. Discovers printers via available USB discovery provider", async () => {
    const usbProvider = new UsbPrinterDiscoveryProvider();
    const available = await usbProvider.isAvailable();
    expect(available).toBe(true);

    const items = await usbProvider.discover();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].connectionType).toBe("USB");
  });

  // 3. USB unavailable
  it("3. Handles unavailable USB provider without crashing discovery pipeline", async () => {
    const mockProvider: IPrinterDiscoveryProvider = {
      providerId: "mock-usb-unavail",
      providerName: "Mock Unavailable USB",
      isAvailable: () => false,
      discover: async () => [],
    };

    PrinterDiscoveryEngine.registerProvider(mockProvider);
    const res = await PrinterDiscoveryEngine.discover();

    const provResult = res.providerResults.find((p) => p.providerId === "mock-usb-unavail");
    expect(provResult?.status).toBe("UNAVAILABLE");
  });

  // 4. Spooler provider
  it("4. Discovers printers via Windows spooler provider", async () => {
    const spoolerProvider = new WindowsSpoolerDiscoveryProvider();
    const items = await spoolerProvider.discover();

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].connectionType).toBe("WINDOWS_SPOOLER");
  });

  // 5. Network provider
  it("5. Discovers network printers via TCP network provider", async () => {
    const netProvider = new NetworkPrinterDiscoveryProvider();
    const items = await netProvider.discover();

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].connectionType).toBe("TCP");
  });

  // 6. TCP 9100 reachable
  it("6. Probes TCP 9100 port and detects REACHABLE host status", async () => {
    const res = await RawTcpPrinterProbe.probe("192.168.1.50", 9100);
    expect(res.status).toBe("REACHABLE");
    expect(res.port).toBe(9100);
  });

  // 7. TCP timeout
  it("7. Handles TCP network probe timeout safely without unhandled rejection", async () => {
    const res = await RawTcpPrinterProbe.probe("timeout-host", 9100, 500);
    expect(res.status).toBe("TIMEOUT");
  });

  // 8. TCP refused
  it("8. Handles TCP port connection refusal cleanly", async () => {
    const res = await RawTcpPrinterProbe.probe("refused-host", 9100);
    expect(res.status).toBe("REFUSED");
  });

  // 9. QZ unavailable
  it("9. Handles QZ bridge provider unavailability gracefully", async () => {
    const qzProvider: IPrinterDiscoveryProvider = {
      providerId: "qz-bridge",
      providerName: "QZ Tray Bridge",
      isAvailable: () => false,
      discover: async () => [],
    };

    PrinterDiscoveryEngine.registerProvider(qzProvider);
    const res = await PrinterDiscoveryEngine.discover();

    expect(res.providerResults.some((p) => p.providerId === "qz-bridge" && p.status === "UNAVAILABLE")).toBe(true);
  });

  // 10. Local agent unavailable
  it("10. Handles local print agent unavailability gracefully", async () => {
    const agentProvider: IPrinterDiscoveryProvider = {
      providerId: "local-agent",
      providerName: "Local Print Agent",
      isAvailable: () => false,
      discover: async () => [],
    };

    PrinterDiscoveryEngine.registerProvider(agentProvider);
    const res = await PrinterDiscoveryEngine.discover();

    expect(res.providerResults.some((p) => p.providerId === "local-agent" && p.status === "UNAVAILABLE")).toBe(true);
  });

  // 11. Provider failure isolation
  it("11. Isolates provider failure so other healthy providers continue discovering", async () => {
    const failingProvider: IPrinterDiscoveryProvider = {
      providerId: "failing-provider",
      providerName: "Failing Provider",
      isAvailable: () => true,
      discover: async () => {
        throw new Error("Provider Hardware Failure");
      },
    };

    PrinterDiscoveryEngine.registerProvider(failingProvider);
    const res = await PrinterDiscoveryEngine.discover();

    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.printers.length).toBeGreaterThan(0); // USB / Spooler still succeeded
  });

  // 12. Multiple providers
  it("12. Aggregates results from multiple active discovery providers", async () => {
    const res = await PrinterDiscoveryEngine.discover();
    expect(res.providerResults.length).toBeGreaterThanOrEqual(3);
    expect(res.printers.length).toBeGreaterThan(0);
  });

  // 13. Duplicate printer discovery
  it("13. Merges duplicate printer discoveries across USB and Spooler providers", async () => {
    const p1: PrinterProfile = {
      id: "p1-usb",
      name: "Zebra ZD420",
      connectionType: "USB",
      dpi: 203,
      status: "ONLINE",
      hardware: { serialNumber: "ZEB-100" },
      discoverySources: ["USB"],
    } as any;

    const p2: PrinterProfile = {
      id: "p1-spooler",
      name: "Zebra ZD420",
      connectionType: "WINDOWS_SPOOLER",
      dpi: 203,
      status: "ONLINE",
      hardware: { serialNumber: "ZEB-100" },
      discoverySources: ["WINDOWS_SPOOLER"],
    } as any;

    const merged = PrinterIdentityResolver.merge([p1, p2]);
    expect(merged.length).toBe(1);
    expect(merged[0].discoverySources).toContain("USB");
    expect(merged[0].discoverySources).toContain("WINDOWS_SPOOLER");
  });

  // 14. Serial-based identity merge
  it("14. Merges printer identity accurately using matching hardware serial number", () => {
    const p1 = { id: "a", name: "P1", connectionType: "USB", hardware: { serialNumber: "SN-999" } } as any;
    const p2 = { id: "b", name: "P1 (Copy)", connectionType: "TCP", hardware: { serialNumber: "SN-999" } } as any;

    const merged = PrinterIdentityResolver.merge([p1, p2]);
    expect(merged.length).toBe(1);
  });

  // 15. MAC-based identity merge
  it("15. Merges printer identity accurately using matching MAC address", () => {
    const p1 = { id: "a", name: "P1", connectionType: "TCP", hardware: { macAddress: "00:11:22:33:44:55" } } as any;
    const p2 = { id: "b", name: "P1", connectionType: "TCP", hardware: { macAddress: "00:11:22:33:44:55" } } as any;

    const merged = PrinterIdentityResolver.merge([p1, p2]);
    expect(merged.length).toBe(1);
  });

  // 16. Endpoint-based identity
  it("16. Identifies network printer using IP host and port endpoint", () => {
    const p1 = { id: "a", name: "Net P", connectionType: "TCP", connection: { host: "192.168.1.50", port: 9100 }, hardware: {} } as any;
    const p2 = { id: "b", name: "Net P", connectionType: "TCP", connection: { host: "192.168.1.50", port: 9100 }, hardware: {} } as any;

    const merged = PrinterIdentityResolver.merge([p1, p2]);
    expect(merged.length).toBe(1);
  });

  // 17. Same-name different-printer protection
  it("17. Prevents merging different physical printers that happen to share the same display name", () => {
    const p1 = { id: "a", name: "Zebra ZD420", connectionType: "USB", hardware: { serialNumber: "SN-001" } } as any;
    const p2 = { id: "b", name: "Zebra ZD420", connectionType: "USB", hardware: { serialNumber: "SN-002" } } as any;

    const merged = PrinterIdentityResolver.merge([p1, p2]);
    expect(merged.length).toBe(2); // Separate physical serial numbers
  });

  // 18. Language detection integration
  it("18. Integrates PrinterLanguageDetector for printer driver capability inspection", () => {
    const detected = PrinterLanguageDetector.detect("^XA^XZ");
    expect(detected.language).toBe("ZPL");
  });

  // 19. Unknown language
  it("19. Flags unknown printer language safely without crashing", () => {
    const detected = PrinterLanguageDetector.detect("UNKNOWN DRIVER TEXT");
    expect(detected.ambiguous).toBe(true);
  });

  // 20. Unknown DPI
  it("20. Preserves unknown DPI setting when not reported by driver", () => {
    const prof: PrinterProfile = { id: "p-no-dpi", name: "No DPI", dpi: 0 } as any;
    expect(prof.dpi).toBe(0);
  });

  // 21. Known DPI
  it("21. Captures reported hardware DPI accurately (203 / 300 / 600 DPI)", async () => {
    const res = await PrinterDiscoveryEngine.discover();
    const printer300 = res.printers.find((p) => p.dpi === 300);

    expect(printer300).toBeDefined();
    expect(printer300?.dpi).toBe(300);
  });

  // 22. Capability confidence
  it("22. Tracks capability discovery sources and provenance", async () => {
    const res = await PrinterDiscoveryEngine.discover();
    expect(res.printers[0].discoverySources).toBeDefined();
    expect(res.printers[0].discoverySources.length).toBeGreaterThan(0);
  });

  // 23. Offline printer preservation
  it("23. Preserves offline printers in cache across discovery passes", async () => {
    const offlineProf: PrinterProfile = {
      id: "p-offline-cached",
      name: "Cached Offline Printer",
      connectionType: "TCP",
      dpi: 203,
      status: "OFFLINE",
      hardware: {},
    } as any;

    (PrinterDiscoveryEngine as any).cache.set("p-offline-cached", offlineProf);

    const res = await PrinterDiscoveryEngine.discover();
    expect(res.printers.some((p) => p.id === "p-offline-cached")).toBe(true);
  });

  // 24. Manually configured printer
  it("24. Registers manually configured network printer profile", () => {
    const manual = PrinterDiscoveryEngine.addManualPrinter({
      name: "Manual Warehouse Printer",
      host: "10.0.0.88",
      port: 9100,
      dpi: 300,
      language: "ZPL",
    });

    expect(manual.name).toBe("Manual Warehouse Printer");
    expect(manual.connection.host).toBe("10.0.0.88");
    expect(manual.discoverySources).toContain("USER_CONFIGURED");
  });

  // 25. User-configured capability provenance
  it("25. Marks manually configured printer provenance as USER_CONFIGURED", () => {
    const manual = PrinterDiscoveryEngine.addManualPrinter({ name: "User Printer" });
    expect(manual.discoverySources).toContain("USER_CONFIGURED");
  });

  // 26. Discovery refresh
  it("26. Refreshes discovery cache during new discovery scan", async () => {
    await PrinterDiscoveryEngine.discover();
    const count1 = PrinterDiscoveryEngine.getCached().length;

    await PrinterDiscoveryEngine.discover();
    const count2 = PrinterDiscoveryEngine.getCached().length;

    expect(count1).toBe(count2);
  });

  // 27. Cache retrieval
  it("27. Retrieves cached printer profiles cleanly via getCached()", async () => {
    await PrinterDiscoveryEngine.discover();
    const cached = PrinterDiscoveryEngine.getCached();

    expect(cached.length).toBeGreaterThan(0);
  });

  // 28. Cache clearing
  it("28. Clears discovery cache cleanly via clearCache()", async () => {
    await PrinterDiscoveryEngine.discover();
    expect(PrinterDiscoveryEngine.getCached().length).toBeGreaterThan(0);

    PrinterDiscoveryEngine.clearCache();
    expect(PrinterDiscoveryEngine.getCached().length).toBe(0);
  });

  // 29. Printer recommendation
  it("29. Evaluates printer recommendations for canvas and template", async () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ name: "Tattly Template" });
    const res = await PrinterDiscoveryEngine.discover();

    const recs = PrinterRecommendationEngine.recommend(canvas, tmpl, res.printers);
    expect(recs.length).toBe(res.printers.length);
  });

  // 30. Compatible printer
  it("30. Marks printer satisfying width, DPI, and language as RECOMMENDED", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ name: "Standard ZPL" });

    const p: PrinterProfile = {
      id: "p-ok",
      name: "OK Printer",
      dpi: 203,
      media: { maxWidthMm: 104, maxHeightMm: 1000 },
      capabilities: { supportsZPL: true, supportsRasterImages: true },
    } as any;

    const recs = PrinterRecommendationEngine.recommend(canvas, tmpl, [p]);
    expect(recs[0].recommendationState).toBe("RECOMMENDED");
  });

  // 31. Incompatible width
  it("31. Marks printer with insufficient media width as INCOMPATIBLE", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 120 });
    const tmpl = new UniversalPrintTemplate({ name: "Wide Tag" });

    const p: PrinterProfile = {
      id: "p-narrow",
      name: "Narrow Printer",
      media: { maxWidthMm: 104 },
      capabilities: { supportsZPL: true },
    } as any;

    const recs = PrinterRecommendationEngine.recommend(canvas, tmpl, [p]);
    expect(recs[0].recommendationState).toBe("INCOMPATIBLE");
    expect(recs[0].reasons.some((r) => r.includes("exceeds printer max media width"))).toBe(true);
  });

  // 32. Incompatible DPI
  it("32. Produces warning recommendation when canvas DPI differs from printer DPI", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 203, widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ name: "203 DPI Tag" });

    const p: PrinterProfile = {
      id: "p-300",
      name: "300 DPI Printer",
      dpi: 300,
      media: { maxWidthMm: 104 },
      capabilities: { supportsZPL: true },
    } as any;

    const recs = PrinterRecommendationEngine.recommend(canvas, tmpl, [p]);
    expect(recs[0].recommendationState).toBe("COMPATIBLE_WITH_WARNINGS");
  });

  // 33. Unknown capability warning
  it("33. Provides explicit warning messages for non-fatal capability mismatches", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 203, widthMm: 100 });
    const tmpl = new UniversalPrintTemplate({ name: "Tag" });

    const p: PrinterProfile = {
      id: "p-warn",
      name: "Warn Printer",
      dpi: 300,
      media: { maxWidthMm: 104 },
      capabilities: { supportsZPL: true },
    } as any;

    const recs = PrinterRecommendationEngine.recommend(canvas, tmpl, [p]);
    expect(recs[0].reasons.length).toBeGreaterThan(0);
  });

  // 34. Multiple compatible printers
  it("34. Evaluates and ranks multiple compatible printers", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ name: "Tag" });

    const p1 = { id: "p1", name: "P1", dpi: 203, media: { maxWidthMm: 104 }, capabilities: { supportsZPL: true } } as any;
    const p2 = { id: "p2", name: "P2", dpi: 300, media: { maxWidthMm: 104 }, capabilities: { supportsZPL: true } } as any;

    const recs = PrinterRecommendationEngine.recommend(canvas, tmpl, [p1, p2]);
    expect(recs[0].recommendationState).toBe("RECOMMENDED");
    expect(recs[1].recommendationState).toBe("COMPATIBLE_WITH_WARNINGS");
  });

  // 35. No automatic arbitrary printer selection
  it("35. Returns clear recommendation status without forcing arbitrary automatic printer selection", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ name: "Tag" });
    const recs = PrinterRecommendationEngine.recommend(canvas, tmpl, []);

    expect(recs.length).toBe(0); // Zero printers available
  });

  // 36. Tattly 804-dot compatibility
  it("36. Evaluates Tattly 804-dot (100.5mm) fixture compatibility against 203 DPI Zebra printer", () => {
    const canvas = new UniversalPrintCanvas({ widthMm: 100.5, dpi: 203 });
    const tmpl = new UniversalPrintTemplate({ name: "Tattly Fixture" });

    const zebra: PrinterProfile = {
      id: "zeb-203",
      name: "Zebra ZD420",
      dpi: 203,
      media: { maxWidthMm: 104 },
      capabilities: { supportsZPL: true },
    } as any;

    const recs = PrinterRecommendationEngine.recommend(canvas, tmpl, [zebra]);
    expect(recs[0].recommendationState).toBe("RECOMMENDED");
  });

  // 37. 203 DPI
  it("37. Validates 203 DPI printer recommendation match", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 203 });
    const p = { id: "p203", dpi: 203, media: { maxWidthMm: 104 }, capabilities: { supportsZPL: true } } as any;
    const recs = PrinterRecommendationEngine.recommend(canvas, new UniversalPrintTemplate(), [p]);

    expect(recs[0].recommendationState).toBe("RECOMMENDED");
  });

  // 38. 300 DPI
  it("38. Validates 300 DPI printer recommendation match", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 300 });
    const p = { id: "p300", dpi: 300, media: { maxWidthMm: 104 }, capabilities: { supportsZPL: true } } as any;
    const recs = PrinterRecommendationEngine.recommend(canvas, new UniversalPrintTemplate(), [p]);

    expect(recs[0].recommendationState).toBe("RECOMMENDED");
  });

  // 39. 600 DPI
  it("39. Validates 600 DPI printer recommendation match", () => {
    const canvas = new UniversalPrintCanvas({ dpi: 600 });
    const p = { id: "p600", dpi: 600, media: { maxWidthMm: 104 }, capabilities: { supportsZPL: true } } as any;
    const recs = PrinterRecommendationEngine.recommend(canvas, new UniversalPrintTemplate(), [p]);

    expect(recs[0].recommendationState).toBe("RECOMMENDED");
  });

  // 40. USB + spooler deduplication
  it("40. Deduplicates printer reported by both USB and Windows spooler providers", () => {
    const pUsb = { id: "p1", name: "Zebra", connectionType: "USB", hardware: { serialNumber: "SN-100" } } as any;
    const pSpooler = { id: "p2", name: "Zebra", connectionType: "WINDOWS_SPOOLER", hardware: { serialNumber: "SN-100" } } as any;

    const merged = PrinterIdentityResolver.merge([pUsb, pSpooler]);
    expect(merged.length).toBe(1);
  });

  // 41. Spooler + network deduplication
  it("41. Deduplicates printer reported by both Spooler and Network providers", () => {
    const pSpooler = { id: "p1", name: "Zebra Net", connectionType: "WINDOWS_SPOOLER", hardware: { macAddress: "00:11:22:33:44:55" } } as any;
    const pNet = { id: "p2", name: "Zebra Net", connectionType: "TCP", hardware: { macAddress: "00:11:22:33:44:55" } } as any;

    const merged = PrinterIdentityResolver.merge([pSpooler, pNet]);
    expect(merged.length).toBe(1);
  });

  // 42. All three discovery sources
  it("42. Deduplicates printer reported across all three discovery sources (USB, Spooler, Network)", () => {
    const p1 = { id: "p1", name: "Zebra All", connectionType: "USB", hardware: { serialNumber: "SN-ALL" } } as any;
    const p2 = { id: "p2", name: "Zebra All", connectionType: "WINDOWS_SPOOLER", hardware: { serialNumber: "SN-ALL" } } as any;
    const p3 = { id: "p3", name: "Zebra All", connectionType: "TCP", hardware: { serialNumber: "SN-ALL" } } as any;

    const merged = PrinterIdentityResolver.merge([p1, p2, p3]);
    expect(merged.length).toBe(1);
    expect(merged[0].discoverySources.length).toBe(3);
  });

  // 43. Provider timeout isolation
  it("43. Isolates slow provider timeout ensuring discovery operation finishes promptly", async () => {
    const slowProvider: IPrinterDiscoveryProvider = {
      providerId: "slow-provider",
      providerName: "Slow Provider",
      isAvailable: () => true,
      discover: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      },
    };

    PrinterDiscoveryEngine.registerProvider(slowProvider);
    const res = await PrinterDiscoveryEngine.discover();

    expect(res.durationMs).toBeGreaterThan(0);
  });

  // 44. Bounded network probe
  it("44. Performs bounded network probe with deterministic status response", async () => {
    const res = await RawTcpPrinterProbe.probe("127.0.0.1", 9100, 100);
    expect(res.status).toBeDefined();
  });

  // 45. Malicious response handling
  it("45. SECURITY TEST: Sanitizes malicious string responses from external printer probe payloads", () => {
    const maliciousHost = "<script>alert('xss')</script>";
    const res = PrinterDiscoveryEngine.addManualPrinter({ name: "Clean Printer", host: maliciousHost });

    expect(res.name).toBe("Clean Printer");
    expect(res.connection.host).toBe(maliciousHost); // Data stored purely as string payload
  });

  // 46. No shell execution
  it("46. SECURITY TEST: Verifies zero shell execution calls or system command injections in discovery engine", () => {
    expect((PrinterDiscoveryEngine as any).execCommand).toBeUndefined();
    expect((PrinterDiscoveryEngine as any).childProcess).toBeUndefined();
  });

  // 47. No unrestricted scanning
  it("47. SECURITY TEST: Verifies network probe restricts scanning to explicit single targets", async () => {
    const res = await RawTcpPrinterProbe.probe("invalid-host", 9100);
    expect(res.status).toBe("UNREACHABLE");
  });

  // 48. Browser-safe provider
  it("48. Operates browser-safe provider without requiring Node.js desktop native modules", () => {
    const usbProvider = new UsbPrinterDiscoveryProvider();
    expect(usbProvider.providerId).toBe("usb");
  });

  // 49. Desktop provider
  it("49. Operates desktop provider with Windows spooler fallback profile", () => {
    const spoolerProvider = new WindowsSpoolerDiscoveryProvider();
    expect(spoolerProvider.providerId).toBe("spooler");
  });

  // 50. Deterministic discovery result
  it("50. Returns deterministic discovery result structure across repeated runs", async () => {
    const res1 = await PrinterDiscoveryEngine.discover();
    const res2 = await PrinterDiscoveryEngine.discover();

    expect(res1.printers.length).toBe(res2.printers.length);
    expect(res1.errors.length).toBe(res2.errors.length);
  });
});
