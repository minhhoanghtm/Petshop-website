import {
  FaBoxOpen,
  FaShippingFast,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaStar,
  FaRegStar,
} from "react-icons/fa";
import ReviewButton from "./reviews/ReviewButton";

export default function OrderDetailsModal({
  selectedOrder,
  formatDate,
  getStatusInfo,
  setShowModal,
  reviewMap = new Map(),
}) {
  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div
            className="absolute inset-0 bg-transparent"
            onClick={() => setShowModal(false)}
          ></div>
        </div>

        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full z-50000">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Chi tiết đơn hàng #{selectedOrder._id.substring(0, 8)}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Thông tin khách hàng
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Tên:</span>{" "}
                        {selectedOrder.user_id?.fullName || "Khách vãng lai"}
                      </p>
                      {selectedOrder.user_id?.email && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Email:</span>{" "}
                          {selectedOrder.user_id.email}
                        </p>
                      )}
                      {selectedOrder.user_id?.phone && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Điện thoại:</span>{" "}
                          {selectedOrder.user_id.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Thông tin đơn hàng
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Ngày đặt:</span>{" "}
                        {formatDate(selectedOrder.order_date)}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Trạng thái:</span>{" "}
                        <span
                          className={`inline-flex items-center ${getStatusInfo(selectedOrder.statusNormalized || selectedOrder.status).color
                            } text-xs px-2 py-1 rounded-full`}
                        >
                          {getStatusInfo(
                            selectedOrder.statusNormalized || selectedOrder.status
                          ).icon}
                          <span className="ml-1">
                            {getStatusInfo(
                              selectedOrder.statusNormalized || selectedOrder.status
                            ).label || selectedOrder.status}
                          </span>
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Tổng tiền:</span>{" "}
                        <span className="font-medium">
                          {new Intl.NumberFormat("vi-VN", {
                            style: "currency",
                            currency: "VND",
                          }).format(selectedOrder.total_price)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Sản phẩm đã đặt
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sản phẩm
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Đơn giá
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Số lượng
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Thành tiền
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedOrder.items.map((item, index) => {
                          const product = item.product_id || {};
                          const productId = String(product._id || product.id || "");
                          const review = reviewMap.get(productId) || null;
                          const reviewable = ["delivered", "completed"].includes(
                            selectedOrder.statusNormalized || selectedOrder.status,
                          );
                          const stars = Array.from({ length: 5 }, (_, starIndex) => starIndex + 1);

                          return (
                          <tr key={index}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {product?.name ||
                                "Sản phẩm không xác định"}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {new Intl.NumberFormat("vi-VN", {
                                style: "currency",
                                currency: "VND",
                              }).format(product?.price || 0)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {new Intl.NumberFormat("vi-VN", {
                                style: "currency",
                                currency: "VND",
                              }).format(
                                (item.product_id?.price || 0) * item.quantity
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {review ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    {stars.map((star) =>
                                      star <= Math.round(Number(review.rating || 0)) ? (
                                        <FaStar key={star} className="text-amber-500" />
                                      ) : (
                                        <FaRegStar key={star} className="text-slate-300" />
                                      ),
                                    )}
                                  </div>
                                  <ReviewButton to={`/review/${productId}/${selectedOrder._id}`} variant="secondary">
                                    Chỉnh sửa đánh giá
                                  </ReviewButton>
                                </div>
                              ) : reviewable ? (
                                <ReviewButton to={`/review/${productId}/${selectedOrder._id}`}>
                                  Đánh giá sản phẩm
                                </ReviewButton>
                              ) : (
                                <span className="text-gray-500">Chưa đủ điều kiện</span>
                              )}
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border shadow-sm px-4 py-2 text-base font-medium text-white sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm cursor-pointer bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => setShowModal(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
