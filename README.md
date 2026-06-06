<<<<<<< HEAD
# Hướng dẫn chạy dự án

## 1. Yêu cầu
- Node.js 18+.
- npm 9+.
- MongoDB đang chạy hoặc MongoDB Atlas.
- Redis đang chạy nếu bạn dùng chức năng đăng nhập / session / rate limit.
- Docker Desktop đã cài nếu bạn muốn chạy Redis bằng Docker.

## 2. Cài đặt
Mở 2 terminal riêng biệt và cài dependency cho từng phần:

```bash
cd back-end
npm install
```

```bash
cd front-end
npm install
```

## 3. Cấu hình biến môi trường

### Backend: `back-end/.env`
Tạo file `.env` trong thư mục `back-end/` với nội dung tương tự:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/your_database
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=your_session_secret
```

Nếu dùng MongoDB Atlas, thay `MONGO_URI` bằng chuỗi kết nối của bạn.

### Frontend: `front-end/.env`
Tạo file `.env` trong thư mục `front-end/` nếu muốn đổi URL API:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Nếu không khai báo, frontend sẽ tự dùng `http://localhost:5000`.

## 4. Khởi chạy Redis bằng Docker

Nếu máy bạn đã cài Docker, có thể chạy Redis bằng một trong hai cách sau:

### Cách 1: Dùng container có sẵn
```bash
docker start redis
```

### Cách 2: Tạo mới container Redis
```bash
docker run --name redis -p 6379:6379 -d redis:7-alpine
```

Nếu muốn kiểm tra Redis có chạy hay không:
```bash
docker ps
```

Redis mặc định sẽ lắng nghe tại `redis://localhost:6379`, đúng với giá trị `REDIS_URL` ở trên.

## 5. Chạy ứng dụng

### Terminal 1 - Backend
```bash
cd back-end
npm start
```

Backend sẽ chạy tại `http://localhost:5000`.

### Terminal 2 - Frontend
```bash
cd front-end
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`.

## 6. Một số lưu ý
- Root project hiện không có script chạy chung, nên hãy chạy từng phần trong thư mục `back-end/` và `front-end/`.
- Nếu backend báo lỗi kết nối Redis, hãy đảm bảo Redis đã được khởi động trước.
- Nếu frontend gọi API sai địa chỉ, kiểm tra lại `VITE_API_BASE_URL` trong `front-end/.env`.
- Nếu backend báo lỗi `REDIS_URL` hoặc không kết nối được Redis, hãy kiểm tra lại file `back-end/.env` và container Redis đang expose cổng `6379`.

## 7. Kiểm tra nhanh
- Backend sống: mở `http://localhost:5000/api`.
- Frontend sống: mở `http://localhost:5173`.

## 8. Lệnh hữu ích

### Backend
```bash
npm start
npm test
npm run test:watch
```

### Frontend
```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## 9. Thứ tự khởi chạy khuyến nghị
1. Khởi động Docker Desktop.
2. Chạy Redis bằng `docker start redis` hoặc `docker run --name redis -p 6379:6379 -d redis:7-alpine`.
3. Chạy backend bằng `cd back-end && npm start`.
4. Chạy frontend bằng `cd front-end && npm run dev`.
=======
# Petshop-website
>>>>>>> 2605ba340459049d5f88752663d26bec89ff37f8
