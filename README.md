# Dự án Website Cửa hàng Thú cưng - PetShop

Chào mừng bạn đến với dự án **PetShop Website** - hệ thống thương mại điện tử chuyên cung cấp thức ăn, phụ kiện và dịch vụ chăm sóc thú cưng. Đây là dự án thực hành thuộc môn học **Kiến trúc và Thiết kế Phần mềm**. Dự án được phát triển theo mô hình Client-Server hiện đại, đáp ứng tốt về trải nghiệm người dùng, hiệu năng cao và bảo mật hệ thống.

---

## 👥 Đội Ngũ Phát Triển (Development Team)

Dự án được xây dựng và duy trì qua các giai đoạn phát triển với sự đóng góp cụ thể từ các thành viên:

### 1. Giai đoạn xây dựng khung sườn (Giai đoạn cơ bản)
Trong học kỳ học tập môn học **Kiến trúc và Thiết kế Phần mềm**, các thành viên đảm nhận các vai trò chính sau:
* **Trịnh Hoàng Kỳ**: Phụ trách nghiên cứu, viết báo cáo và xây dựng tài liệu dự án (Documentation & Reports).
* **Lê Hồng Nhung**: Phụ trách kiểm thử hệ thống, viết test case và bảo đảm chất lượng (QA/Testing).
* **Võ Ngọc Thuý Vy**: Đảm nhận thiết kế và triển khai các chức năng nghiệp vụ cơ bản (Core Features).
* **Huỳnh Minh Thư**: Chịu trách nhiệm thiết kế và phát triển giao diện người dùng (Frontend Development).
* **Nguyễn Minh Hoàng**: Phụ trách thiết kế cơ sở dữ liệu, xây dựng và nâng cấp hệ thống API (Backend Development).

### 2. Giai đoạn nâng cấp & Phát triển lâu dài (Sau môn học)
Sau khi kết thúc môn học, dự án tiếp tục được bảo trì và mở rộng tính năng bởi 2 thành viên chính:
* **Huỳnh Minh Thư**: Tiếp tục nghiên cứu, tối ưu trải nghiệm người dùng (UX/UI) và phát triển các tính năng nâng cao ở **Frontend (FE)**.
* **Nguyễn Minh Hoàng**: Tiếp tục tối ưu hóa hiệu năng, xử lý đồng thời, bảo mật hệ thống và nâng cấp API ở **Backend (BE)**.

---

## 🌟 Các Chức Năng Chính Của Dự Án (Key Features)

Hệ thống Website PetShop được thiết kế với đầy đủ các nghiệp vụ thương mại điện tử chuyên nghiệp phục vụ khách hàng và nhà quản trị:

### 1. Phân hệ Khách hàng (User Features)
* **Xác thực & Bảo mật tài khoản**: Đăng ký, đăng nhập bảo mật bằng cơ chế JWT kết hợp Session, tự động băm mật khẩu và khóa tài khoản tạm thời khi đăng nhập sai quá số lần quy định.
* **Khám phá sản phẩm**: Tìm kiếm sản phẩm thông minh, lọc theo danh mục, hiển thị thông tin sản phẩm và xem các đánh giá, phản hồi thực tế từ cộng đồng.
* **Giỏ hàng trực quan**: Thêm/xóa sản phẩm nhanh chóng, cập nhật số lượng trực tiếp và đồng bộ giỏ hàng theo thời gian thực.
* **Quản lý & Săn Voucher**:
  * **Kho Voucher (Voucher Center)**: Hiển thị các mã giảm giá hiện có, cho phép người dùng lưu (claim) voucher vào kho cá nhân.
  * **Điều kiện áp dụng cụ thể**: Mỗi voucher hỗ trợ xem chi tiết danh mục hoặc sản phẩm được áp dụng qua một modal thông tin tinh tế.
* **Đặt hàng & Thanh toán đa dạng**:
  * Đặt hàng ship COD (thanh toán khi nhận hàng).
  * Thanh toán trực tuyến tích hợp qua hai cổng điện tử lớn: **MoMo** và **VNPay** (sử dụng môi trường Sandbox thử nghiệm).
  * Áp dụng mã giảm giá và tính toán tự động số tiền được chiết khấu ngay tại trang Checkout.
* **Trang cá nhân (User Profile)**:
  * Quản lý thông tin cá nhân (Họ tên, Email, SĐT, Giới tính, Ngày sinh, Avatar).
  * Hiển thị huy hiệu **Hạng thành viên** (Đồng, Bạc, Vàng, VIP) cùng tổng số tiền tích lũy và thống kê đơn hàng.
  * Quản lý thông tin giao hàng và theo dõi lịch sử mua hàng, trạng thái đơn hàng (Chờ xác nhận, Đã xác nhận, Đang giao, Đã giao, Đã hủy).
  * Xuất và in hóa đơn mua hàng dưới dạng file **PDF** chuyên nghiệp.

### 2. Phân hệ Quản trị viên (Admin & Staff Features)
* **Bảng điều khiển (Dashboard)**: Thống kê tổng quan doanh thu, số đơn hàng mới, số lượng khách hàng hoạt động và hiển thị biểu đồ tăng trưởng doanh số trực quan.
* **Quản lý Sản phẩm & Danh mục**: Thêm mới, cập nhật thông tin hình ảnh, giá bán, số lượng tồn kho hoặc ẩn/hiện sản phẩm và danh mục sản phẩm.
* **Quản lý Đơn hàng**: Tiếp nhận đơn hàng, thay đổi trạng thái vận chuyển và xử lý các vấn đề liên quan đến đơn hàng.
* **Quản lý Voucher chuyên sâu**:
  * Tạo mới voucher với cấu hình linh hoạt (giảm theo % hoặc số tiền cố định, số lượng phát hành tối đa, thời gian hiệu lực).
  * Chỉ định đối tượng khách hàng áp dụng dựa theo **Hạng thành viên** (standard, silver, gold, vip) và các sản phẩm/danh mục áp dụng.
  * Xem lịch sử sử dụng voucher của từng tài khoản.
* **Quản lý Thành viên**: Xem danh sách người dùng và thực hiện khóa tài khoản vi phạm.

### 3. Tính năng kỹ thuật & Hiệu năng nâng cao (Security & Performance)
* **Redis Caching**: Tối ưu hóa hiệu năng tải trang, lưu trữ phiên đăng nhập (Session) an toàn.
* **Rate Limiting**: Ngăn chặn spam request và các hành vi tấn công DDoS hoặc brute force.
* **Security Logs & Audits**: Ghi nhật ký các hành động nhạy cảm của hệ thống để quản trị viên giám sát kịp thời.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### Frontend (Client-side)
* **Framework**: ReactJS (Vite)
* **Styling**: Tailwind CSS & Vanilla CSS (tối ưu hóa giao diện trực quan cao, responsive tốt)
* **State & Routing**: React Router DOM
* **API Client**: Axios
* **Tiện ích**: React Icons, React Toastify, PDF Invoice Generator...

### Backend (Server-side)
* **Runtime**: Node.js & Express.js
* **Database**: MongoDB (Mongoose ODM)
* **Caching & Session**: Redis (Được sử dụng cho quản lý session bảo mật, chống spam login, lưu log và Rate Limiting)
* **Testing**: Jest & Supertest (Kiểm thử API biệt lập)

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu cầu hệ thống (Prerequisites)
* Node.js phiên bản 18 trở lên.
* npm phiên bản 9 trở lên.
* MongoDB (đang chạy cục bộ hoặc trên MongoDB Atlas).
* Redis Server (khuyến nghị chạy qua Docker).

### 2. Cài đặt các gói phụ thuộc (Dependencies)
Mở hai cửa sổ terminal riêng biệt để cài đặt dependency cho từng phần:

**Cài đặt cho Backend:**
```bash
cd back-end
npm install
```

**Cài đặt cho Frontend:**
```bash
cd front-end
npm install
```

---

### 3. Cấu hình biến môi trường (Environment Variables)

#### Backend: Tạo file `back-end/.env`
Tạo một file `.env` tại thư mục `/back-end` và điền cấu hình tương tự như sau:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/petshop
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=your_secret_session_key
ACCESS_TOKEN_SECRET=your_jwt_access_secret_key
REFRESH_TOKEN_SECRET=your_jwt_refresh_secret_key
LOG_LEVEL=info
```
*(Nếu sử dụng MongoDB Atlas, hãy thay đổi đường dẫn kết nối `MONGO_URI` tương ứng)*

#### Frontend: Tạo file `front-end/.env`
Tạo một file `.env` tại thư mục `/front-end` để cấu hình API URL:
```env
VITE_API_BASE_URL=http://localhost:5000
```

---

### 4. Khởi chạy Redis bằng Docker
Dự án sử dụng Redis cho tính năng bảo mật session và giới hạn lượt yêu cầu. Bạn có thể khởi động nhanh bằng Docker:

* **Tạo mới container Redis:**
  ```bash
  docker run --name redis -p 6379:6379 -d redis:7-alpine
  ```
* **Khởi động container đã có sẵn:**
  ```bash
  docker start redis
  ```

---

### 5. Khởi chạy ứng dụng

#### Terminal 1: Khởi động Server (Backend)
```bash
cd back-end
npm start
```
*Backend sẽ lắng nghe tại cổng `http://localhost:5000`*

#### Terminal 2: Khởi động Client (Frontend)
```bash
cd front-end
npm run dev
```
*Frontend sẽ chạy tại `http://localhost:5173`*

---

## 🧪 Các Lệnh Kiểm Thử và Phát Triển (Useful Commands)

### Backend
* Chạy server ở chế độ Production: `npm start`
* Chạy bộ kiểm thử (Test suite): `npm test`
* Xem các lỗi kiểm thử tự động cập nhật: `npm run test:watch`

### Frontend
* Chạy môi trường phát triển: `npm run dev`
* Biên dịch bản Product hoàn chỉnh: `npm run build`
* Xem thử bản build: `npm run preview`
* Kiểm tra chất lượng mã nguồn: `npm run lint`

---

## 📌 Các Lưu Ý Quan Trọng
* Hãy chắc chắn khởi chạy **Redis** trước khi khởi chạy Backend, vì hệ thống cần Redis để xác thực phiên đăng nhập và bảo vệ hệ thống khỏi các cuộc tấn công DDoS/Brute force.
* Khi chạy kiểm thử tự động cho Backend (`npm test`), hệ thống sẽ tự động tách biệt kết nối sang cơ sở dữ liệu `petshop-test` để tránh ảnh hưởng đến dữ liệu phát triển hiện tại của bạn.
