/**
 * Tests for userAdminSlice Redux reducer.
 * Admin CRUD state: block/unblock users, update role, loading/error states.
 */
import { jest, beforeEach, describe, test, expect } from "@jest/globals";

// Mock axiosInstance to prevent import.meta.env crash
jest.unstable_mockModule("../utils/axiosInstance.js", () => ({
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.unstable_mockModule("../services/adminService.js", () => ({
  fetchUsers: jest.fn(),
  blockUserRequest: jest.fn(),
  unblockUserRequest: jest.fn(),
  updateUserRoleRequest: jest.fn(),
}));

const { default: userAdminReducer } = await import("../stores/userAdminSlice.js");

// ─── helpers ──────────────────────────────────────────────────────────────────
const makeUser = (overrides = {}) => ({
  _id: "user-1",
  name: "Nguyen Van A",
  email: "a@example.com",
  role: "user",
  isBlocked: false,
  ...overrides,
});

const initialState = {
  users: [],
  total: 0,
  loading: false,
  error: null,
  page: 1,
  totalPages: 0,
};

// ─── initial state ────────────────────────────────────────────────────────────
describe("userAdminSlice — initial state", () => {
  test("initialises with correct defaults", () => {
    const state = userAdminReducer(undefined, { type: "@@INIT" });

    expect(state.users).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.page).toBe(1);
    expect(state.totalPages).toBe(0);
  });
});

// ─── getUsers lifecycle ───────────────────────────────────────────────────────
describe("userAdminSlice — getUsers", () => {
  test("sets loading=true and clears error on pending", () => {
    const state = userAdminReducer(
      { ...initialState, error: "old error" },
      { type: "admin/getUsers/pending" }
    );

    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  test("populates users and pagination on fulfilled", () => {
    const payload = {
      users: [makeUser(), makeUser({ _id: "user-2" })],
      total: 2,
      currentPage: 2,
      totalPages: 5,
    };

    const state = userAdminReducer(
      { ...initialState, loading: true },
      { type: "admin/getUsers/fulfilled", payload }
    );

    expect(state.loading).toBe(false);
    expect(state.users).toHaveLength(2);
    expect(state.total).toBe(2);
    expect(state.page).toBe(2);
    expect(state.totalPages).toBe(5);
  });

  test("uses fallback values when payload fields are missing", () => {
    const state = userAdminReducer(
      { ...initialState, loading: true },
      { type: "admin/getUsers/fulfilled", payload: {} }
    );

    expect(state.users).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.page).toBe(1);
    expect(state.totalPages).toBe(0);
  });

  test("sets error and loading=false on rejected (payload message)", () => {
    const state = userAdminReducer(
      { ...initialState, loading: true },
      {
        type: "admin/getUsers/rejected",
        payload: { message: "Unauthorized" },
        error: { message: "Unauthorized" },
      }
    );

    expect(state.loading).toBe(false);
    expect(state.error).toBe("Unauthorized");
  });
});

// ─── blockUser ────────────────────────────────────────────────────────────────
describe("userAdminSlice — blockUser", () => {
  test("sets isBlocked=true for the matching user", () => {
    const baseState = {
      ...initialState,
      users: [makeUser({ _id: "u1" }), makeUser({ _id: "u2" })],
    };

    const state = userAdminReducer(baseState, {
      type: "admin/blockUser/fulfilled",
      payload: { id: "u1" },
    });

    expect(state.users.find((u) => u._id === "u1").isBlocked).toBe(true);
    expect(state.users.find((u) => u._id === "u2").isBlocked).toBe(false);
  });

  test("does nothing when user id is not found", () => {
    const baseState = {
      ...initialState,
      users: [makeUser({ _id: "u1" })],
    };

    const state = userAdminReducer(baseState, {
      type: "admin/blockUser/fulfilled",
      payload: { id: "non-existent" },
    });

    expect(state.users[0].isBlocked).toBe(false);
  });
});

// ─── unblockUser ──────────────────────────────────────────────────────────────
describe("userAdminSlice — unblockUser", () => {
  test("sets isBlocked=false for the matching user", () => {
    const baseState = {
      ...initialState,
      users: [makeUser({ _id: "u1", isBlocked: true })],
    };

    const state = userAdminReducer(baseState, {
      type: "admin/unblockUser/fulfilled",
      payload: { id: "u1" },
    });

    expect(state.users[0].isBlocked).toBe(false);
  });

  test("does nothing when user id is not found", () => {
    const baseState = {
      ...initialState,
      users: [makeUser({ _id: "u1", isBlocked: true })],
    };

    const state = userAdminReducer(baseState, {
      type: "admin/unblockUser/fulfilled",
      payload: { id: "ghost-id" },
    });

    expect(state.users[0].isBlocked).toBe(true); // unchanged
  });
});

// ─── updateUserRole ───────────────────────────────────────────────────────────
describe("userAdminSlice — updateUserRole", () => {
  test("updates role for the matching user", () => {
    const baseState = {
      ...initialState,
      users: [makeUser({ _id: "u1", role: "user" })],
    };

    const state = userAdminReducer(baseState, {
      type: "admin/updateUserRole/fulfilled",
      payload: { id: "u1", role: "admin" },
    });

    expect(state.users[0].role).toBe("admin");
  });

  test("does not affect other users when updating role", () => {
    const baseState = {
      ...initialState,
      users: [
        makeUser({ _id: "u1", role: "user" }),
        makeUser({ _id: "u2", role: "user" }),
      ],
    };

    const state = userAdminReducer(baseState, {
      type: "admin/updateUserRole/fulfilled",
      payload: { id: "u1", role: "admin" },
    });

    expect(state.users.find((u) => u._id === "u1").role).toBe("admin");
    expect(state.users.find((u) => u._id === "u2").role).toBe("user");
  });

  test("does nothing when user id is not found", () => {
    const baseState = {
      ...initialState,
      users: [makeUser({ _id: "u1", role: "user" })],
    };

    const state = userAdminReducer(baseState, {
      type: "admin/updateUserRole/fulfilled",
      payload: { id: "unknown", role: "admin" },
    });

    expect(state.users[0].role).toBe("user"); // unchanged
  });
});
