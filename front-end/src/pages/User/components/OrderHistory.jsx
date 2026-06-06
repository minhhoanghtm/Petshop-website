import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import OrderTabs from "./OrderTabs";
import OrderCard from "./OrderCard";
import { fetchMyReviews } from "../../../stores/reviewSlice";

const OrderHistory = ({
    title,
    orders,
    tabs,
    statusMeta,
    defaultTab = "all",
    loading,
    onViewOrder,
    onCancelOrder,
    formatDate,
    onPayNow,
}) => {
    const dispatch = useDispatch();
    const { myReviews } = useSelector((state) => state.reviews);
    const [activeTab, setActiveTab] = useState(defaultTab);

    useEffect(() => {
        if (orders.length) {
            dispatch(fetchMyReviews());
        }
    }, [dispatch, orders.length]);

    const reviewMap = useMemo(() => {
        const map = new Map();
        if (myReviews && Array.isArray(myReviews)) {
            myReviews.forEach((review) => {
                const productId = String(review.product?._id || review.product);
                if (!map.has(productId)) {
                    map.set(productId, review);
                }
            });
        }
        return map;
    }, [myReviews]);

    const filteredOrders = useMemo(() => {
        if (activeTab === "all") return orders;
        return orders.filter((order) => order.statusNormalized === activeTab);
    }, [activeTab, orders]);

    const canCancelStatus = (status) =>
        status !== "delivered" && status !== "cancelled";

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
                <OrderTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
            </div>

            {loading && (
                <div className="space-y-4">
                    {[0, 1].map((item) => (
                        <div
                            key={item}
                            className="h-28 rounded-2xl bg-slate-100 animate-pulse"
                        />
                    ))}
                </div>
            )}

            {!loading && filteredOrders.length === 0 && (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-500">
                    Chưa có đơn hàng phù hợp với trạng thái này.
                </div>
            )}

            {!loading && filteredOrders.length > 0 && (
                <div className="space-y-4">
                    {filteredOrders.map((order) => (
                        <OrderCard
                            key={order._id}
                            order={order}
                            statusMeta={statusMeta}
                            onView={onViewOrder}
                            onCancel={onCancelOrder}
                            canCancel={canCancelStatus(order.statusNormalized)}
                            formatDate={formatDate}
                            reviewMap={reviewMap}
                            onPayNow={onPayNow}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrderHistory;