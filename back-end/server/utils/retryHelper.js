export const callWithRetry = async (fn, options = {}) => {
  const maxAttemps = options.maxAttemps || 3; // số lần thử lại, mặc định là 3 lần
  const delayMs = options.delayMs || 2000; // mặc định là 2000ms (2 giây)

  //Hàm lọc lỗi mặc định, chỉ thử lại nếu là lỗi mạng hoặc là lỗi hệ thống như: 5xx, 429
  const defaultShouldRetry = (error) => {
    if (!error.response) return true; // lỗi mạng
    const status = error.response.status;
    return status === 429 || (status >= 500 && status <= 599); // lỗi hệ thống
  };
  const shouldRetry = options.shouldRetry || defaultShouldRetry; // hàm kiểm tra lỗi để quyết định có nên thử lại hay không
  let attempt = 0; // số lần đã thử
  while (attempt < maxAttemps) {
    try {
      //Thuc hiện hàm cần gọi
      return await fn();
    } catch (error) {
      attempt++;
      // Kiểm tra điều kiện lỗi xem có được phép thử lại hay không
      const allowed = shouldRetry(error);
      logger.error(`Attempt ${attempt} failed: ${error.message}. Allowed to retry: ${allowed}`);

      //Nếu không được phép thử lại hoặc đã đạt đến số lần tối đa thì ném lỗi ra ngoài
      if (!allowed || attempt >= maxAttemps) {
        throw error;
      }

      //Tinh toán thời gian chờ trước khi thử lại, có thể sử dụng delayMs hoặc một hàm tùy chỉnh để tính toán thời gian chờ
      const backoffDelay = delayMs * attempt; // tăng dần thời gian chờ theo số lần thử
      const jitter = Math.random() * 1000; // thêm một chút ngẫu nhiên để tránh tình trạng "thundering herd"
      const finaklDelay = backoffDelay + jitter; // tổng thời gian chờ cuối cùng

      logger.info(`Waiting for ${finaklDelay.toFixed(0)}ms before retrying...`);
      await new Promise((resolve) => setTimeout(resolve, finaklDelay)); // chờ trước khi thử lại
    }
  }
};
