/**
 * Tests for fetchWithRetry utility
 * Mocks global `fetch` to control responses without hitting real network.
 */
import { jest, beforeAll, afterAll, beforeEach, describe, test, expect } from "@jest/globals";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeResponse = (status, ok = true) => ({ ok, status });

// Speed up all setTimeout delays inside fetchWithRetry
beforeAll(() => {
  jest.useFakeTimers();
});
afterAll(() => {
  jest.useRealTimers();
});
beforeEach(() => {
  global.fetch = jest.fn();
  jest.clearAllMocks();
});

// ─── happy path ───────────────────────────────────────────────────────────────
describe("fetchWithRetry — success", () => {
  test("returns response immediately on ok:true", async () => {
    const mockResponse = makeResponse(200);
    global.fetch.mockResolvedValueOnce(mockResponse);

    const promise = fetchWithRetry("https://example.com/api");
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("passes credentials:include by default", async () => {
    global.fetch.mockResolvedValueOnce(makeResponse(200));

    const promise = fetchWithRetry("https://example.com/api");
    await jest.runAllTimersAsync();
    await promise;

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({ credentials: "include" })
    );
  });

  test("merges extra options with default credentials", async () => {
    global.fetch.mockResolvedValueOnce(makeResponse(200));

    const promise = fetchWithRetry("https://example.com/api", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
    });
    await jest.runAllTimersAsync();
    await promise;

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({ credentials: "include", method: "POST" })
    );
  });
});

// ─── non-retryable error status ───────────────────────────────────────────────
describe("fetchWithRetry — non-retryable status", () => {
  test("returns immediately for 404 without retrying", async () => {
    global.fetch.mockResolvedValue(makeResponse(404, false));

    const promise = fetchWithRetry("https://example.com/api", {}, 2, 0);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("returns immediately for 401 without retrying", async () => {
    global.fetch.mockResolvedValue(makeResponse(401, false));

    const promise = fetchWithRetry("https://example.com/api", {}, 2, 0);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── retryable server errors ──────────────────────────────────────────────────
describe("fetchWithRetry — retryable 5xx", () => {
  test("retries on 503 and returns eventual success", async () => {
    global.fetch
      .mockResolvedValueOnce(makeResponse(503, false))
      .mockResolvedValueOnce(makeResponse(200, true));

    const promise = fetchWithRetry("https://example.com/api", {}, 2, 0);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("retries on 502 and returns last response after max retries", async () => {
    global.fetch.mockResolvedValue(makeResponse(502, false));

    const promise = fetchWithRetry("https://example.com/api", {}, 1, 0);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(502);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

// ─── network errors ───────────────────────────────────────────────────────────
describe("fetchWithRetry — network errors", () => {
  test("throws on network failure after all retries (0 retries)", async () => {
    global.fetch.mockRejectedValue(new Error("Network Error"));

    await expect(
      fetchWithRetry("https://example.com/api", {}, 0, 0)
    ).rejects.toThrow("Network Error");
  });

  test("retries once on network failure then succeeds", async () => {
    global.fetch
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(makeResponse(200, true));

    const promise = fetchWithRetry("https://example.com/api", {}, 1, 0);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
