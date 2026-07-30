/**
 * Tests for cartSlice Redux reducer.
 * We test the reducer as a pure function — no store needed.
 * toast and localStorage side-effects are mocked/spied.
 */
import { jest, beforeEach, describe, test, expect } from "@jest/globals";

// Mock react-toastify
jest.unstable_mockModule("react-toastify", () => ({
  toast: {
    success: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Dynamic import AFTER mocking (required for ESM)
const { default: cartReducer, addToCart, decreaseCart, removeFromCart, getTotals } =
  await import("../stores/cartSlice.js");

// ─── helpers ─────────────────────────────────────────────────────────────────
const emptyState = {
  cartItems: [],
  cartTotalQuantity: 0,
  cartTotalAmount: 0,
};

const makeProduct = (overrides = {}) => ({
  _id: "prod-1",
  id: "prod-1",
  name: "Dog Food",
  price: 100,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

// ─── initial state ────────────────────────────────────────────────────────────
describe("cartSlice — initial state", () => {
  test("starts with empty cart when localStorage is empty", () => {
    const state = cartReducer(undefined, { type: "@@INIT" });
    expect(Array.isArray(state.cartItems)).toBe(true);
    expect(state.cartTotalQuantity).toBe(0);
    expect(state.cartTotalAmount).toBe(0);
  });
});

// ─── addToCart ────────────────────────────────────────────────────────────────
describe("cartSlice — addToCart", () => {
  test("adds a new product to an empty cart", () => {
    const product = makeProduct();
    const state = cartReducer(emptyState, addToCart(product));

    expect(state.cartItems).toHaveLength(1);
    expect(state.cartItems[0]._id).toBe("prod-1");
    expect(state.cartItems[0].cartQuantity).toBe(1);
  });

  test("increments cartQuantity when same product is added again", () => {
    const product = makeProduct();
    let state = cartReducer(emptyState, addToCart(product));
    state = cartReducer(state, addToCart(product));

    expect(state.cartItems).toHaveLength(1);
    expect(state.cartItems[0].cartQuantity).toBe(2);
  });

  test("adds multiple distinct products", () => {
    const p1 = makeProduct({ _id: "p1", id: "p1" });
    const p2 = makeProduct({ _id: "p2", id: "p2", name: "Cat Food" });

    let state = cartReducer(emptyState, addToCart(p1));
    state = cartReducer(state, addToCart(p2));

    expect(state.cartItems).toHaveLength(2);
  });

  test("updates cartTotalQuantity after adding twice", () => {
    const product = makeProduct();
    let state = cartReducer(emptyState, addToCart(product));
    state = cartReducer(state, addToCart(product));

    expect(state.cartTotalQuantity).toBe(2);
  });

  test("persists cartItems to localStorage", () => {
    const product = makeProduct();
    cartReducer(emptyState, addToCart(product));

    const stored = JSON.parse(localStorage.getItem("cartItems"));
    expect(stored).toHaveLength(1);
    expect(stored[0]._id).toBe("prod-1");
  });
});

// ─── decreaseCart ─────────────────────────────────────────────────────────────
describe("cartSlice — decreaseCart", () => {
  test("decrements quantity when cartQuantity > 1", () => {
    const baseState = {
      ...emptyState,
      cartItems: [{ ...makeProduct(), cartQuantity: 3 }],
    };

    const state = cartReducer(baseState, decreaseCart(makeProduct()));
    expect(state.cartItems[0].cartQuantity).toBe(2);
  });

  test("removes item when cartQuantity === 1", () => {
    const baseState = {
      ...emptyState,
      cartItems: [{ ...makeProduct(), cartQuantity: 1 }],
    };

    const state = cartReducer(baseState, decreaseCart(makeProduct()));
    expect(state.cartItems).toHaveLength(0);
  });

  test("only decreases the matched item", () => {
    const baseState = {
      ...emptyState,
      cartItems: [
        { ...makeProduct({ _id: "p1", id: "p1" }), cartQuantity: 3 },
        { ...makeProduct({ _id: "p2", id: "p2" }), cartQuantity: 2 },
      ],
    };

    const state = cartReducer(baseState, decreaseCart(makeProduct({ _id: "p1", id: "p1" })));

    expect(state.cartItems.find((i) => i.id === "p1").cartQuantity).toBe(2);
    expect(state.cartItems.find((i) => i.id === "p2").cartQuantity).toBe(2);
  });
});

// ─── removeFromCart ───────────────────────────────────────────────────────────
describe("cartSlice — removeFromCart", () => {
  test("removes the specified product from the cart", () => {
    const baseState = {
      ...emptyState,
      cartItems: [
        { ...makeProduct({ id: "p1" }), cartQuantity: 2 },
        { ...makeProduct({ id: "p2" }), cartQuantity: 1 },
      ],
    };

    const state = cartReducer(baseState, removeFromCart(makeProduct({ id: "p1" })));

    expect(state.cartItems.find((i) => i.id === "p1")).toBeUndefined();
    expect(state.cartItems).toHaveLength(1);
  });

  test("does not affect other items", () => {
    const baseState = {
      ...emptyState,
      cartItems: [
        { ...makeProduct({ id: "p1" }), cartQuantity: 2 },
        { ...makeProduct({ id: "p2" }), cartQuantity: 5 },
      ],
    };

    const state = cartReducer(baseState, removeFromCart(makeProduct({ id: "p1" })));

    expect(state.cartItems[0].id).toBe("p2");
    expect(state.cartItems[0].cartQuantity).toBe(5);
  });
});

// ─── getTotals ────────────────────────────────────────────────────────────────
describe("cartSlice — getTotals", () => {
  test("calculates total amount and quantity correctly", () => {
    const baseState = {
      ...emptyState,
      cartItems: [
        { ...makeProduct({ price: 100 }), cartQuantity: 2 },
        { ...makeProduct({ _id: "p2", price: 50 }), cartQuantity: 3 },
      ],
    };

    const state = cartReducer(baseState, getTotals());

    expect(state.cartTotalQuantity).toBe(5);
    expect(state.cartTotalAmount).toBe(350);
  });

  test("returns zero totals for empty cart", () => {
    const state = cartReducer(emptyState, getTotals());

    expect(state.cartTotalQuantity).toBe(0);
    expect(state.cartTotalAmount).toBe(0);
  });

  test("rounds total to 2 decimal places", () => {
    const baseState = {
      ...emptyState,
      cartItems: [{ ...makeProduct({ price: 10.005 }), cartQuantity: 2 }],
    };

    const state = cartReducer(baseState, getTotals());
    const decimalPlaces = (state.cartTotalAmount.toString().split(".")[1] || "").length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});
