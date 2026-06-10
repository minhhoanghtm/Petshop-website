import { recordFailedLogin, resetLoginState, getAttemptCount, getLockStatus } from "../utils/redisLoginLock.js";
import redisClient from "../configs/redisClient.js";

describe("Redis Login Lock Escalation", () => {
  const email = "test_lock_escalation@gmail.com";

  beforeEach(async () => {
    await resetLoginState(email);
  });

  afterAll(async () => {
    await resetLoginState(email);
  });

  test("3 failed attempts: locks for 30s", async () => {
    let result;
    
    // Attempt 1
    result = await recordFailedLogin(email);
    expect(result.attempts).toBe(1);
    expect(result.isLocked).toBe(false);
    expect(result.remainingAttempts).toBe(2);

    // Attempt 2
    result = await recordFailedLogin(email);
    expect(result.attempts).toBe(2);
    expect(result.isLocked).toBe(false);
    expect(result.remainingAttempts).toBe(1);

    // Attempt 3
    result = await recordFailedLogin(email);
    expect(result.attempts).toBe(3);
    expect(result.isLocked).toBe(true);
    expect(result.remainingAttempts).toBe(2); // to next tier (5 attempts)
    expect(result.remainingMs).toBeLessThanOrEqual(30 * 1000);
    expect(result.message).toContain("30 giây");
  });

  test("5 failed attempts: locks for 3 minutes", async () => {
    await recordFailedLogin(email); // 1
    await recordFailedLogin(email); // 2
    await recordFailedLogin(email); // 3 (locked 30s)
    
    // Xóa khóa giả lập hết thời gian khóa 30 giây để test tiếp lần 4
    await redisClient.del(`security:login:lock:${email}`);
    
    let result = await recordFailedLogin(email); // 4
    expect(result.attempts).toBe(4);
    expect(result.isLocked).toBe(false);
    
    result = await recordFailedLogin(email); // 5 (locked 3m)
    expect(result.attempts).toBe(5);
    expect(result.isLocked).toBe(true);
    expect(result.remainingMs).toBeLessThanOrEqual(3 * 60 * 1000);
    expect(result.message).toContain("3 phút");
  });

  test("10 failed attempts: locks for 24 hours and resets attempts", async () => {
    // Tăng tốc đếm lỗi bằng cách đẩy thẳng 9 lần lỗi lên Redis
    await redisClient.set(`security:login:attempts:${email}`, "9");
    
    let result = await recordFailedLogin(email); // Lần thứ 10
    expect(result.attempts).toBe(10);
    expect(result.isLocked).toBe(true);
    expect(result.remainingMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(result.message).toContain("24 giờ");
    
    // Đảm bảo số lần đếm lỗi được xóa hoàn toàn về 0 ở Redis sau lần 10
    const finalAttempts = await getAttemptCount(email);
    expect(finalAttempts).toBe(0);
  });

  test("Should not increment attempts when already locked", async () => {
    // Sai 3 lần để bị khóa 30 giây
    await recordFailedLogin(email); // 1
    await recordFailedLogin(email); // 2
    const lockResult = await recordFailedLogin(email); // 3 (bị khóa)
    expect(lockResult.attempts).toBe(3);
    expect(lockResult.isLocked).toBe(true);

    // Thử gọi recordFailedLogin lần nữa khi đang bị khóa
    const attemptWhileLocked = await recordFailedLogin(email);
    expect(attemptWhileLocked.isLocked).toBe(true);
    expect(attemptWhileLocked.attempts).toBe(3); // Vẫn là 3, không tăng lên 4

    // Đảm bảo giá trị trong Redis vẫn giữ nguyên là 3
    const finalAttempts = await getAttemptCount(email);
    expect(finalAttempts).toBe(3);
  });

  test("Concurrent logins for the same email: atomic increment", async () => {
    // Send 50 failed logins concurrently
    const promises = Array.from({ length: 50 }, () => recordFailedLogin(email));
    const results = await Promise.all(promises);

    // Get the maximum attempts returned
    const attempts = results.map(r => r.attempts);
    expect(attempts).toContain(1);
    expect(attempts).toContain(2);
    expect(attempts).toContain(3);
    
    // Check final status
    const status = await getLockStatus(email);
    expect(status.isLocked).toBe(true);
    
    // Max attempts must be cleared since attempts >= 10 resets attempts key
    const finalAttempts = await getAttemptCount(email);
    expect(finalAttempts).toBe(0);
  });
});

