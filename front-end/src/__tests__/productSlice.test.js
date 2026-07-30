/**
 * Tests for productSlice Redux reducer (synchronous reducers only).
 * Async thunks that depend on network calls are simulated via dispatched action types.
 */
import { jest, describe, test, expect } from "@jest/globals";

// Mock axiosInstance and all services BEFORE importing the slice
// (prevents import.meta.env crash in axiosInstance.js)
jest.unstable_mockModule("../utils/axiosInstance.js", () => ({
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.unstable_mockModule("../services/productService.js", () => ({
  fetchProductBySlug: jest.fn(),
  fetchProducts: jest.fn(),
  fetchSaleProducts: jest.fn(),
  filterProductsByPrice: jest.fn(),
}));
jest.unstable_mockModule("../services/categoryService.js", () => ({
  fetchProductsByCategory: jest.fn(),
  fetchProductsByCategoryName: jest.fn(),
}));

const { default: productReducer, setCurrentPage } = await import("../stores/productSlice.js");

// ─── helpers ──────────────────────────────────────────────────────────────────
const initialState = {
  items: [],
  categories: {},
  productSale: [],
  productDetail: null,
  productByCateoty: [],
  currentPage: 1,
  totalPages: 0,
  filterPrice: [],
  load: false,
  error: null,
};

// ─── initial state ────────────────────────────────────────────────────────────
describe("productSlice — initial state", () => {
  test("has the correct shape on first load", () => {
    const state = productReducer(undefined, { type: "@@INIT" });

    expect(state.items).toEqual([]);
    expect(state.categories).toEqual({});
    expect(state.productSale).toEqual([]);
    expect(state.productDetail).toBeNull();
    expect(state.currentPage).toBe(1);
    expect(state.totalPages).toBe(0);
    expect(state.load).toBe(false);
    expect(state.error).toBeNull();
  });
});

// ─── setCurrentPage ───────────────────────────────────────────────────────────
describe("productSlice — setCurrentPage", () => {
  test("sets currentPage to the given value", () => {
    const state = productReducer(initialState, setCurrentPage(3));
    expect(state.currentPage).toBe(3);
  });

  test("sets currentPage back to 1", () => {
    const prev = { ...initialState, currentPage: 5 };
    const state = productReducer(prev, setCurrentPage(1));
    expect(state.currentPage).toBe(1);
  });

  test("does not mutate other fields when changing page", () => {
    const prev = { ...initialState, items: [{ _id: "abc" }], totalPages: 10 };
    const state = productReducer(prev, setCurrentPage(2));

    expect(state.items).toEqual([{ _id: "abc" }]);
    expect(state.totalPages).toBe(10);
  });
});

// ─── fetchProducts lifecycle ──────────────────────────────────────────────────
describe("productSlice — fetchProducts lifecycle actions", () => {
  test("sets load=true on pending", () => {
    const state = productReducer(initialState, {
      type: "products/fetchProducts/pending",
    });
    expect(state.load).toBe(true);
  });

  test("sets items and load=false on fulfilled", () => {
    const products = [{ _id: "1", name: "Dog Food" }];
    const state = productReducer(
      { ...initialState, load: true },
      { type: "products/fetchProducts/fulfilled", payload: products }
    );

    expect(state.items).toEqual(products);
    expect(state.load).toBe(false);
  });

  test("sets error and load=true on rejected", () => {
    const state = productReducer(initialState, {
      type: "products/fetchProducts/rejected",
      error: { message: "Server error" },
    });

    expect(state.load).toBe(true);
    expect(state.error).toBe("Server error");
  });
});

// ─── fetachProductByName lifecycle ────────────────────────────────────────────
describe("productSlice — fetachProductByName lifecycle", () => {
  test("clears productDetail and error on pending", () => {
    const prev = { ...initialState, productDetail: { _id: "old" }, error: "old-error" };
    const state = productReducer(prev, {
      type: "products/fetachProductByName/pending",
    });

    expect(state.productDetail).toBeNull();
    expect(state.error).toBeNull();
    expect(state.load).toBe(true);
  });

  test("sets productDetail on fulfilled", () => {
    const detail = { _id: "abc", name: "Cat Toy" };
    const state = productReducer(
      { ...initialState, load: true },
      { type: "products/fetachProductByName/fulfilled", payload: detail }
    );

    expect(state.productDetail).toEqual(detail);
    expect(state.load).toBe(false);
  });

  test("sets error and load=false on rejected", () => {
    const state = productReducer(initialState, {
      type: "products/fetachProductByName/rejected",
      error: { message: "Not found" },
    });

    expect(state.load).toBe(false);
    expect(state.error).toBe("Not found");
  });
});

// ─── featchProductSale ────────────────────────────────────────────────────────
describe("productSlice — featchProductSale", () => {
  test("stores sale products on fulfilled", () => {
    const saleProducts = [{ _id: "s1", sale: true }];
    const state = productReducer(initialState, {
      type: "products/featchProductSale/fulfilled",
      payload: saleProducts,
    });

    expect(state.productSale).toEqual(saleProducts);
  });
});

// ─── featchProductByCategoryName ──────────────────────────────────────────────
describe("productSlice — featchProductByCategoryName", () => {
  test("sets productByCateoty and totalPages on fulfilled", () => {
    const payload = {
      products: [{ _id: "p1" }],
      totalPages: 7,
    };
    const state = productReducer(initialState, {
      type: "products/featchProductByCategoryName/fulfilled",
      payload,
    });

    expect(state.productByCateoty).toEqual(payload.products);
    expect(state.totalPages).toBe(7);
  });
});
