import {
  isValidEmail,
  isValidGmailAddress,
  isValidPassword,
  isValidPhone,
  normalizeEmail,
} from "../utils/validation.js";

// ─── normalizeEmail ───────────────────────────────────────────────────────────
describe("normalizeEmail", () => {
  test("trims whitespace and lowercases", () => {
    expect(normalizeEmail("  Hello@Gmail.COM  ")).toBe("hello@gmail.com");
  });

  test("returns empty string for falsy values", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail("")).toBe("");
  });
});

// ─── isValidEmail ─────────────────────────────────────────────────────────────
describe("isValidEmail", () => {
  test("returns true for a valid email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  test("returns true when there are leading/trailing spaces", () => {
    expect(isValidEmail("  user@example.com  ")).toBe(true);
  });

  test("returns false for an email without @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  test("returns false for null", () => {
    expect(isValidEmail(null)).toBe(false);
  });
});

// ─── isValidGmailAddress ──────────────────────────────────────────────────────
describe("isValidGmailAddress", () => {
  test("returns true for a valid gmail address", () => {
    expect(isValidGmailAddress("user@gmail.com")).toBe(true);
  });

  test("returns false for a non-gmail domain", () => {
    expect(isValidGmailAddress("user@yahoo.com")).toBe(false);
  });

  test("is case-insensitive", () => {
    expect(isValidGmailAddress("User@GMAIL.COM")).toBe(true);
  });
});

// ─── isValidPassword ──────────────────────────────────────────────────────────
describe("isValidPassword", () => {
  test("returns true for a valid password (letters + numbers, ≥5 chars)", () => {
    expect(isValidPassword("abc12")).toBe(true);
  });

  test("returns false for a password with only letters", () => {
    expect(isValidPassword("abcde")).toBe(false);
  });

  test("returns false for a password with only numbers", () => {
    expect(isValidPassword("12345")).toBe(false);
  });

  test("returns false for a short password", () => {
    expect(isValidPassword("ab1")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidPassword("")).toBe(false);
  });
});

// ─── isValidPhone ─────────────────────────────────────────────────────────────
describe("isValidPhone", () => {
  test("returns true for exactly 10 digits", () => {
    expect(isValidPhone("0901234567")).toBe(true);
  });

  test("returns false for fewer than 10 digits", () => {
    expect(isValidPhone("090123")).toBe(false);
  });

  test("returns false when number contains letters", () => {
    expect(isValidPhone("090123456A")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidPhone("")).toBe(false);
  });

  test("trims whitespace before validating", () => {
    expect(isValidPhone("  0901234567  ")).toBe(true);
  });
});
