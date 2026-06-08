import { jest } from "@jest/globals";
import { paymentLimiter, paymentLimiterMiddleware } from "../middleware/rateLimit/paymentLimiter.js";
import { orderLimiter, orderLimiterMiddleware } from "../middleware/rateLimit/orderLimiter.js";
import redisClient from "../configs/redisClient.js";

describe("Payment and Order Rate Limiters", () => {
  const userId = "507f1f77bcf86cd799439011";
  const userIp = "127.0.0.1";

  beforeEach(async () => {
    // Clean up Redis keys before each test
    await redisClient.del(`payment_create:${userId}`);
    await redisClient.del(`payment_create:${userIp}`);
    await redisClient.del(`order_create:${userId}`);
    await redisClient.del(`order_create:${userIp}`);
  });

  afterAll(async () => {
    // Clean up Redis keys after all tests
    await redisClient.del(`payment_create:${userId}`);
    await redisClient.del(`payment_create:${userIp}`);
    await redisClient.del(`order_create:${userId}`);
    await redisClient.del(`order_create:${userIp}`);
  });

  describe("paymentLimiterMiddleware", () => {
    test("allows up to 5 requests, blocks the 6th based on user ID", async () => {
      const req = {
        user: { _id: userId },
        ip: userIp
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Call 5 times: should pass to next()
      for (let i = 0; i < 5; i++) {
        next.mockClear();
        await paymentLimiterMiddleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
      }

      // 6th call should block with 429 status
      res.status.mockClear();
      res.json.mockClear();
      next.mockClear();

      await paymentLimiterMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("yêu cầu thanh toán quá nhiều lần")
        })
      );
    });

    test("falls back to IP address if user ID is not present", async () => {
      const req = {
        ip: userIp
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Consumes 5 times on IP
      for (let i = 0; i < 5; i++) {
        next.mockClear();
        await paymentLimiterMiddleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      }

      // 6th call should block on IP
      res.status.mockClear();
      res.json.mockClear();
      next.mockClear();

      await paymentLimiterMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe("orderLimiterMiddleware", () => {
    test("allows up to 5 requests, blocks the 6th based on user ID", async () => {
      const req = {
        user: { _id: userId },
        ip: userIp
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Call 5 times: should pass to next()
      for (let i = 0; i < 5; i++) {
        next.mockClear();
        await orderLimiterMiddleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
      }

      // 6th call should block with 429 status
      res.status.mockClear();
      res.json.mockClear();
      next.mockClear();

      await orderLimiterMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("tạo quá nhiều đơn hàng")
        })
      );
    });
  });
});
