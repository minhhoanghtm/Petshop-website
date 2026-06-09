import { logger } from "../logger/logger.js";

export const paginationMiddleware = (defaultLimit = 10, maxLimit = 100) => {
  return (req, res, next) => {
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    // Chuẩn hóa số trang (phải lớn hơn hoặc bằng 1)
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    // Chuẩn hóa kích thước trang (phải nằm trong khoảng [1, maxLimit])
    if (isNaN(limit) || limit < 1) {
      limit = defaultLimit;
    } else if (limit > maxLimit) {
      logger.warn(`Client yêu cầu limit vượt mức cho phép (${limit} > ${maxLimit}). Tự động điều chỉnh về giới hạn tối đa.`);
      limit = maxLimit;
    }

    // Tính toán số bản ghi cần bỏ qua (offset) dưới database
    const skip = (page - 1) * limit;

    // Gán thông tin phân trang vào request để controller/service sử dụng
    req.pagination = {
      page,
      limit,
      skip,
    };

    next();
  };
};

export default paginationMiddleware;
