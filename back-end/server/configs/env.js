import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// Đảm bảo nạp biến môi trường từ file .env trước khi thực hiện validate
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

// Nếu đang chạy ở môi trường test (như Jest), tự động đổi tên database sang db-test để tránh xoá dữ liệu của dev/prod
if (process.env.NODE_ENV === "test" && process.env.MONGO_URI) {
  const mongoUri = process.env.MONGO_URI;
  const schemeIndex = mongoUri.indexOf("://");
  if (schemeIndex !== -1) {
    const scheme = mongoUri.substring(0, schemeIndex + 3);
    const rest = mongoUri.substring(schemeIndex + 3);
    const slashIndex = rest.indexOf("/");
    if (slashIndex !== -1) {
      const host = rest.substring(0, slashIndex);
      const pathAndQuery = rest.substring(slashIndex);
      const questionMarkIndex = pathAndQuery.indexOf("?");
      if (questionMarkIndex !== -1) {
        const dbName = pathAndQuery.substring(0, questionMarkIndex);
        const query = pathAndQuery.substring(questionMarkIndex);
        process.env.MONGO_URI = `${scheme}${host}${dbName}-test${query}`;
      } else {
        process.env.MONGO_URI = `${scheme}${host}${pathAndQuery}-test`;
      }
    } else {
      process.env.MONGO_URI = `${mongoUri}-test`;
    }
  } else {
    process.env.MONGO_URI = `${mongoUri}-test`;
  }
}

// Định nghĩa schema nghiêm ngặt cho các biến môi trường cốt lõi
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(5000),
  MONGO_URI: z.string({
    required_error: "MONGO_URI là bắt buộc để kết nối cơ sở dữ liệu MongoDB",
  }).min(1, "MONGO_URI không được để trống"),
  REDIS_URL: z.string({
    required_error: "REDIS_URL là bắt buộc để kết nối cache Redis",
  }).min(1, "REDIS_URL không được để trống"),
  ACCESS_TOKEN_SECRET: z.string({
    required_error: "ACCESS_TOKEN_SECRET là bắt buộc để mã hóa Access Token",
  }).min(10, "ACCESS_TOKEN_SECRET phải có độ dài tối thiểu là 10 ký tự để đảm bảo an toàn bảo mật"),
  JWT_SECRET: z.string().optional(),
});

let validatedEnv = {};

try {
  // Thực hiện validate biến môi trường thực tế từ process.env
  validatedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ LỖI KHỞI ĐỘNG: Cấu hình biến môi trường (.env) không hợp lệ!");
    console.error("----------------------------------------------------------------");
    
    const issues = error.issues || error.errors || [];
    issues.forEach((err) => {
      console.error(`👉 Trường [${err.path.join(".")}]: ${err.message}`);
    });
    
    console.error("----------------------------------------------------------------");
    console.error("Vui lòng kiểm tra lại file .env trước khi chạy ứng dụng.");
    
    // Ép ứng dụng dừng ngay lập tức để tránh chạy ở trạng thái lỗi
    process.exit(1);
  } else {
    console.error("Lỗi không xác định khi validate biến môi trường:", error);
    process.exit(1);
  }
}

export const env = validatedEnv;
export default env;

