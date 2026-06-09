import redisClient from "../configs/redisClient.js";
import { logger } from "../logger/logger.js";

// Regex validate định dạng UUID v4 (tiêu chuẩn khuyến nghị)
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const idempotencyMiddleware = async (req, res, next) => {
  // 1. Chỉ áp dụng cho các phương thức thay đổi trạng thái dữ liệu (POST, PUT, PATCH)
  if (!["POST", "PUT", "PATCH"].includes(req.method)) {
    return next();
  }

  const key = req.headers["x-idempotency-key"];

  // Kiểm tra sự tồn tại của key
  if (!key) {
    return res.status(400).json({
      message: "Thiếu header 'x-idempotency-key'. Yêu cầu này cần được bảo vệ chống trùng lặp.",
    });
  }

  // Validate định dạng UUID v4 để tránh việc gửi key rác làm tràn bộ nhớ Redis
  if (!UUID_V4_REGEX.test(key)) {
    return res.status(400).json({
      message: "Định dạng 'x-idempotency-key' không hợp lệ. Phải là UUID v4 chuẩn.",
    });
  }

  const redisKey = `idempotency:${key}`;
  const lockTtlMs = 300000; // 5 phút (đủ thời gian cho các request đặt hàng/thanh toán hoàn tất)

  try {
    // 2. Sử dụng lệnh SET nguyên tử với NX (Only set if not exist) và PX (Set expire time in milliseconds)
    // Chặn hoàn toàn Race Condition giữa các request trùng mili giây gửi lên
    const setRes = await redisClient.set(redisKey, "processing", {
      NX: true,
      PX: lockTtlMs,
    });

    // Nếu setRes === null, nghĩa là key đã tồn tại trên Redis (trùng lặp)
    if (setRes === null) {
      const redisValue = await redisClient.get(redisKey);

      // TH1: Request trước đó vẫn ĐANG XỬ LÝ
      if (redisValue === "processing") {
        logger.warn(`Phát hiện request trùng lặp đang được xử lý: ${key}`);
        return res.status(409).json({
          message: "Yêu cầu của bạn đang được xử lý. Vui lòng không gửi trùng lặp.",
        });
      }

      // TH2: Request trước đó ĐÃ HOÀN TẤT
      if (redisValue && redisValue.startsWith("completed:")) {
        logger.info(`Phát hiện request trùng lặp đã hoàn tất. Trả về kết quả cũ: ${key}`);
        const jsonStr = redisValue.slice("completed:".length);
        const { status, body } = JSON.parse(jsonStr);
        return res.status(status).json(body);
      }

      // Fallback nếu dữ liệu Redis bị lỗi định dạng
      return res.status(409).json({
        message: "Yêu cầu trùng lặp đang được xử lý hoặc đã kết thúc.",
      });
    }

    // 3. SET thành công (Đây là request đầu tiên) -> Tiến hành ghi đè res.json để intercept kết quả
    const originalJson = res.json;

    res.json = function (body) {
      // Khôi phục lại hàm res.json gốc để tránh lặp vô hạn
      res.json = originalJson;

      const status = res.statusCode || 200;
      const cacheData = { status, body };

      // Chỉ cache kết quả nếu không phải lỗi hệ thống nghiêm trọng (5xx)
      if (status < 500) {
        redisClient
          .set(redisKey, `completed:${JSON.stringify(cacheData)}`, {
            PX: lockTtlMs, // Giữ nguyên TTL 5 phút từ lúc tạo khóa
          })
          .catch((err) => {
            logger.error("Lỗi khi lưu kết quả Idempotency vào Redis:", {
              message: err.message,
              key,
            });
          });
      } else {
        // Nếu server gặp lỗi 5xx, giải phóng key lập tức để khách hàng có thể thử lại
        redisClient.del(redisKey).catch((err) => {
          logger.error("Lỗi khi giải phóng Idempotency key bị lỗi 5xx:", {
            message: err.message,
            key,
          });
        });
      }

      // Trả kết quả thật về cho client
      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    // 4. Cơ chế Fail-open: Nếu Redis sập, log lỗi và cho phép request chạy tiếp bằng DB
    // Đảm bảo không làm nghẽn luồng mua hàng của khách khi có sự cố hạ tầng
    logger.error("Lỗi kết nối Redis trong Idempotency Middleware. Kích hoạt Fail-open:", {
      message: error.message,
      key,
    });
    next();
  }
};
