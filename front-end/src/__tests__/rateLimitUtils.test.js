/**
 * Tests for rateLimitUtils — clears localStorage keys with specific prefixes.
 * Uses jest-environment-jsdom which provides a localStorage mock.
 */
import { jest, beforeEach, afterEach, describe, test, expect } from "@jest/globals";
import { clearClientRateLimitStorage } from "../utils/rateLimitUtils.js";

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(console, "error").mockImplementation(() => {}); // suppress error logs
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── clearClientRateLimitStorage ─────────────────────────────────────────────
describe("clearClientRateLimitStorage", () => {
  test("removes keys starting with rateLimitLock:", () => {
    localStorage.setItem("rateLimitLock:login", "1");
    localStorage.setItem("rateLimitLock:register", "1");
    localStorage.setItem("other:key", "value");

    clearClientRateLimitStorage();

    expect(localStorage.getItem("rateLimitLock:login")).toBeNull();
    expect(localStorage.getItem("rateLimitLock:register")).toBeNull();
  });

  test("removes keys starting with rateLimitCounter:", () => {
    localStorage.setItem("rateLimitCounter:login", "5");
    localStorage.setItem("rateLimitCounter:checkout", "2");

    clearClientRateLimitStorage();

    expect(localStorage.getItem("rateLimitCounter:login")).toBeNull();
    expect(localStorage.getItem("rateLimitCounter:checkout")).toBeNull();
  });

  test("does NOT remove unrelated localStorage keys", () => {
    localStorage.setItem("rateLimitLock:x", "1");
    localStorage.setItem("cartItems", "[{\"id\":1}]");
    localStorage.setItem("userToken", "abc123");

    clearClientRateLimitStorage();

    expect(localStorage.getItem("cartItems")).toBe("[{\"id\":1}]");
    expect(localStorage.getItem("userToken")).toBe("abc123");
  });

  test("does nothing when localStorage is empty", () => {
    expect(() => clearClientRateLimitStorage()).not.toThrow();
    expect(localStorage.length).toBe(0);
  });

  test("removes mix of both prefixes in one call", () => {
    localStorage.setItem("rateLimitLock:api1", "1");
    localStorage.setItem("rateLimitCounter:api1", "3");
    localStorage.setItem("persist:root", "{}");

    clearClientRateLimitStorage();

    expect(localStorage.getItem("rateLimitLock:api1")).toBeNull();
    expect(localStorage.getItem("rateLimitCounter:api1")).toBeNull();
    expect(localStorage.getItem("persist:root")).toBe("{}");
  });

  test("handles error thrown during removal gracefully", () => {
    // Temporarily override localStorage to throw on any operation
    const originalLocalStorage = global.localStorage;
    Object.defineProperty(global, "localStorage", {
      value: {
        get length() { return 1; },
        key: () => "rateLimitLock:test",
        getItem: () => null,
        setItem: () => {},
        removeItem: () => { throw new Error("Storage error"); },
        clear: () => {},
        [Symbol.iterator]: function* () {},
      },
      writable: true,
      configurable: true,
    });

    // Manually mimic Object.keys for this mock localStorage
    const originalKeys = Object.keys;
    Object.keys = (obj) => {
      if (obj === global.localStorage) return ["rateLimitLock:test"];
      return originalKeys(obj);
    };

    expect(() => clearClientRateLimitStorage()).not.toThrow();
    expect(console.error).toHaveBeenCalled();

    // Restore
    Object.keys = originalKeys;
    Object.defineProperty(global, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });
});
