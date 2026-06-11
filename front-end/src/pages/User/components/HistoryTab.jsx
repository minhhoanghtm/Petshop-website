import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FaCartPlus } from "react-icons/fa";
import OrderHistory from "./OrderHistory";
import Modal from "../../../components/Modal";

const HistoryTab = () => {
    const {
        orders,
        ordersLoading,
        formatDisplayDate,
        handleCancelOrder,
        handlePayNow,
        hanldeGenerateInvoice,
        STATUS_META,
        ORDER_TABS,
    } = useOutletContext();

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);

    const formatCurrency = (value) =>
        new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(value || 0);

    const shippingCost = Number(selectedOrder?.shippingCost || 0);
    const voucherDiscount = Number(
        selectedOrder?.discount_amount ?? selectedOrder?.discountAmount ?? 0,
    );

    const handleViewOrder = (order) => {
        setSelectedOrder(order);
        setShowOrderModal(true);
    };

    return (
        <>
            <OrderHistory
                title="Lịch sử mua hàng"
                orders={orders}
                tabs={ORDER_TABS}
                statusMeta={STATUS_META}
                defaultTab="all"
                loading={ordersLoading}
                onViewOrder={handleViewOrder}
                onCancelOrder={handleCancelOrder}
                formatDate={formatDisplayDate}
                onPayNow={handlePayNow}
            />

            {showOrderModal && selectedOrder && (
                <Modal
                    isOpen={showOrderModal}
                    onClose={() => setShowOrderModal(false)}
                    size="lg"
                >
                    <div className="p-6">
                        <h2 className="flex gap-3 justify-center text-2xl font-bold mb-6 text-slate-900 text-center border-b pb-4">
                            <FaCartPlus className="w-8 h-8" />
                            Chi tiết đơn hàng
                        </h2>
                        <div className="space-y-6 text-slate-700">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Mã đơn hàng:</p>
                                <p className="text-lg font-semibold">{selectedOrder._id}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Ngày đặt:</p>
                                <p className="text-lg">
                                    {formatDisplayDate(selectedOrder.order_date)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Tiền ship:</p>
                                <p className="text-lg font-semibold text-slate-800">
                                    {formatCurrency(shippingCost)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Voucher đã giảm:</p>
                                <p className="text-lg font-semibold text-rose-600">
                                    -{formatCurrency(voucherDiscount)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Trạng thái:</p>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${STATUS_META[selectedOrder.statusNormalized]?.badge || "border-slate-200 text-slate-600"}`}>
                                    {STATUS_META[selectedOrder.statusNormalized]?.label || selectedOrder.status}
                                </span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Sản phẩm:</p>
                                <ul className="list-none divide-y divide-slate-200">
                                    {selectedOrder.items.map((item, index) => (
                                        <li key={index} className="py-3 flex justify-between items-center">
                                            <span className="font-medium text-slate-800">{item.product_id?.name}</span>
                                            <span className="text-sm text-slate-700">
                                                {item.quantity} x {item.product_id?.price?.toLocaleString()} VNĐ
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                <p className="text-xl font-medium text-slate-500">Tổng tiền:</p>
                                <p className="text-xl font-bold text-amber-600">{selectedOrder.total_price?.toLocaleString()} VNĐ</p>
                            </div>
                            <div className="mt-6 flex justify-between items-center">
                                <button
                                    onClick={() => hanldeGenerateInvoice(selectedOrder)}
                                    className="text-sm font-medium text-amber-700 hover:text-amber-600 cursor-pointer"
                                >
                                    Tải hóa đơn
                                </button>
                                <button
                                    onClick={() => setShowOrderModal(false)}
                                    className="bg-amber-600 text-white py-2 px-6 rounded-xl hover:bg-amber-500 transition cursor-pointer"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default HistoryTab;
