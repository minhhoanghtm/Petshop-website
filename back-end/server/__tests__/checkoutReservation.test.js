import mongoose from "mongoose";
import "../configs/env.js";
import redisClient from "../configs/redisClient.js";
import { projectionQueue } from "../queues/projectionQueue.js";
import { orderExpiryQueue } from "../queues/orderExpiryQueue.js";
import queueRedis from "../configs/queueRedis.js";

// Patch BullMQ add methods to resolve immediately in tests
projectionQueue.add = () => Promise.resolve({ id: "mock-job-id" });
orderExpiryQueue.add = () => Promise.resolve({ id: "mock-job-id" });
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import {
  reserveCheckoutStock,
  refreshCheckoutStock,
  commitCheckoutStock,
  adjustProductsStockWithReservations,
} from "../services/checkoutReservationService.js";
import { createOrder } from "../services/orderService.js";
import User from "../models/User.js";
import EventStore from "../models/EventStore.js";
import Order from "../models/Order.js";

describe("Checkout Inventory Reservation & Concurrency Tests", () => {
  let testCategory;
  let testProduct;
  let testUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean DB
    await Product.deleteMany({ name: /Test Reserve Product/ });
    await Category.deleteMany({ name: /Test Reserve Category/ });
    await User.deleteMany({ email: /test_reserve_user/ });
    await EventStore.deleteMany({});
    await Order.deleteMany({});

    testCategory = await Category.create({
      name: "Test Reserve Category",
      slug: "test-reserve-category",
      description: "Test Category",
      type: "SHOP CHO CÚN",
      slug_type: "shop-cho-cun",
    });

    testProduct = await Product.create({
      name: "Test Reserve Product",
      slug: "test-reserve-product",
      price: 150000,
      stock: 50,
      description: "Test product with stock 50",
      category_id: testCategory._id,
    });

    testUser = await User.create({
      email: "test_reserve_user@gmail.com",
      fullName: "Test User",
      birthDate: new Date("1995-05-15"),
      gender: "male",
      status: "Active",
      password: "test_password_123",
    });
  });

  afterAll(async () => {
    await Product.deleteMany({ name: /Test Reserve Product/ });
    await Category.deleteMany({ name: /Test Reserve Category/ });
    await User.deleteMany({ email: /test_reserve_user/ });
    await EventStore.deleteMany({});
    await Order.deleteMany({});

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clear Redis stores
    if (redisClient.isMock) {
      // Clear mock Redis manually
      // We can just call del on keys we use
      await redisClient.del(`reservation:user:${testUser._id}`);
      await redisClient.del(`reserved:product:expiry:${testProduct._id}`);
      await redisClient.del(`reserved:product:counter:${testProduct._id}`);
      await redisClient.del(`lock:checkout:${testUser._id}`);
    } else {
      await redisClient.flushAll();
    }
    // Restore product stock
    await Product.updateOne({ _id: testProduct._id }, { $set: { stock: 50 } });
  });

  test("Should reserve stock successfully and return version 1", async () => {
    const result = await reserveCheckoutStock(testUser._id, [
      { productId: testProduct._id.toString(), quantity: 5 },
    ]);

    expect(result.ok).toBe(true);
    expect(result.version).toBe(1);

    // Verify counter
    const reservedQty = await redisClient.get(`reserved:product:counter:${testProduct._id}`);
    expect(Number(reservedQty)).toBe(5);

    // Verify adjustProductsStockWithReservations
    const rawProduct = await Product.findById(testProduct._id).lean();
    expect(rawProduct.stock).toBe(50);

    const adjustedProduct = await adjustProductsStockWithReservations(rawProduct);
    expect(adjustedProduct.stock).toBe(45);
  });

  test("Should fail if reservation quantity exceeds available stock", async () => {
    // 50 stock, try to reserve 51
    await expect(
      reserveCheckoutStock(testUser._id, [
        { productId: testProduct._id.toString(), quantity: 51 },
      ])
    ).rejects.toThrow("không đủ số lượng trong kho");
  });

  test("Should support multi-tab update: Tab B overwrites Tab A reservation and increments version", async () => {
    // Tab A reserves 5
    const resA = await reserveCheckoutStock(testUser._id, [
      { productId: testProduct._id.toString(), quantity: 5 },
    ]);
    expect(resA.version).toBe(1);

    // Tab B reserves 10 (overwrites)
    const resB = await reserveCheckoutStock(testUser._id, [
      { productId: testProduct._id.toString(), quantity: 10 },
    ]);
    expect(resB.version).toBe(2);

    // Verify total counter is 10, not 15
    const reservedQty = await redisClient.get(`reserved:product:counter:${testProduct._id}`);
    expect(Number(reservedQty)).toBe(10);
  });

  test("Should reject createOrder if reservation version is stale (optimistic concurrency)", async () => {
    // Create reservation (version 1)
    await reserveCheckoutStock(testUser._id, [
      { productId: testProduct._id.toString(), quantity: 5 },
    ]);

    // Overwrite reservation (becomes version 2)
    await reserveCheckoutStock(testUser._id, [
      { productId: testProduct._id.toString(), quantity: 5 },
    ]);

    // Submit order with version 1 (stale)
    const orderData = {
      user_id: testUser._id.toString(),
      items: [{ product_id: testProduct._id.toString(), quantity: 5 }],
      total_price: 750000,
      fullName: "Test Customer",
      email: "cust@gmail.com",
      phone: "0909090909",
      address: "123 Street",
      province: "Hồ Chí Minh",
      payment_method: "COD",
      checkoutVersion: 1, // Stale
    };

    await expect(createOrder(orderData)).rejects.toThrow("STALE_RESERVATION");
  });

  test("Should place order successfully if version matches, commit Redis, and decrement DB stock", async () => {
    const res = await reserveCheckoutStock(testUser._id, [
      { productId: testProduct._id.toString(), quantity: 5 },
    ]);
    expect(res.version).toBe(1);

    const orderData = {
      user_id: testUser._id.toString(),
      items: [{ product_id: testProduct._id.toString(), quantity: 5 }],
      total_price: 750000,
      fullName: "Test Customer",
      email: "cust@gmail.com",
      phone: "0909090909",
      address: "123 Street",
      province: "Hồ Chí Minh",
      payment_method: "COD",
      checkoutVersion: 1, // Matches
    };

    const order = await createOrder(orderData);
    expect(order._id).toBeDefined();

    // Verify DB stock is decremented synchronously
    const product = await Product.findById(testProduct._id);
    expect(product.stock).toBe(45);

    // Verify Redis reservation key is deleted
    const resStr = await redisClient.get(`reservation:user:${testUser._id}`);
    expect(resStr).toBeNull();

    // Verify Redis counter is decremented back to 0
    const reservedQty = await redisClient.get(`reserved:product:counter:${testProduct._id}`);
    expect(Number(reservedQty || 0)).toBe(0);
  }, 30000);

  test("Should handle Redis restart gracefully: refresh throws error, createOrder throws RESERVATION_LOST", async () => {
    // Reserve stock
    await reserveCheckoutStock(testUser._id, [
      { productId: testProduct._id.toString(), quantity: 5 },
    ]);

    // Simulate Redis restart (flush Redis)
    if (redisClient.isMock) {
      await redisClient.del(`reservation:user:${testUser._id}`);
      await redisClient.del(`reserved:product:expiry:${testProduct._id}`);
      await redisClient.del(`reserved:product:counter:${testProduct._id}`);
    } else {
      await redisClient.flushAll();
    }

    // Refresh should fail with 404
    await expect(refreshCheckoutStock(testUser._id)).rejects.toThrow();

    // Order submission should fail with RESERVATION_LOST
    const orderData = {
      user_id: testUser._id.toString(),
      items: [{ product_id: testProduct._id.toString(), quantity: 5 }],
      total_price: 750000,
      fullName: "Test Customer",
      email: "cust@gmail.com",
      phone: "0909090909",
      address: "123 Street",
      province: "Hồ Chí Minh",
      payment_method: "COD",
      checkoutVersion: 1,
    };

    await expect(createOrder(orderData)).rejects.toThrow("RESERVATION_LOST");
  }, 30000);

  test("Concurrency: 100 concurrent reservations should not oversell", async () => {
    // Product has 50 stock. We run 100 users trying to reserve 1 stock each.
    // Only 50 should succeed, 50 should fail.
    const userIds = Array.from({ length: 100 }, () => new mongoose.Types.ObjectId());
    const tasks = userIds.map((uId) =>
      reserveCheckoutStock(uId, [{ productId: testProduct._id.toString(), quantity: 1 }])
        .then(() => true)
        .catch(() => false)
    );

    const results = await Promise.all(tasks);
    const successes = results.filter(Boolean).length;
    const failures = results.filter((x) => !x).length;

    expect(successes).toBe(50);
    expect(failures).toBe(50);

    // Verify counter is exactly 50
    const reservedQty = await redisClient.get(`reserved:product:counter:${testProduct._id}`);
    expect(Number(reservedQty)).toBe(50);
  });

  test("Should prevent concurrent checkouts for the same user via SETNX lock", async () => {
    // Prepare reservation for testUser
    await reserveCheckoutStock(testUser._id, [
      { productId: testProduct._id.toString(), quantity: 1 },
    ]);

    const orderData = {
      user_id: testUser._id.toString(),
      items: [{ product_id: testProduct._id.toString(), quantity: 1 }],
      total_price: 999999, // client-supplied total price
      fullName: "Test Customer",
      email: "cust@gmail.com",
      phone: "0909090909",
      address: "123 Street",
      province: "Hồ Chí Minh",
      payment_method: "COD",
      checkoutVersion: 1,
    };

    // Fire 2 concurrent checkouts for the same user
    const promises = [
      createOrder(orderData),
      createOrder(orderData),
    ];

    const results = await Promise.allSettled(promises);
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failedWithLock = results.filter(
      (r) => r.status === "rejected" && r.reason.message.includes("yêu cầu trùng lặp")
    );

    // One must succeed, and the other must be rejected by the lock
    expect(succeeded.length).toBe(1);
    expect(failedWithLock.length).toBe(1);
  }, 30000);

  test("Should recalculate total price on backend and ignore client-supplied total_price", async () => {
    await reserveCheckoutStock(testUser._id, [
      { productId: testProduct._id.toString(), quantity: 2 },
    ]);

    const orderData = {
      user_id: testUser._id.toString(),
      items: [{ product_id: testProduct._id.toString(), quantity: 2 }],
      total_price: 1000, // Malicious client price
      fullName: "Test Customer",
      email: "cust@gmail.com",
      phone: "0909090909",
      address: "123 Street",
      province: "Hồ Chí Minh",
      payment_method: "COD",
      checkoutVersion: 1,
    };

    const order = await createOrder(orderData);
    // Recalculated total should be: product price (150,000) * 2 = 300,000
    expect(order.total_price).toBe(300000);
  }, 30000);
});
