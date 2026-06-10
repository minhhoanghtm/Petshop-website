import { jest } from "@jest/globals";
import mongoose from "mongoose";
import "../configs/env.js";
import { getSystemHealth, getSecurityMetrics } from "../services/securityMonitoringService.js";
import { refreshAccessToken, signIn } from "../services/authService.js";
import redisClient from "../configs/redisClient.js";
import User from "../models/User.js";
import SecurityLog from "../models/SecurityLog.js";
import jwt from "jsonwebtoken";
import { hashPassword } from "../utils/passwordUtils.js";

describe("Security Monitoring & Hardening Tests", () => {
  let testUser;
  let testToken;

  beforeAll(async () => {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Ensure clean environment
    await SecurityLog.deleteMany({});
    
    // Create a mock user for testing
    testUser = await User.findOne({ email: "monitor_test@gmail.com" });
    if (!testUser) {
      testUser = await User.create({
        email: "monitor_test@gmail.com",
        password: hashPassword("monitor_test_pass"),
        fullName: "Test Monitor",
        birthDate: new Date(),
        gender: "male",
        status: "Active",
      });
    }

    testToken = jwt.sign(
      { userId: testUser._id.toString() },
      process.env.ACCESS_TOKEN_SECRET || "test_secret"
    );
  });

  afterAll(async () => {
    if (testUser && testUser._id) {
      await User.deleteOne({ _id: testUser._id });
    }
    await SecurityLog.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  test("getSystemHealth should return system status components", async () => {
    const health = await getSystemHealth();
    expect(health).toHaveProperty("status");
    expect(health).toHaveProperty("redis");
    expect(health).toHaveProperty("bullmq");
    expect(health).toHaveProperty("smtp");
    expect(health.redis.status).toBe("healthy");
  });

  test("getSecurityMetrics should aggregate security log counts", async () => {
    // Generate some mock logs
    await SecurityLog.create({
      event: "LOGIN_SUCCESS",
      email: "monitor_test@gmail.com",
      ip: "127.0.0.1",
      createdAt: new Date(),
    });

    await SecurityLog.create({
      event: "NEW_DEVICE_LOGIN",
      email: "monitor_test@gmail.com",
      ip: "127.0.0.1",
      createdAt: new Date(),
    });

    const metrics = await getSecurityMetrics();
    expect(metrics).toHaveProperty("securityEvents");
    expect(metrics.securityEvents.LOGIN_SUCCESS).toBeGreaterThanOrEqual(1);
    expect(metrics.securityEvents.NEW_DEVICE_LOGIN).toBeGreaterThanOrEqual(1);
    expect(metrics.redis).toBeDefined();
    expect(metrics.queue).toBeDefined();
  });

  test("Refresh Token Replay Attack should log REFRESH_TOKEN_REPLAY event", async () => {
    // Simulate a replay attack where token does NOT exist on Redis
    const badToken = jwt.sign(
      { userId: testUser._id.toString() },
      process.env.ACCESS_TOKEN_SECRET || "test_secret"
    );

    // Call service expecting error
    await expect(refreshAccessToken(badToken, { ip: "127.0.0.1", headers: {} })).rejects.toThrow();

    // Verify REFRESH_TOKEN_REPLAY log was written
    const logs = await SecurityLog.find({ event: "REFRESH_TOKEN_REPLAY" });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].userId.toString()).toBe(testUser._id.toString());
  });

  test("Refresh Token Reuse within grace period should log TOKEN_REUSE_DETECTED", async () => {
    const reuseToken = jwt.sign(
      { userId: testUser._id.toString() },
      process.env.ACCESS_TOKEN_SECRET || "test_secret"
    );

    const tokenKey = `refresh:${reuseToken}`;
    // Set token with "used:" prefix to mock grace period
    const newPair = { accessToken: "new_access", refreshToken: "new_refresh" };
    await redisClient.set(tokenKey, `used:${JSON.stringify(newPair)}`, { EX: 10 });

    const result = await refreshAccessToken(reuseToken, { ip: "127.0.0.1", headers: {} });
    expect(result.accessToken).toBe("new_access");

    // Verify TOKEN_REUSE_DETECTED log was written
    const logs = await SecurityLog.find({ event: "TOKEN_REUSE_DETECTED" });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    
    // Clean up
    await redisClient.del(tokenKey);
  });

  test("NEW_DEVICE_LOGIN should be logged when signin happens on a new device", async () => {
    const email = "new_device_test@gmail.com";
    const password = "password123";
    const hashedPassword = hashPassword(password);

    let testUser2 = await User.findOne({ email });
    if (testUser2) {
      await User.deleteOne({ email });
    }
    testUser2 = await User.create({
      email,
      password: hashedPassword,
      fullName: "New Device Test",
      birthDate: new Date(),
      gender: "female",
      status: "Active",
    });

    const userDevicesKey = `security:user_devices:${testUser2._id}`;
    await redisClient.del(userDevicesKey);

    // Sign in from Device 1 (UA 1, IP 1) -> Fingerprint added, but hasDevices = 0, so no alert
    const req1 = {
      ip: "192.168.1.10",
      headers: { "user-agent": "Mozilla/5.0 Chrome/120.0" }
    };
    await signIn({ email, password }, req1);

    const logsAfterFirst = await SecurityLog.find({ event: "NEW_DEVICE_LOGIN", userId: testUser2._id });
    expect(logsAfterFirst.length).toBe(0);

    // Sign in from Device 2 (UA 2, IP 2) -> hasDevices = 1, isKnownDevice = false -> logs security event
    const req2 = {
      ip: "192.168.1.20",
      headers: { "user-agent": "Mozilla/5.0 Safari/605.1" }
    };
    await signIn({ email, password }, req2);

    const logsAfterSecond = await SecurityLog.find({ event: "NEW_DEVICE_LOGIN", userId: testUser2._id });
    expect(logsAfterSecond.length).toBe(1);
    expect(logsAfterSecond[0].ip).toBe("192.168.1.20");

    // Clean up
    await User.deleteOne({ _id: testUser2._id });
    await redisClient.del(userDevicesKey);
  });
});
