import mongoose from "mongoose";
import "../configs/env.js";
import { claimVoucher } from "../services/voucherService.js";
import { createOrder } from "../services/orderService.js";
import Voucher from "../models/Voucher.js";
import UserVoucher from "../models/UserVoucher.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import EventStore from "../models/EventStore.js";
import Order from "../models/Order.js";
import { hashPassword } from "../utils/passwordUtils.js";

describe("Voucher System Concurrency & Safety Tests", () => {
  let testUser;
  let testCategory;
  let testProduct;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean DB
    await UserVoucher.deleteMany({});
    await Voucher.deleteMany({});
    await Order.deleteMany({});
    await EventStore.deleteMany({});
    await User.deleteMany({ email: /concur_test/ });
    await Product.deleteMany({ name: /Concur Product/ });
    await Category.deleteMany({ name: /Concur Category/ });

    testUser = await User.create({
      email: "concur_test_user@gmail.com",
      password: hashPassword("user_pass_123"),
      fullName: "Concurrency User",
      birthDate: new Date("2500-01-01"),
      gender: "male",
      status: "Active",
      level: "silver",
    });

    testCategory = await Category.create({
      name: "Concur Category",
      slug: "concur-category",
      description: "Concur Category Description",
      type: "SHOP CHO CÚN",
      slug_type: "shop-cho-cun",
    });

    testProduct = await Product.create({
      name: "Concur Product",
      slug: "concur-product",
      price: 50000,
      stock: 200,
      description: "Concur Product Description",
      category_id: testCategory._id,
    });
  });

  afterAll(async () => {
    await UserVoucher.deleteMany({});
    await Voucher.deleteMany({});
    await Order.deleteMany({});
    await EventStore.deleteMany({});
    if (testUser) await User.deleteOne({ _id: testUser._id });
    if (testProduct) await Product.deleteOne({ _id: testProduct._id });
    if (testCategory) await Category.deleteOne({ _id: testCategory._id });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  afterEach(async () => {
    await UserVoucher.deleteMany({});
    await Voucher.deleteMany({});
    await Order.deleteMany({});
    await EventStore.deleteMany({});
  });

  test("Should prevent overselling when 40 users try to claim a voucher with stock = 1", async () => {
    const voucher = await Voucher.create({
      name: "Flash Sale 1 Slot",
      code: "FLASHSALE",
      type: "PERCENT",
      value: 90,
      totalQuantity: 1, // Only 1 slot
      usageLimitPerUser: 1,
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      applicableUserLevels: ["silver"],
    });

    // Create 40 user IDs to concurrently make the claim
    const concurrentUsers = [];
    const usersToCreate = [];
    for (let i = 0; i < 40; i++) {
      const uId = new mongoose.Types.ObjectId();
      concurrentUsers.push(uId);
      usersToCreate.push({
        _id: uId,
        email: `concur_test_u_${i}@gmail.com`,
        password: hashPassword("user_pass_123"),
        fullName: `Concurrency User ${i}`,
        birthDate: new Date(),
        gender: "male",
        status: "Active",
        level: "silver",
      });
    }

    // Bulk insert users for speed
    await User.insertMany(usersToCreate);

    // Spawn 40 claims concurrently using Promise.allSettled
    const results = await Promise.allSettled(
      concurrentUsers.map((uId) => claimVoucher(uId, "FLASHSALE"))
    );

    // Filter successes and failures
    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    // Clean up temporary users
    await User.deleteMany({ email: /concur_test_u_/ });

    // Verify atomic check worked
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(39);

    const updatedVoucher = await Voucher.findById(voucher._id);
    expect(updatedVoucher.claimedCount).toBe(1);

    const totalClaims = await UserVoucher.countDocuments({ voucherId: voucher._id });
    expect(totalClaims).toBe(1);
  }, 30000);

  test("Should prevent double-consume when concurrent orders try to apply the same user voucher", async () => {
    const voucher = await Voucher.create({
      name: "Apply Concurrency",
      code: "APPLYCONCUR",
      type: "FIXED",
      value: 10000,
      totalQuantity: 5,
      usageLimitPerUser: 1,
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      applicableUserLevels: ["silver"],
    });

    // Claim the voucher first
    await claimVoucher(testUser._id, "APPLYCONCUR");

    // Double order payload applying the same voucher code
    const orderPayload1 = {
      user_id: testUser._id.toString(),
      items: [{ product_id: testProduct._id.toString(), quantity: 1 }],
      total_price: 50000,
      fullName: "Test Customer",
      email: "concur_test_user@gmail.com",
      phone: "0901234567",
      address: "123 Street",
      province: "HCM",
      deliveryOption: "delivery",
      shippingCost: 30000,
      voucherCode: "APPLYCONCUR",
      paymentMethod: "COD",
    };

    const orderPayload2 = { ...orderPayload1 };

    // Fire checkout requests concurrently
    const results = await Promise.allSettled([
      createOrder(orderPayload1),
      createOrder(orderPayload2),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    // Validate that only 1 order succeeded and the other rolled back due to atomic lock
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Verify UserVoucher remains isUsed: true and linked to exactly one order
    const uv = await UserVoucher.findOne({ userId: testUser._id, voucherId: voucher._id });
    expect(uv.isUsed).toBe(true);
    expect(uv.orderId).toBeDefined();

    // Verify usedCount is exactly 1
    const updatedV = await Voucher.findById(voucher._id);
    expect(updatedV.usedCount).toBe(1);
  });
});
