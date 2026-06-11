import { useState, useEffect } from "react";
import { FaEye, FaTrash, FaStar, FaRegStar, FaClock } from "react-icons/fa";
import ReviewButton from "../../../components/reviews/ReviewButton";
import { Link } from "react-router-dom";

const formatCurrency = (value) =>
    new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
    }).format(value || 0);

const OrderCard = ({
    order,
    statusMeta,
    onView,
    onCancel,
    canCancel,
    formatDate,
    reviewMap = new Map(),
    onPayNow,
}) => {
    const statusInfo = statusMeta[order.statusNormalized];
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const isOnlinePayment = ["MOMO", "VNPAY"].includes(order.payment_method);
        const isUnpaid = order.payment_status === "pending";
        const isActive = ["pending", "confirmed"].includes(order.statusNormalized);

        if (!isOnlinePayment || !isUnpaid || !isActive) {
            setTimeLeft("");
            return;
        }

        const calculateTimeLeft = () => {
            const orderTime = new Date(order.order_date).getTime();
            const expiryTime = orderTime + 24 * 60 * 60 * 1000; // 24 hours
            const difference = expiryTime - Date.now();

            if (difference <= 0) {
                return "Hết hạn";
            }

            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            const pad = (num) => String(num).padStart(2, "0");
            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        };

        setTimeLeft(calculateTimeLeft());

        const timer = setInterval(() => {
            const time = calculateTimeLeft();
            setTimeLeft(time);
            if (time === "Hết hạn") {
                clearInterval(timer);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [order.order_date, order.payment_method, order.payment_status, order.statusNormalized]);
    
    let paymentMethodLabel = order.payment_method || order.paymentMethod || "Thanh toán khi nhận hàng";
    if (paymentMethodLabel === "MOMO") {
        paymentMethodLabel = "Ví MoMo";
    } else if (paymentMethodLabel === "PAYPAL") {
        paymentMethodLabel = "Ví PayPal";
    } else if (paymentMethodLabel === "COD") {
        paymentMethodLabel = "Thanh toán khi nhận hàng (COD)";
    } else if (paymentMethodLabel === "VNPAY") {
        paymentMethodLabel = "VNPay";
    }

    const paymentStatusText = order.payment_status === "paid"
        ? "Đã thanh toán"
        : order.payment_status === "refunded"
            ? "Đã hoàn tiền"
            : "Chưa thanh toán";

    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <p className="text-sm text-slate-500">Mã đơn hàng</p>
                    <p className="text-lg font-semibold text-slate-900">
                        #{order._id}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            statusInfo?.badge || "border-slate-200 text-slate-600"
                        }`}
                    >
                        {statusInfo?.label || order.status}
                    </span>
                    <p className="text-lg font-semibold text-slate-900">
                        {formatCurrency(order.total_price)}
                    </p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-slate-600">
                <div>
                    <p className="text-slate-500">Ngày đặt</p>
                    <p className="font-medium text-slate-800">
                        {formatDate(order.order_date)}
                        {/* {formatDisplayDate(order.order_date)} */}
                    </p>
                </div>
                <div>
                    <p className="text-slate-500">Trạng thái</p>
                    <p className="font-medium text-slate-800">
                        {statusInfo?.label || order.status}
                    </p>
                </div>
                <div>
                    <p className="text-slate-500">Thanh toán</p>
                    <div className="font-medium text-slate-800 flex items-center flex-wrap gap-1">
                        {paymentMethodLabel}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            order.payment_status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : order.payment_status === "refunded"
                                    ? "bg-slate-100 text-slate-700 border border-slate-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                            {paymentStatusText}
                        </span>
                    </div>
                    {timeLeft && (
                        <div className={`text-[11px] mt-1 font-semibold flex items-center gap-1 ${
                            timeLeft === "Hết hạn" ? "text-rose-600" : "text-amber-600"
                        }`}>
                            <FaClock className={timeLeft === "Hết hạn" ? "" : "animate-spin"} />
                            {timeLeft === "Hết hạn" ? "Hết hạn thanh toán" : `Hết hạn sau: ${timeLeft}`}
                        </div>
                    )}
                </div>
                <div className="md:text-right">
                    <p className="text-slate-500">Tổng tiền</p>
                    <p className="font-semibold text-slate-900">
                        {formatCurrency(order.total_price)}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                    onClick={() => onView(order)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:border-amber-300 hover:text-amber-700 transition cursor-pointer"
                >
                    <FaEye />
                    Xem chi tiết
                </button>
                {order.payment_method === "MOMO" && order.payment_status === "pending" && order.statusNormalized !== "cancelled" && timeLeft !== "Hết hạn" && (
                    <button
                        onClick={() => onPayNow && onPayNow(order)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#d82d8b] text-white text-sm font-medium hover:bg-[#b0226f] transition cursor-pointer shadow-sm font-medium"
                    >
                        Thanh toán ngay (MoMo)
                    </button>
                )}
                {order.payment_method === "VNPAY" && order.payment_status === "pending" && order.statusNormalized !== "cancelled" && timeLeft !== "Hết hạn" && (
                    <button
                        onClick={() => onPayNow && onPayNow(order)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#005ba1] text-white text-sm font-medium hover:bg-[#004780] transition cursor-pointer shadow-sm font-medium"
                    >
                        Thanh toán ngay (VNPay)
                    </button>
                )}
                {canCancel && (
                    <button
                        onClick={() => onCancel(order._id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition cursor-pointer"
                    >
                        <FaTrash />
                        Hủy đơn hàng
                    </button>
                )}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">
                    Sản phẩm trong đơn
                </h4>
                <div className="space-y-3">
                    {order.items.map((item) => {
                        const product = item.product_id || {};
                        const productId = String(product._id || product.id || "");
                        const review = reviewMap.get(productId) || null;
                        const reviewable = ["delivered", "completed"].includes(order.statusNormalized);
                        const stars = Array.from({ length: 5 }, (_, index) => index + 1);

                        return (
                            <div
                                key={`${order._id}-${productId}`}
                                className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <img
                                        src={product.images?.[0] || "/pet.png"}
                                        alt={product.name || "Sản phẩm"}
                                        className="h-16 w-16 rounded-xl object-cover"
                                    />
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link to={`/product/${product.slug || ""}`} className="font-medium text-slate-900 hover:text-amber-700 transition">
                                                {product.name || "Sản phẩm không xác định"}
                                            </Link>
                                            {review && (
                                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                                    Đã đánh giá
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500">
                                            {formatCurrency(product.price)} x {item.quantity}
                                        </p>

                                        {review && (
                                            <div className="mt-2 flex items-center gap-1">
                                                {stars.map((star) =>
                                                    star <= Math.round(Number(review.rating || 0)) ? (
                                                        <FaStar key={star} className="text-amber-500 text-sm" />
                                                    ) : (
                                                        <FaRegStar key={star} className="text-slate-300 text-sm" />
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {review ? (
                                        <ReviewButton to={`/review/${productId}/${order._id}`} variant="secondary">
                                            Chỉnh sửa đánh giá
                                        </ReviewButton>
                                    ) : reviewable ? (
                                        <ReviewButton to={`/review/${productId}/${order._id}`}>
                                            Đánh giá sản phẩm
                                        </ReviewButton>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default OrderCard;