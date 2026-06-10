import { jest } from "@jest/globals";
import { otpRateLimiterMiddleware } from "../middleware/rateLimit/otpRateLimiter.js";
import redisClient from "../configs/redisClient.js";

describe("OTP Rate Limiter Middleware", () => {
  const email = "test_otp_new_limiter@gmail.com";
  const ip = "127.0.0.1";

  beforeEach(async () => {
    // Clean keys prefix in Redis
    const emailKey = `otp_email:${email}`;
    const ipKey = `otp_ip:${ip}`;
    await redisClient.del([emailKey, ipKey]);
  });

  afterAll(async () => {
    const emailKey = `otp_email:${email}`;
    const ipKey = `otp_ip:${ip}`;
    await redisClient.del([emailKey, ipKey]);
  });

  test("Allows up to 3 OTP requests by email and blocks on the 4th", async () => {
    const req = {
      body: { email },
      ip
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    // Call 3 times: should call next() each time
    for (let i = 0; i < 3; i++) {
      next.mockClear();
      await otpRateLimiterMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    }

    // 4th time: should return 429 status
    res.status.mockClear();
    res.json.mockClear();
    next.mockClear();

    await otpRateLimiterMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("yêu cầu gửi mã OTP quá nhiều lần")
      })
    );
  });
});
