import mongoose from "mongoose";
import "../configs/env.js";
import {
  createVoucher,
  updateVoucher,
  softDeleteVoucher,
  claimVoucher,
  validateAndCalculateVoucher,
} from "../services/voucherService.js";
import Voucher from "../models/Voucher.js";
import UserVoucher from "../models/UserVoucher.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { hashPassword } from "../utils/passwordUtils.js";

describe("Voucher System Unit Tests", () => {
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
    await User.deleteMany({ email: /test_voucher/ });
    await Product.deleteMany({ name: /Test Product Voucher/ });
    await Category.deleteMany({ name: /Test Cat Voucher/ });

    // Seed test data
    testUser = await User.create({
      email: "test_voucher_user@gmail.com",
      password: hashPassword("user_pass_123"),
      fullName: "Test Voucher User",
      birthDate: new Date("2000-01-01"),
      gender: "male",
      status: "Active",
      level: "silver",
    });

    testCategory = await Category.create({
      name: "Test Cat Voucher",
      slug: "test-cat-voucher",
      description: "Test Category for Vouchers",
      type: "SHOP CHO CÚN",
      slug_type: "shop-cho-cun",
    });

    testProduct = await Product.create({
      name: "Test Product Voucher",
      slug: "test-product-voucher",
      price: 100000,
      stock: 50,
      description: "Test Product",
      category_id: testCategory._id,
    });
  });

  afterAll(async () => {
    await UserVoucher.deleteMany({});
    await Voucher.deleteMany({});
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
  });

  test("Should fail if creating voucher with duplicate code", async () => {
    await Voucher.create({
      name: "Voucher 1",
      code: "WELCOME10",
      type: "PERCENT",
      value: 10,
      totalQuantity: 10,
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await expect(
      createVoucher({
        name: "Voucher 2",
        code: "WELCOME10",
        type: "PERCENT",
        value: 15,
        totalQuantity: 5,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
    ).rejects.toThrow("Mã voucher này đã tồn tại.");
  });

  test("Should reject percentage value greater than 100%", async () => {
    await expect(
      createVoucher({
        name: "Invalid Percent",
        code: "PERCENT150",
        type: "PERCENT",
        value: 150,
        totalQuantity: 10,
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
    ).rejects.toThrow();
  });

  test("Should reject end date earlier than start date", async () => {
    await expect(
      createVoucher({
        name: "Invalid Date",
        code: "INVALIDDATE",
        type: "FIXED",
        value: 5000,
        totalQuantity: 10,
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(),
      })
    ).rejects.toThrow();
  });

  test("Should claim voucher successfully and increase claimedCount", async () => {
    const voucher = await createVoucher({
      name: "Claim Test",
      code: "CLAIMTEST",
      type: "PERCENT",
      value: 10,
      totalQuantity: 5,
      usageLimitPerUser: 1,
      startDate: new Date(Date.now() - 60 * 60 * 1000), // Active
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      applicableUserLevels: ["silver", "gold"],
    });

    const res = await claimVoucher(testUser._id, "CLAIMTEST");
    expect(res).toHaveProperty("userVoucher");
    expect(res.voucherCode).toBe("CLAIMTEST");

    const updated = await Voucher.findById(voucher._id);
    expect(updated.claimedCount).toBe(1);

    const userVoucher = await UserVoucher.findOne({ userId: testUser._id, voucherId: voucher._id });
    expect(userVoucher).toBeDefined();
    expect(userVoucher.claimIndex).toBe(1);
  });

  test("Should reject claim if user level does not match", async () => {
    await createVoucher({
      name: "VIP only",
      code: "VIP50",
      type: "PERCENT",
      value: 50,
      totalQuantity: 10,
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      applicableUserLevels: ["vip"], // User level is silver
    });

    await expect(claimVoucher(testUser._id, "VIP50")).rejects.toThrow(
      "Voucher này không áp dụng cho cấp bậc tài khoản của bạn."
    );
  });

  test("Should reject claim if per-user claim limit is exceeded", async () => {
    await createVoucher({
      name: "One Time",
      code: "ONETIME",
      type: "PERCENT",
      value: 10,
      totalQuantity: 10,
      usageLimitPerUser: 1,
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      applicableUserLevels: ["silver"],
    });

    await claimVoucher(testUser._id, "ONETIME");

    // Second claim should fail
    await expect(claimVoucher(testUser._id, "ONETIME")).rejects.toThrow(
      "Bạn đã đạt giới hạn nhận voucher này"
    );
  });

  test("Should validate and calculate correct discount on applicable products", async () => {
    const voucher = await createVoucher({
      name: "Specific Product",
      code: "PRODUCT15",
      type: "PERCENT",
      value: 15,
      totalQuantity: 10,
      minOrderValue: 50000,
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      applicableProducts: [testProduct._id],
    });

    // Claim first
    await claimVoucher(testUser._id, "PRODUCT15");

    // Valid calculate
    const cart = [{ product_id: testProduct._id.toString(), quantity: 2 }]; // 200k subtotal
    const result = await validateAndCalculateVoucher(testUser._id, "PRODUCT15", cart, 30000, "delivery");

    expect(result.discountAmount).toBe(30000); // 15% of 200k = 30k
    expect(result.applicableSubtotal).toBe(200000);
  });

  test("Should reject voucher apply if cart subtotal is less than minOrderValue", async () => {
    await createVoucher({
      name: "Min Spend",
      code: "MINSPEND",
      type: "FIXED",
      value: 10000,
      totalQuantity: 10,
      minOrderValue: 300000, // min 300k
      startDate: new Date(Date.now() - 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await claimVoucher(testUser._id, "MINSPEND");

    const cart = [{ product_id: testProduct._id.toString(), quantity: 1 }]; // 100k < 300k
    await expect(
      validateAndCalculateVoucher(testUser._id, "MINSPEND", cart, 30000, "delivery")
    ).rejects.toThrow("Giá trị sản phẩm áp dụng chưa đạt mức tối thiểu");
  });
});
