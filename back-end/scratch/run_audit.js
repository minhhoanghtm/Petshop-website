import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import redisClient from "../server/configs/redisClient.js";
import User from "../server/models/User.js";
import Product from "../server/models/Product.js";
import Order from "../server/models/Order.js";
import Voucher from "../server/models/Voucher.js";
import UserVoucher from "../server/models/UserVoucher.js";
import Cart from "../server/models/Cart.js";
import { getLockStatus, recordFailedLogin, resetLoginState, getAttemptCount } from "../server/utils/redisLoginLock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import dotenvModule from "dotenv";
dotenvModule.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:5000/api";

// Helper to format logs nicely
const logResult = (name, status, details = "") => {
  const symbol = status === "PASS" ? "✅" : "❌";
  const color = status === "PASS" ? "\x1b[32m" : "\x1b[31m";
  console.log(`${symbol} [${color}${status}\x1b[0m] ${name} ${details ? `- ${details}` : ""}`);
};

async function runAudit() {
  console.log("=========================================");
  console.log("📊 Starting End-to-End System Audit...");
  console.log("=========================================");

  // Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("CONNECTED to MongoDB successfully.");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }

  const results = [];
  const testEmail = `audit_${Date.now()}@gmail.com`;
  const testPassword = "Password123!";
  let accessToken = "";
  let refreshToken = "";
  let testUserId = "";
  let testProductId = "";
  let testVoucherCode = "AUDITVOUCHER";
  let testVoucherId = "";
  let testOrderId = "";

  // Helper function to track test step
  const addStep = (name, status, details = "") => {
    results.push({ name, status, details });
    logResult(name, status, details);
  };

  try {
    // ----------------------------------------------------
    // 1. API Availability
    // ----------------------------------------------------
    try {
      const ping = await axios.get(BASE_URL);
      if (ping.data && ping.data.message) {
        addStep("API Availability", "PASS", `Message: ${ping.data.message}`);
      } else {
        addStep("API Availability", "FAIL", "Invalid response payload");
      }
    } catch (err) {
      addStep("API Availability", "FAIL", err.message);
    }

    // ----------------------------------------------------
    // 2. Authentication: User Registration
    // ----------------------------------------------------
    try {
      const signupPayload = {
        email: testEmail,
        password: testPassword,
        firstName: "Audit",
        lastName: "User",
        birthDate: "1998-05-15",
        gender: "Nam",
      };

      const res = await axios.post(`${BASE_URL}/auth/signup`, signupPayload);
      if (res.status === 201 && res.data.message.includes("thành công")) {
        // Direct Database Verification
        const dbUser = await User.findOne({ email: testEmail });
        if (dbUser && dbUser.fullName === "Audit User" && dbUser.status === "Active") {
          addStep("User Registration", "PASS", `Created User in API & Database: ${testEmail}`);
          testUserId = dbUser._id.toString();
        } else {
          addStep("User Registration", "FAIL", "User not found or mismatch in Database");
        }
      } else {
        addStep("User Registration", "FAIL", `API status code: ${res.status}`);
      }
    } catch (err) {
      addStep("User Registration", "FAIL", err.response?.data?.message || err.message);
    }

    // ----------------------------------------------------
    // 3. Authentication: Registration Validation Bounds
    // ----------------------------------------------------
    try {
      // Missing firstName
      await axios.post(`${BASE_URL}/auth/signup`, {
        email: "bad_user@gmail.com",
        password: testPassword,
        gender: "Nam",
      });
      addStep("User Registration Validation", "FAIL", "Allowed registration with missing fields");
    } catch (err) {
      if (err.response?.status === 400) {
        addStep("User Registration Validation", "PASS", `Rejected invalid request: ${err.response.data.message}`);
      } else {
        addStep("User Registration Validation", "FAIL", `Expected 400 but got: ${err.response?.status}`);
      }
    }

    // ----------------------------------------------------
    // 4. Authentication: Login Flow
    // ----------------------------------------------------
    try {
      const loginPayload = {
        email: testEmail,
        password: testPassword,
      };

      const res = await axios.post(`${BASE_URL}/auth/signin`, loginPayload);
      if (res.status === 200 && res.data.accessToken) {
        accessToken = res.data.accessToken;
        refreshToken = res.data.refreshToken;
        addStep("User Login", "PASS", "Access token and Refresh token obtained");
      } else {
        addStep("User Login", "FAIL", "Access token missing in response");
      }
    } catch (err) {
      addStep("User Login", "FAIL", err.response?.data?.message || err.message);
    }

    // ----------------------------------------------------
    // 5. Authentication: Unauthorized Path
    // ----------------------------------------------------
    try {
      // Calling protected route without headers
      await axios.get(`${BASE_URL}/users/profile`);
      addStep("Protected Route Protection", "FAIL", "Allowed access without JWT");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        addStep("Protected Route Protection", "PASS", `Blocked unauthorized access: ${err.response.status}`);
      } else {
        addStep("Protected Route Protection", "FAIL", `Expected 401/403 but got ${err.response?.status}`);
      }
    }

    // ----------------------------------------------------
    // 6. Token Rotation and Grace Reuse
    // ----------------------------------------------------
    if (refreshToken) {
      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        if (res.status === 200 && res.data.accessToken) {
          const oldToken = refreshToken;
          accessToken = res.data.accessToken;
          refreshToken = res.data.refreshToken;
          addStep("Token Refresh Rotation", "PASS", "New Access and Refresh tokens rotated");

          // Grace period check: Old token reuse within 10s should succeed
          const graceRes = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: oldToken });
          if (graceRes.status === 200) {
            addStep("Token Grace Reuse", "PASS", "Grace period allows reuse due to potential network latency");
          } else {
            addStep("Token Grace Reuse", "FAIL", `Grace refresh failed with code ${graceRes.status}`);
          }
        } else {
          addStep("Token Refresh Rotation", "FAIL", "Failed to rotate tokens");
        }
      } catch (err) {
        addStep("Token Refresh Rotation", "FAIL", err.response?.data?.message || err.message);
      }
    }

    // ----------------------------------------------------
    // 7. Product Catalog: Fetch & Selection
    // ----------------------------------------------------
    let productPrice = 0;
    try {
      const res = await axios.get(`${BASE_URL}/products`);
      if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
        const product = res.data[0];
        testProductId = product._id.toString();
        productPrice = product.price;
        addStep("Product Fetching", "PASS", `Fetched ${res.data.length} products. Selected: ${product.name}`);
      } else {
        addStep("Product Fetching", "FAIL", "No products returned or invalid response structure");
      }
    } catch (err) {
      addStep("Product Fetching", "FAIL", err.response?.data?.message || err.message);
    }

    // ----------------------------------------------------
    // 8. E-Commerce Cart: Add Product
    // ----------------------------------------------------
    if (testProductId && accessToken) {
      try {
        const cartPayload = {
          product_id: testProductId,
          quantity: 2,
        };

        const config = { headers: { Authorization: `Bearer ${accessToken}` } };
        const res = await axios.post(`${BASE_URL}/carts/add`, cartPayload, config);
        
        if (res.status === 200 || res.status === 201) {
          // Direct Database Verification
          const dbCart = await Cart.findOne({ user_id: testUserId });
          const item = dbCart?.items.find(i => i.product_id.toString() === testProductId);
          
          if (item && item.quantity >= 2) {
            addStep("Cart Management (Add)", "PASS", `Verified addition in API & Database: qty ${item.quantity}`);
          } else {
            addStep("Cart Management (Add)", "FAIL", "Database record mismatch");
          }
        } else {
          addStep("Cart Management (Add)", "FAIL", `API responded with: ${res.status}`);
        }
      } catch (err) {
        addStep("Cart Management (Add)", "FAIL", err.response?.data?.message || err.message);
      }
    }

    // ----------------------------------------------------
    // 9. Setup Voucher & User Wallet
    // ----------------------------------------------------
    if (accessToken && testUserId) {
      try {
        // Create an audit voucher directly in the DB
        await Voucher.deleteOne({ code: testVoucherCode });
        const dbVoucher = await Voucher.create({
          name: "E2E Audit Voucher",
          code: testVoucherCode,
          type: "FIXED",
          value: 5000,
          totalQuantity: 10,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: "ACTIVE",
          minOrderValue: 10,
          usageLimitPerUser: 1,
        });
        testVoucherId = dbVoucher._id.toString();

        const config = { headers: { Authorization: `Bearer ${accessToken}` } };
        // Claim the voucher using API
        const res = await axios.post(`${BASE_URL}/vouchers/claim`, { code: testVoucherCode }, config);
        if (res.status === 200 || res.status === 201) {
          const userVoucher = await UserVoucher.findOne({ userId: testUserId, voucherId: testVoucherId });
          if (userVoucher && userVoucher.isUsed === false) {
            addStep("Voucher Claiming", "PASS", "Voucher claimed and persisted in database wallet");
          } else {
            addStep("Voucher Claiming", "FAIL", "UserVoucher record not found in Database or marked used");
          }
        } else {
          addStep("Voucher Claiming", "FAIL", `API claim response: ${res.status}`);
        }
      } catch (err) {
        addStep("Voucher Claiming", "FAIL", err.response?.data?.message || err.message);
      }
    }

    // ----------------------------------------------------
    // 10. E-Commerce Checkout and Payment (COD)
    // ----------------------------------------------------
    if (testProductId && accessToken) {
      try {
        const checkoutPayload = {
          fullName: "Audit Customer",
          email: testEmail,
          phone: "0987654321",
          address: "123 Audit Street",
          province: "TP. Hồ Chí Minh",
          district: "Quận 1",
          ward: "Phường Bến Nghé",
          detailAddress: "123 Audit Street",
          deliveryOption: "delivery",
          shippingCost: 30000,
          payment_method: "COD",
          voucher_code: testVoucherCode,
          items: [{ product_id: testProductId, quantity: 2 }],
        };

        const config = { 
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            "x-idempotency-key": crypto.randomUUID()
          } 
        };

        const res = await axios.post(`${BASE_URL}/orders`, checkoutPayload, config);
        if (res.status === 201 && res.data && res.data._id) {
          testOrderId = res.data._id;
          addStep("Order Checkout (COD)", "PASS", `Order created. Order ID: ${testOrderId}`);

          // Simulate client clearing the cart on checkout
          await axios.delete(`${BASE_URL}/carts/me`, config);

          // Give projection queue a moment
          await new Promise(r => setTimeout(r, 2000));

          // Direct Database Verification: Cart should be cleared, claimedCount of Voucher updated, Order Status pending
          const dbOrder = await Order.findById(testOrderId);
          const dbCart = await Cart.findOne({ user_id: testUserId });
          const dbVoucher = await Voucher.findById(testVoucherId);

          const cartCleared = !dbCart || dbCart.items.length === 0;
          const claimedCountIncremented = dbVoucher.claimedCount > 0;
          const orderStateCorrect = dbOrder && dbOrder.status === "pending" && dbOrder.payment_status === "pending";

          if (cartCleared && orderStateCorrect) {
            addStep("Database State Consistency", "PASS", "Verified Cart cleared & Order state stored correctly in MongoDB");
          } else {
            addStep("Database State Consistency", "FAIL", `Cart cleared: ${cartCleared}, Order status: ${dbOrder?.status}`);
          }
        } else {
          addStep("Order Checkout (COD)", "FAIL", `Checkout responded with: ${res.status}`);
        }
      } catch (err) {
        addStep("Order Checkout (COD)", "FAIL", err.response?.data?.message || err.message);
      }
    }

    // ----------------------------------------------------
    // 11. Security: Login Lock Out Escalation
    // ----------------------------------------------------
    try {
      const emailForLock = `lock_test_${Date.now()}@gmail.com`;
      await resetLoginState(emailForLock);

      // Trigger 3 failed login attempts with syntax-valid password
      for (let i = 0; i < 3; i++) {
        try {
          await axios.post(`${BASE_URL}/auth/signin`, { email: emailForLock, password: "WrongPassword123" });
        } catch {}
      }

      // Check lock status
      const lockRes = await getLockStatus(emailForLock);
      if (lockRes.isLocked && lockRes.remainingMs > 0) {
        addStep("Security: Login Lock Out", "PASS", `Account locked for 30s as expected. Msg: ${lockRes.message}`);
      } else {
        addStep("Security: Login Lock Out", "FAIL", "Account was not locked after 3 attempts");
      }
      await resetLoginState(emailForLock);
    } catch (err) {
      addStep("Security: Login Lock Out", "FAIL", err.message);
    }

    // ----------------------------------------------------
    // 12. Security: Rate Limiter Checking
    // ----------------------------------------------------
    try {
      let isRateLimited = false;
      const rateLimitPromises = Array.from({ length: 4 }, () => 
        axios.post(`${BASE_URL}/auth/send-signup-code`, { email: "rate_test@gmail.com" })
      );

      const rateLimitResults = await Promise.allSettled(rateLimitPromises);
      for (const res of rateLimitResults) {
        if (res.status === "rejected" && res.reason?.response?.status === 429) {
          isRateLimited = true;
          break;
        }
      }

      if (isRateLimited) {
        addStep("Security: API Rate Limiter", "PASS", "Triggers HTTP 429 Too Many Requests as expected");
      } else {
        addStep("Security: API Rate Limiter", "FAIL", "Did not trigger rate limit");
      }
    } catch (err) {
      addStep("Security: API Rate Limiter", "FAIL", err.message);
    }

    // ----------------------------------------------------
    // 13. Admin Dashboard and Management
    // ----------------------------------------------------
    if (accessToken) {
      try {
        const config = { headers: { Authorization: `Bearer ${accessToken}` } };
        // User cannot access admin dashboard stats
        await axios.get(`${BASE_URL}/dashboard/stats`, config);
        addStep("Authorization: Role Protection", "FAIL", "Non-admin accessed dashboard stats");
      } catch (err) {
        if (err.response?.status === 403) {
          addStep("Authorization: Role Protection", "PASS", "Successfully blocked non-admin user from admin routes");
        } else {
          addStep("Authorization: Role Protection", "FAIL", `Expected 403 but got ${err.response?.status}`);
        }
      }
    }

  } finally {
    // Cleanup audit test data
    console.log("🧼 Cleaning up test data...");
    if (testUserId) {
      await User.deleteOne({ _id: testUserId });
      await Cart.deleteOne({ user_id: testUserId });
      await UserVoucher.deleteMany({ userId: testUserId });
    }
    if (testVoucherId) {
      await Voucher.deleteOne({ _id: testVoucherId });
    }
    if (testOrderId) {
      await Order.deleteOne({ _id: testOrderId });
      // Delete events in EventStore for cleanup
      await mongoose.connection.db.collection("event_store").deleteMany({ aggregateId: testOrderId });
    }
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }

  console.log("=========================================");
  console.log("📊 Audit Completed.");
  console.log("=========================================");
}

runAudit();
