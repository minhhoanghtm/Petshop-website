# TÀI LIỆU HƯỚNG DẪN BẢO MẬT & VẬN HÀNH HỆ THỐNG XÁC THỰC (AUTHENTICATION HARDENING)

Tài liệu này cung cấp chi tiết về kiến trúc phòng thủ bảo mật của backend Pet Station sau khi triển khai hardening toàn diện.

---

## 1. Kiến Trúc Xác Thực (Authentication Architecture)
Hệ thống sử dụng mô hình kết hợp:
*   **Stateful Session**: Express Session lưu trên Redis để quản lý trạng thái đăng nhập chung của người dùng.
*   **Stateless JWT (Rotation)**: Access Token ngắn hạn (30 phút) kết hợp với Refresh Token dài hạn (14 ngày). Hệ thống áp dụng **Refresh Token Rotation (RTR)** kèm theo cơ chế tự vệ chống **Replay Attack**.

---

## 2. Các Lớp Phòng Thủ Bảo Mật & Rate Limiting

### A. IP Rate Limiting (signinIpLimiter)
*   **Endpoint bảo vệ**: `POST /api/auth/signin`
*   **Chính sách**: Giới hạn tối đa **100 requests / 15 phút / IP**.
*   **Cấu hình Nginx/Cloudflare**: Hệ thống đã được cấu hình `app.set("trust proxy", 1)`, do đó Express sẽ tự động phân tích IP thực tế từ header `X-Forwarded-For` để làm khóa chặn, tránh khóa nhầm IP của proxy.

### B. OTP Rate Limiting (otpRateLimiter)
*   **Endpoint bảo vệ**:
    *   `POST /api/auth/send-signup-code`
    *   `POST /api/auth/request-password-reset`
    *   `POST /api/auth/resend-password-reset-otp`
*   **Chính sách**:
    *   **3 OTP / 15 phút / email** (Chặn spam bom mail tới 1 tài khoản).
    *   **20 OTP / giờ / IP** (Chặn botnet spam mail quy mô lớn từ 1 dải IP).

### C. Khóa Tài Khoản Bậc Thang (redisLoginLock)
Hệ thống đếm số lần sai theo Email trên Redis (`security:login:attempts:<email>`) và tự động khóa bậc thang (`security:login:lock:<email>`):
*   Sai **3 lần**: Khóa tài khoản tạm thời **30 giây**.
*   Sai **5 lần**: Khóa tài khoản tạm thời **3 phút**.
*   Sai **10 lần**: Khóa tài khoản **24 giờ** + Gửi email cảnh báo bảo mật.
*   *Lưu ý*: Mọi hành động đếm và khóa tài khoản đều được quản lý tập trung trên Redis làm **Single Source of Truth**, loại bỏ hoàn toàn tình trạng đếm sai lệch hay khóa không đồng bộ.

---

## 3. Cơ Chế Phòng Thủ Nâng Cao (Advanced Protections)

### A. Chống OTP Race Condition (Redis Mutex Lock)
*   Để tránh hacker gửi song song nhiều request xác thực mã OTP đăng ký hoặc đặt lại mật khẩu cùng lúc nhằm bypass bộ đếm lỗi:
    *   Hệ thống tự động thiết lập một khóa verify tạm thời bằng lệnh `SET lock:otp_verify:<purpose>:<email> 1 NX EX 3`.
    *   Nếu có bất kỳ request xác thực song song nào khác của cùng email, nó sẽ bị từ chối ngay lập tức (`400 Bad Request`).
    *   Hàm so khớp bcrypt (CPU-heavy) chạy an toàn trong Node.js thread và giải phóng khóa trong block `finally` (bằng lệnh `DEL`).

### B. OTP Hardening (TTL & Failed Attempts)
*   Mã OTP đăng ký và quên mật khẩu sống tối đa **5 phút** (`EX: 300`).
*   Nếu người dùng nhập sai OTP quá **5 lần**, toàn bộ trạng thái OTP của tài khoản đó trên Redis sẽ bị **hủy bỏ và xóa sạch ngay lập tức**, bắt buộc người dùng phải yêu cầu gửi mã mới.

### C. Chống Timing Attack (Dummy Verification)
*   Khi kẻ tấn công dò quét email (User Enumeration), nếu email không tồn tại, thông thường hệ thống sẽ trả lỗi ngay lập tức (~2ms) trong khi email đúng sẽ tốn ~100ms chạy bcrypt.
*   *Giải pháp*: Nếu email không tồn tại trong DB, hệ thống sẽ thực hiện hàm `verifyPassword` với một **Dummy Hash** (có cấu trúc băm PBKDF2 y hệt hash thật), đảm bảo thời gian xử lý đồng đều ~100ms cho mọi request đăng nhập sai/không tồn tại.

### D. Phát Hiện Thiết Bị Lạ (New Device Detection)
*   Hệ thống băm MD5 chuỗi kết hợp `userAgent:ip` để tạo vân tay thiết bị (Fingerprint).
*   Khi đăng nhập thành công, hệ thống đối chiếu vân tay này với tập hợp vân tay đã biết của user trên Redis (`security:user_devices:${userId}`).
*   Nếu đây là thiết bị mới, hệ thống sẽ ghi log `NEW_DEVICE_LOGIN` và gửi email cảnh báo bảo mật tới người dùng.

---

## 4. Nhật Ký Bảo Mật (Security Audit Log)

Mọi sự kiện bảo mật được ghi nhận vào collection `security_audit_logs` có **TTL 90 ngày** phục vụ điều tra sự cố:
*   `LOGIN_SUCCESS`: Đăng nhập thành công.
*   `LOGIN_FAILED`: Đăng nhập thất bại (kèm theo số lần sai hiện tại).
*   `ACCOUNT_LOCKED`: Tài khoản bị khóa tạm thời (kèm thời gian khóa).
*   `PASSWORD_CHANGED`: Thay đổi mật khẩu từ trang cá nhân.
*   `PASSWORD_RESET`: Khôi phục mật khẩu thành công qua mã OTP.
*   `OTP_SUCCESS` / `OTP_FAILED`: Xác thực mã OTP thành công / thất bại.
*   `REFRESH_TOKEN_REPLAY`: Giải mã signature token hợp lệ nhưng không nằm trong danh sách hoạt động trên Redis (Nghi ngờ replay attack).
*   `TOKEN_REUSE_DETECTED`: Tái sử dụng Refresh Token cũ trong thời gian ân hạn (Grace Period 10s do lag mạng).
*   `NEW_DEVICE_LOGIN`: Đăng nhập thành công từ trình duyệt/IP mới.

---

## 5. API Giám Sát Bảo Mật (Monitoring & Health Checks)

Endpoints bảo vệ dành cho Admin (yêu cầu quyền Admin qua `protectedRoute` và `requireAdmin`):

### A. Hệ Thống Health Check (`GET /api/admin/security/health`)
Kiểm tra trạng thái kết nối thời gian thực:
*   **Redis**: Ping đo đạc độ trễ (`latencyMs`).
*   **BullMQ**: Lấy số lượng job hiện tại trong hàng đợi `otpQueue` (`active`, `waiting`, `failed`, v.v.).
*   **SMTP**: Gọi hàm verify kết nối thực tế tới mail server.

### B. Hệ Thống Metrics Dashboard (`GET /api/admin/security/metrics`)
Cung cấp dữ liệu thống kê phục vụ vẽ đồ thị giám sát:
*   Tổng số sự kiện bảo mật phân loại theo event type trong **24 giờ qua** (truy vấn tổng hợp qua MongoDB Aggregate).
*   Thông số hoạt động của Redis (Memory used, client connections, uptime, ops/sec).
*   Trạng thái hàng đợi BullMQ.

---

## 6. Hướng Dẫn Vận Hành & Khuyến Nghị Production

1.  **Kích hoạt Redis Persistence**: Chắc chắn rằng file `redis.conf` trên server production đã bật cơ chế Hybrid **AOF + RDB** để tránh mất dữ liệu hàng đợi và trạng thái khóa khi server bị khởi động lại đột ngột.
2.  **Cấu hình SMTP**: Điền đầy đủ thông tin SMTP thật ở file `.env` môi trường production để thay thế cho cơ chế mock log ở dev.
3.  **WAF Edge Protection**: Cấu hình Cloudflare hoặc Nginx ở phía trước để giới hạn băng thông, chống DoS/DDoS và cài đặt Turnstile CAPTCHA tầng ngoài nếu cần thiết.
