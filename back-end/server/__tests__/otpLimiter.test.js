import { jest } from "@jest/globals";
import { otpSendLimiter, otpSendLimiterMiddleware } from "../middleware/rateLimit/otpLimiter.js";
import redisClient from "../configs/redisClient.js";

describe("OTP Send Rate Limiter", () => {
  const email = "test_otp_limiter@gmail.com";
  const key = `otp_send:${email}`;

  beforeEach(async () => {
    await redisClient.del(key);
  });

  afterAll(async () => {
    await redisClient.del(key);
  });

  test("Allows up to 5 OTP requests and blocks on the 6th", async () => {
    // Consume 5 times
    for (let i = 0; i < 5; i++) {
      const res = await otpSendLimiter.consume(email);
      expect(res.remainingPoints).toBe(4 - i);
    }

    // 6th time should throw/reject as rate limit exceeded
    await expect(otpSendLimiter.consume(email)).rejects.toHaveProperty("remainingPoints", 0);
  });

  test("otpSendLimiterMiddleware rate limits requests correctly", async () => {
    const req = {
      body: { email }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    // Reset rate limiter points
    await redisClient.del(key);

    // Call 5 times: should call next() each time
    for (let i = 0; i < 5; i++) {
      next.mockClear();
      await otpSendLimiterMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    }

    // 6th time: should return 429 status and message
    res.status.mockClear();
    res.json.mockClear();
    next.mockClear();

    await otpSendLimiterMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("yêu cầu gửi mã OTP quá nhiều lần")
      })
    );
  });
});
