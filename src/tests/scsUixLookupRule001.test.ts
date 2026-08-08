// @vitest-environment jsdom
/**
 * Project      : SMRITI Retail OS
 * Test Suite   : SCS-UIX Lookup Rule-001 & Universal Keyboard Standard Tests
 * Standard     : SCS-UIX Lookup Rule-001
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * Covers:
 *   UIX-001  Empty Field + F2: dispatches CONTEXT_DISCOVERY with searchText="" (full browse mode)
 *   UIX-002  Partial Text + F2: dispatches CONTEXT_DISCOVERY with pre-filled searchText
 *   UIX-003  Ctrl + F2: dispatches ADVANCED_SEARCH for multi-criteria search
 *   UIX-004  F3 / Ctrl+N: dispatches QUICK_CREATE
 *   UIX-005  F4: dispatches EDIT_SELECTED
 *   UIX-006  F5: dispatches REFRESH
 *   UIX-007  F6: dispatches RECENT_ITEMS
 *   UIX-008  Escape: dispatches CLOSE
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KeyboardDiscoveryManager } from "../kernel/upr/navigation/KeyboardDiscoveryManager.js";

describe("SCS-UIX Lookup Rule-001 & Universal Keyboard Standard", () => {
  beforeEach(() => {
    KeyboardDiscoveryManager.start();
  });

  afterEach(() => {
    KeyboardDiscoveryManager.stop();
  });

  it("UIX-001: F2 on empty field dispatches CONTEXT_DISCOVERY with searchText='' (browse all)", () => {
    const handler = vi.fn();
    const unsub = KeyboardDiscoveryManager.subscribe(handler);

    const event = new KeyboardEvent("keydown", { key: "F2", bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(
      "CONTEXT_DISCOVERY",
      expect.objectContaining({ searchText: "" })
    );

    unsub();
  });

  it("UIX-002: F2 on text field dispatches CONTEXT_DISCOVERY with pre-filled searchText", () => {
    const handler = vi.fn();
    const unsub = KeyboardDiscoveryManager.subscribe(handler);

    const input = document.createElement("input");
    input.value = "NIKE";
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent("keydown", { key: "F2", bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(
      "CONTEXT_DISCOVERY",
      expect.objectContaining({ searchText: "NIKE" })
    );

    document.body.removeChild(input);
    unsub();
  });

  it("UIX-003: Ctrl+F2 dispatches ADVANCED_SEARCH for multi-criteria search", () => {
    const handler = vi.fn();
    const unsub = KeyboardDiscoveryManager.subscribe(handler);

    const event = new KeyboardEvent("keydown", { key: "F2", ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(
      "ADVANCED_SEARCH",
      expect.objectContaining({ searchText: "" })
    );

    unsub();
  });

  it("UIX-004: F3 dispatches QUICK_CREATE", () => {
    const handler = vi.fn();
    const unsub = KeyboardDiscoveryManager.subscribe(handler);

    const event = new KeyboardEvent("keydown", { key: "F3", bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith("QUICK_CREATE", expect.anything());

    unsub();
  });

  it("UIX-005: F4 dispatches EDIT_SELECTED", () => {
    const handler = vi.fn();
    const unsub = KeyboardDiscoveryManager.subscribe(handler);

    const event = new KeyboardEvent("keydown", { key: "F4", bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith("EDIT_SELECTED", expect.anything());

    unsub();
  });

  it("UIX-006: F5 dispatches REFRESH", () => {
    const handler = vi.fn();
    const unsub = KeyboardDiscoveryManager.subscribe(handler);

    const event = new KeyboardEvent("keydown", { key: "F5", bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith("REFRESH", expect.anything());

    unsub();
  });

  it("UIX-007: F6 dispatches RECENT_ITEMS", () => {
    const handler = vi.fn();
    const unsub = KeyboardDiscoveryManager.subscribe(handler);

    const event = new KeyboardEvent("keydown", { key: "F6", bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith("RECENT_ITEMS", expect.anything());

    unsub();
  });

  it("UIX-008: Escape dispatches CLOSE", () => {
    const handler = vi.fn();
    const unsub = KeyboardDiscoveryManager.subscribe(handler);

    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith("CLOSE", expect.anything());

    unsub();
  });
});
