import { enqueueOtpEmail } from "../queues/otpQueue.js";
import { logger } from "../logger/logger.js";

const getHtmlTemplate = (title, content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f9f9f9;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
      border: 1px solid #eef2f5;
    }
    .header {
      background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
      color: #ffffff;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px 20px;
    }
    .content p {
      margin: 0 0 15px;
      color: #555555;
    }
    .alert-box {
      background-color: #fff9db;
      border-left: 4px solid #fab005;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      background-color: #f1f3f5;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #868e96;
      border-top: 1px solid #e9ecef;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pet Station Security Alert</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Đây là email tự động từ hệ thống Pet Station. Vui lòng không phản hồi email này.</p>
      <p>© ${new Date().getFullYear()} Pet Station. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

export const sendAccountLockedEmail = async (email, remainingMs) => {
  const durationText = remainingMs >= 24 * 60 * 60 * 1000 
    ? "24 giờ" 
    : remainingMs >= 3 * 60 * 1000 
    ? "3 phút" 
    : "30 giây";

  const title = "Tài khoản của bạn đã bị khóa tạm thời";
  const html = getHtmlTemplate(
    title,
    `
    <p>Xin chào,</p>
    <p>Hệ thống của chúng tôi phát hiện nhiều lần đăng nhập không thành công vào tài khoản của bạn (<strong>${email}</strong>).</p>
    <div class="alert-box">
      <strong>Trạng thái:</strong> Tài khoản đã bị khóa tạm thời trong <strong>${durationText}</strong> để bảo vệ an toàn thông tin.
    </div>
    <p>Nếu bạn không thực hiện các lần đăng nhập này, rất có thể ai đó đang cố gắng truy cập trái phép tài khoản của bạn. Chúng tôi khuyến nghị bạn nên:</p>
    <ul>
      <li>Chờ hết thời gian khóa và thực hiện đổi mật khẩu ngay lập tức.</li>
      <li>Sử dụng chức năng quên mật khẩu để tự mở khóa thông qua mã xác thực email.</li>
    </ul>
    <p>Trân trọng,<br>Đội ngũ bảo mật Pet Station</p>
    `
  );

  const text = `Tài khoản ${email} đã bị khóa tạm thời trong ${durationText} do nhập sai mật khẩu nhiều lần. Vui lòng đặt lại mật khẩu hoặc chờ hết thời gian khóa.`;

  try {
    await enqueueOtpEmail({
      email,
      purpose: "account-locked-warning",
      subject: `[Cảnh báo bảo mật] Tài khoản Pet Station của bạn đã bị khóa tạm thời`,
      text,
      html,
    });
    logger.info("Enqueued account locked warning email", { email });
  } catch (error) {
    logger.error("Failed to enqueue account locked email", { email, error: error.message });
  }
};

export const sendPasswordChangedEmail = async (email) => {
  const title = "Mật khẩu của bạn đã được thay đổi";
  const html = getHtmlTemplate(
    title,
    `
    <p>Xin chào,</p>
    <p>Mật khẩu của tài khoản <strong>${email}</strong> đã được thay đổi thành công.</p>
    <div class="alert-box">
      <strong>Lưu ý:</strong> Nếu bạn không thực hiện thay đổi này, hãy liên hệ ngay với bộ phận hỗ trợ khách hàng của Pet Station hoặc sử dụng tính năng "Quên mật khẩu" ở trang đăng nhập để khôi phục tài khoản ngay lập tức.
    </div>
    <p>Trân trọng,<br>Đội ngũ bảo mật Pet Station</p>
    `
  );

  const text = `Mật khẩu tài khoản ${email} của bạn đã được thay đổi thành công. Nếu bạn không thực hiện thay đổi này, vui lòng khôi phục lại mật khẩu ngay lập tức.`;

  try {
    await enqueueOtpEmail({
      email,
      purpose: "password-changed",
      subject: `[Thông báo bảo mật] Mật khẩu tài khoản Pet Station đã được thay đổi`,
      text,
      html,
    });
    logger.info("Enqueued password changed notification email", { email });
  } catch (error) {
    logger.error("Failed to enqueue password changed email", { email, error: error.message });
  }
};

export const sendPasswordResetSuccessEmail = async (email) => {
  const title = "Mật khẩu của bạn đã được đặt lại";
  const html = getHtmlTemplate(
    title,
    `
    <p>Xin chào,</p>
    <p>Mật khẩu của tài khoản <strong>${email}</strong> đã được đặt lại thành công thông qua mã xác thực OTP.</p>
    <div class="alert-box">
      <strong>Lưu ý:</strong> Nếu bạn không yêu cầu đặt lại mật khẩu này, có thể tài khoản của bạn đang có nguy cơ bị xâm nhập. Vui lòng thực hiện đặt lại mật khẩu mới an toàn hơn và đổi mật khẩu email cá nhân của bạn.
    </div>
    <p>Trân trọng,<br>Đội ngũ bảo mật Pet Station</p>
    `
  );

  const text = `Mật khẩu tài khoản ${email} của bạn đã được đặt lại thành công. Nếu bạn không yêu cầu điều này, vui lòng kiểm tra lại độ bảo mật tài khoản của mình.`;

  try {
    await enqueueOtpEmail({
      email,
      purpose: "password-reset-success",
      subject: `[Thông báo bảo mật] Mật khẩu tài khoản Pet Station đã được đặt lại thành công`,
      text,
      html,
    });
    logger.info("Enqueued password reset notification email", { email });
  } catch (error) {
    logger.error("Failed to enqueue password reset email", { email, error: error.message });
  }
};

export const sendNewDeviceLoginEmail = async (email, ip, userAgent) => {
  const title = "Phát hiện đăng nhập từ thiết bị lạ";
  const html = getHtmlTemplate(
    title,
    `
    <p>Xin chào,</p>
    <p>Hệ thống phát hiện tài khoản của bạn (<strong>${email}</strong>) vừa được đăng nhập từ một thiết bị hoặc trình duyệt mới.</p>
    <div class="alert-box">
      <strong>Thông tin đăng nhập:</strong><br>
      • <strong>Địa chỉ IP:</strong> ${ip}<br>
      • <strong>Trình duyệt/Thiết bị:</strong> ${userAgent}<br>
      • <strong>Thời gian:</strong> ${new Date().toLocaleString("vi-VN")}
    </div>
    <p>Nếu đây là bạn, bạn có thể bỏ qua email này. Nếu bạn không thực hiện đăng nhập này, vui lòng thay đổi mật khẩu của mình ngay lập tức để bảo vệ tài khoản.</p>
    <p>Trân trọng,<br>Đội ngũ bảo mật Pet Station</p>
    `
  );

  const text = `Phát hiện đăng nhập lạ vào tài khoản ${email} từ IP ${ip} và User-Agent ${userAgent}. Nếu không phải bạn, hãy đổi mật khẩu ngay lập tức.`;

  try {
    await enqueueOtpEmail({
      email,
      purpose: "new-device-login-warning",
      subject: `[Cảnh báo bảo mật] Phát hiện đăng nhập từ thiết bị lạ`,
      text,
      html,
    });
    logger.info("Enqueued new device warning email", { email });
  } catch (error) {
    logger.error("Failed to enqueue new device email", { email, error: error.message });
  }
};
