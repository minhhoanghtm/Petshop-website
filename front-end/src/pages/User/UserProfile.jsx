import { useEffect, useState } from "react";
import {
    FaUser,
    FaShoppingBag,
    FaHistory,
    FaEdit,
    FaSignOutAlt,
    FaMapMarkerAlt,
    FaCartPlus,
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import LoadingOverlay from "../../components/LoadingOverlay";
import { toast } from "react-toastify";
import ScrollToTopButton from "../../components/ScrollToTopButton";
import Modal from "../../components/Modal";

import { generateInvoice } from "../../utils/generateInvoice";
import { signOut as signOutRequest } from "../../services/authService";
import {
    fetchProfile as fetchProfileRequest,
    updateProfile as updateProfileRequest,
} from "../../services/userService";

import {
    fetchOrdersByUser as fetchOrdersByUserRequest,
    updateOrder as updateOrderRequest
} from "../../services/orderService";
import { createMomoPayment } from "../../services/paymentService";
import { isValidPhone, isValidGmailAddress } from "../../utils/validation";
    
import ShippingInfo from "./components/ShippingInfo";
import OrderHistory from "./components/OrderHistory";

const STATUS_META = {
    pending: {
        label: "Chờ xác nhận",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
    },
    confirmed: {
        label: "Đã xác nhận",
        badge: "bg-blue-50 text-blue-700 border-blue-200",
    },
    shipping: {
        label: "Đang giao",
        badge: "bg-purple-50 text-purple-700 border-purple-200",
    },
    delivered: {
        label: "Đã giao",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    cancelled: {
        label: "Đã hủy",
        badge: "bg-rose-50 text-rose-600 border-rose-200",
    },
};

const ORDER_TABS = [
    { key: "all", label: "Tất cả" },
    { key: "pending", label: "Chờ xác nhận" },
    { key: "confirmed", label: "Đã xác nhận" },
    { key: "shipping", label: "Đang giao" },
    { key: "delivered", label: "Đã giao" },
    { key: "cancelled", label: "Đã hủy" },
];

const IN_PROGRESS_TABS = ORDER_TABS.filter((tab) =>
    ["pending", "confirmed", "shipping"].includes(tab.key)
);

const normalizeStatus = (status) => {
    if (!status) return "pending";
    const normalized = String(status).trim();

    switch (normalized) {
        case "pending":
        case "Chờ xử lý":
        case "Chờ xác nhận":
            return "pending";
        case "confirmed":
        case "Đang xử lý":
        case "Đã xác nhận":
            return "confirmed";
        case "shipping":
        case "Đang giao hàng":
        case "Đang giao":
            return "shipping";
        case "delivered":
        case "Đã giao hàng":
        case "Đã giao":
        case "Hoàn tất":
            return "delivered";
        case "cancelled":
        case "Đã hủy":
            return "cancelled";
        default:
            return "pending";
    }
};

const UserProfile = () => {
    const [user, setUser] = useState({
        fullName: "",
        email: "",
        phone: "",
        address: "",
        birthDate: "",
        avatar: "",
        gender: "",
    });

    const [initialUser, setInitialUser] = useState({
        fullName: "",
        email: "",
        phone: "",
        address: "",
        birthDate: "",
        avatar: "",
        gender: "",
    });

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [activeTab, setActiveTab] = useState("profile");

    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        } else if (location.hash === "#history" || location.hash === "#don-hang-cua-ban") {
            setActiveTab("history");
        }
    }, [location]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [orderStats, setOrderStats] = useState({
        totalOrders: 0,
        inProgressOrders: 0,
        deliveredOrders: 0,
        totalSpent: 0,
    });
    
    const [errors, setErrors] = useState({});

    const formatDate = (dateString) => {
        if (!dateString) return "";
        
        // Parse the date string
        let date = new Date(dateString);
        
        // If date is invalid, try parsing it as is
        if (isNaN(date.getTime())) {
            return "";
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        
        // Validate year is reasonable (between 1900 and current year + 1)
        if (year < 1900 || year > new Date().getFullYear() + 1) {
            return "";
        }
        
        return `${year}-${month}-${day}`;
    };

    const formatDisplayDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    const handleProfileChange = (field) => (event) => {
        setUser((prev) => ({ ...prev, [field]: event.target.value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validateProfile = () => {
        const nextErrors = {};

        if (!user.fullName || !String(user.fullName).trim()) {
            nextErrors.fullName = "Họ và tên không được để trống.";
        }

        if (!user.birthDate) {
            nextErrors.birthDate = "Vui lòng chọn ngày sinh.";
        }

        if (!user.email || !String(user.email).trim()) {
            nextErrors.email = "Email không được để trống.";
        } else if (!isValidGmailAddress(user.email)) {
            nextErrors.email = "Email phải có đuôi @gmail.com.";
        }

        if (!user.phone || !String(user.phone).trim()) {
            nextErrors.phone = "Số điện thoại không được để trống.";
        } else if (!isValidPhone(user.phone)) {
            nextErrors.phone = "Số điện thoại phải có đúng 10 chữ số.";
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const hasProfileChanged = () => {
        return (
            user.fullName !== initialUser.fullName ||
            user.email !== initialUser.email ||
            user.phone !== initialUser.phone ||
            user.address !== initialUser.address ||
            user.birthDate !== initialUser.birthDate ||
            user.gender !== initialUser.gender
        );
    };

    const handleCancelEdit = () => {
        setUser(initialUser);
        setErrors({});
    };
    
    const convertBase64ToImage = (value) => {
        if (!value) return "/avatar.png";
        if (typeof value !== "string") return "/avatar.png";
        if (value.startsWith("data:image")) return value;
        if (value.startsWith("/") || value.startsWith("http")) return value;
        return `data:image/jpeg;base64,${value}`;
    };

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = localStorage.getItem("accessToken");
                if (!token) {
                    navigate("/login");
                    return;
                }

                const res = await fetchProfileRequest();
                const userData = res.data;
                userData.avatar = convertBase64ToImage(userData.avatar);
                setUser(userData);
                setInitialUser(userData);

                await fetchUserOrders(userData._id);
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };
        fetchUserData();
    }, [navigate]);

    const fetchUserOrders = async (userId) => {
        try {
            setOrdersLoading(true);
            const response = await fetchOrdersByUserRequest(userId);
            const userOrders = response.data || [];

            const normalizedOrders = userOrders.map((order) => {
                const statusNormalized = normalizeStatus(order.status);
                return {
                    ...order,
                    statusNormalized,
                };
            });

            const inProgressOrders = normalizedOrders.filter((order) =>
                ["pending", "confirmed", "shipping"].includes(order.statusNormalized)
            );
            const deliveredOrders = normalizedOrders.filter(
                (order) => order.statusNormalized === "delivered"
            );
            const totalSpent = normalizedOrders.reduce(
                (sum, order) => sum + order.total_price,
                0
            );

            setOrderStats({
                totalOrders: normalizedOrders.length,
                inProgressOrders: inProgressOrders.length,
                deliveredOrders: deliveredOrders.length,
                totalSpent,
            });

            setOrders(normalizedOrders);
            setOrdersLoading(false);
        } catch (err) {
            console.error("Error fetching orders:", err);
            setError("Failed to load orders: " + err.message);
            setOrdersLoading(false);
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await signOutRequest();
            toast.success("Đăng xuất thành công!");

            localStorage.removeItem("accessToken");
            localStorage.removeItem("user");
            setTimeout(() => {
                navigate("/");
                setIsLoggingOut(false);
            }, 2000);
        } catch (err) {
            console.error("Logout Error:", err.response?.data || err.message);
            if (err.response?.status === 429) {
                setIsLoggingOut(false);
                return;
            }

            localStorage.removeItem("accessToken");
            toast.error("Đăng xuất thất bại. Vui lòng thử lại!");
            setIsLoggingOut(false);
        }
    };

    const handleAvatarChange = async (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const storedUser = JSON.parse(localStorage.getItem("user"));
                const avatarBinary = reader.result;

                const updateUser = {
                    ...storedUser,
                    avatar: avatarBinary.split(",")[1],
                };

                const res = await updateProfileRequest(updateUser);

                const updatedUser = res.data;
                updatedUser.avatar = convertBase64ToImage(updatedUser.avatar);
                setUser(updatedUser);

                localStorage.setItem(
                    "user",
                    JSON.stringify({ ...storedUser, avatar: updatedUser.avatar })
                );

                toast.success("Cập nhật ảnh đại diện thành công!");
                setSelectedFile(null);
            } catch (err) {
                console.error("Lỗi khi cập nhật avatar:", err);
                toast.error("Cập nhật ảnh đại diện thất bại!");
            }
        };

        reader.onerror = () => {
            toast.error("Đọc file thất bại!");
        };

        reader.readAsDataURL(file);
    };

    const handleUpdateProfile = async () => {
        if (!validateProfile()) {
            return;
        }

        try {
            const storedUser = JSON.parse(localStorage.getItem("user"));
            const res = await updateProfileRequest({
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                address: user.address,
                birthDate: user.birthDate,
                gender: user.gender,
            });

            const updatedUser = res.data;

            if (user.avatar && user.avatar.startsWith("data:image")) {
                updatedUser.avatar = user.avatar;
            } else {
                updatedUser.avatar = convertBase64ToImage(updatedUser.avatar);
            }

            setUser(updatedUser);
            localStorage.setItem(
                "user",
                JSON.stringify({
                    ...storedUser,
                    fullName: updatedUser.fullName,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    address: updatedUser.address,
                    birthDate: updatedUser.birthDate,
                    gender: updatedUser.gender,
                })
            );

            toast.success("Cập nhật thông tin thành công!");
        } catch (err) {
            console.error("Lỗi khi cập nhật thông tin:", err);
            toast.error(
                err.response?.data?.message || "Cập nhật thông tin thất bại!"
            );
        }
    };

    const handleViewOrder = (order) => {
        setSelectedOrder(order);
        setShowOrderModal(true);
    };

    const handleCancelOrder = async (orderId) => {
        try {
            const confirmed = window.confirm(
                "Bạn có chắc chắn muốn hủy đơn hàng này?"
            );
            if (!confirmed) return;

            const response = await updateOrderRequest(orderId, {
                status: "cancelled",
            });

            if (response.status === 200) {
                toast.success("Đã hủy đơn hàng thành công");

                const storedUser = JSON.parse(localStorage.getItem("user"));
                fetchUserOrders(storedUser._id);
            }
        } catch (error) {
            console.error("Lỗi khi hủy đơn hàng:", error);
            toast.error(
                error.response?.data?.message ||
                "Không thể hủy đơn hàng. Vui lòng thử lại sau!"
            );
        }
    };

    const handlePayNow = async (order) => {
        if (order.payment_method === "MOMO") {
            try {
                const loadingToastId = toast.loading("Đang tạo link thanh toán MoMo...");
                const response = await createMomoPayment(order._id);
                if (response?.data?.payUrl) {
                    toast.update(loadingToastId, {
                        render: "Đang chuyển hướng sang MoMo...",
                        type: "success",
                        isLoading: false,
                        autoClose: 2000,
                    });
                    setTimeout(() => {
                        window.location.href = response.data.payUrl;
                    }, 1000);
                } else {
                    throw new Error("Không nhận được URL thanh toán từ MoMo.");
                }
            } catch (error) {
                console.error("Lỗi khi thanh toán MoMo:", error);
                toast.error(
                    error.response?.data?.message ||
                    "Không thể tạo liên kết thanh toán MoMo. Vui lòng thử lại sau!"
                );
            }
        }
    };

    const hanldeGenerateInvoice = (order) => {
        generateInvoice(order, formatDisplayDate);
    };

    const handleShippingUpdated = (payload) => {
        if (payload?.address) {
            setUser((prev) => ({ ...prev, address: payload.address }));
            const storedUser = JSON.parse(localStorage.getItem("user")) || {};
            localStorage.setItem(
                "user",
                JSON.stringify({ ...storedUser, address: payload.address })
            );
        }
    };

    if (loading) return <LoadingOverlay isVisible={true} />;
    if (error)
        return (
            <div className="container mx-auto p-4 text-red-500">Lỗi: {error}</div>
        );

    return (
        <>
            <Header />
            <LoadingOverlay isVisible={isLoggingOut} />
            <div className="bg-slate-50">
                <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                        <aside className="w-full lg:w-[30%] bg-white border border-slate-100 shadow-sm rounded-3xl p-6 h-fit">
                            <div className="flex flex-col items-center text-center max-w-md mx-auto lg:max-w-none lg:mx-0">
                                <img
                                    src={user.avatar}
                                    alt="User Avatar"
                                    className="w-24 h-24 rounded-full object-cover"
                                />
                                <label className="mt-3 bg-slate-100 px-4 py-2 rounded-full cursor-pointer flex items-center gap-2 text-xs text-slate-600 hover:text-amber-600">
                                    <FaEdit className="text-slate-500" />
                                    Cập nhật ảnh
                                    <input
                                        type="file"
                                        id="avatar-upload"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => setSelectedFile(e.target.files[0])}
                                    />
                                    {selectedFile && (
                                        <button
                                            className="ml-2 px-2 py-1 bg-amber-600 text-white rounded-full text-xs"
                                            onClick={() => handleAvatarChange(selectedFile)}
                                        >
                                            Lưu
                                        </button>
                                    )}
                                </label>
                                <h2 className="text-lg font-semibold mt-3 text-slate-900">
                                    {user.fullName}
                                </h2>
                                <p className="text-sm text-slate-500">{user.email}</p>
                            </div>

                            <ul className="mt-6 space-y-2 w-full max-w-md mx-auto lg:max-w-none lg:mx-0">
                                {[
                                    { key: "profile", label: "Thông tin cá nhân", icon: FaUser },
                                    { key: "shipping", label: "Thông tin giao hàng", icon: FaMapMarkerAlt },
                                    // { key: "orders", label: "Đơn hàng của bạn", icon: FaShoppingBag },
                                    { key: "history", label: "Lịch sử mua hàng", icon: FaHistory },
                                ].map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activeTab === item.key;
                                    return (
                                        <li key={item.key}>
                                            <button
                                                onClick={() => setActiveTab(item.key)}
                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive
                                                    ? "bg-amber-50 text-amber-700"
                                                    : "text-slate-600 hover:bg-amber-50"
                                                    }`}
                                            >
                                                <Icon />
                                                {item.label}
                                            </button>
                                        </li>
                                    );
                                })}
                                <li>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-amber-50"
                                    >
                                        <FaSignOutAlt />
                                        Đăng xuất
                                    </button>
                                </li>
                            </ul>
                        </aside>

                        <main className="w-full lg:flex-1 bg-white border border-slate-100 shadow-sm rounded-3xl p-6 min-w-0">
                            {activeTab === "profile" && (
                                <div className="space-y-8">
                                    <div>
                                        <h1 className="text-2xl font-semibold text-slate-900 mb-4">
                                            Thông tin cá nhân
                                        </h1>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Họ và tên</label>
                                                <input
                                                    type="text"
                                                    value={user.fullName}
                                                    onChange={handleProfileChange("fullName")}
                                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                />
                                                {errors.fullName && (
                                                    <p className="text-sm font-semibold text-rose-600 mt-1">
                                                        {errors.fullName}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Ngày sinh</label>
                                                <input
                                                    type="date"
                                                    value={formatDate(user.birthDate)}
                                                    onChange={handleProfileChange("birthDate")}
                                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                />
                                                {errors.birthDate && (
                                                    <p className="text-sm font-semibold text-rose-600 mt-1">
                                                        {errors.birthDate}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Giới tính</label>
                                                <select
                                                    value={user.gender || ""}
                                                    onChange={(e) => setUser({
                                                        ...user,
                                                        gender: e.target.value,
                                                    })}
                                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                >
                                                    <option value="">-- Chọn giới tính --</option>
                                                    <option value="male">Nam</option>
                                                    <option value="female">Nữ</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Email</label>
                                                <input
                                                    type="email"
                                                    value={user.email}
                                                    onChange={handleProfileChange("email")}
                                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                />
                                                {errors.email && (
                                                    <p className="text-sm font-semibold text-rose-600 mt-1">
                                                        {errors.email}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Số điện thoại</label>
                                                <input
                                                    type="text"
                                                    value={user.phone}
                                                    onChange={handleProfileChange("phone")}
                                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                />
                                                {errors.phone && (
                                                    <p className="text-sm font-semibold text-rose-600 mt-1">
                                                        {errors.phone}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Địa chỉ</label>
                                                <div className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm text-slate-700">{user.address || "Chưa có địa chỉ giao hàng"}</div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveTab("shipping")}
                                                            className="ml-4 inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:underline"
                                                        >
                                                            Chỉnh sửa địa chỉ
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={handleUpdateProfile}
                                                disabled={!hasProfileChanged()}
                                                className="flex-1 bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-500 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-600"
                                            >
                                                Cập nhật thông tin
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="flex-1 border border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition"
                                            >
                                                Hủy
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-900 mb-4">Thống kê đơn hàng</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                                <div className="text-blue-600 text-lg font-bold">{orderStats.totalOrders}</div>
                                                <div className="text-slate-600">Tổng đơn hàng</div>
                                            </div>
                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                                <div className="text-amber-600 text-lg font-bold">{orderStats.inProgressOrders}</div>
                                                <div className="text-slate-600">Đơn đang xử lý</div>
                                            </div>
                                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                                <div className="text-emerald-600 text-lg font-bold">{orderStats.deliveredOrders}</div>
                                                <div className="text-slate-600">Đơn đã giao</div>
                                            </div>
                                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                                <div className="text-purple-600 text-lg font-bold">{orderStats.totalSpent.toLocaleString()} VNĐ</div>
                                                <div className="text-slate-600">Tổng chi tiêu</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "shipping" && (
                                <ShippingInfo onAddressUpdated={handleShippingUpdated} />
                            )}
{/* 
                            {activeTab === "orders" && (
                                <OrderHistory
                                    title="Đơn hàng của bạn"
                                    orders={orders}
                                    tabs={IN_PROGRESS_TABS}
                                    statusMeta={STATUS_META}
                                    defaultTab="pending"
                                    loading={ordersLoading}
                                    onViewOrder={handleViewOrder}
                                    onCancelOrder={handleCancelOrder}
                                    formatDate={formatDisplayDate}
                                />
                            )} */}

                            {activeTab === "history" && (
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
                            )}

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
                                                            <span className="font-medium text-slate-800">{item.product_id.name}</span>
                                                            <span className="text-sm text-slate-700">
                                                                {item.quantity} x {item.product_id.price.toLocaleString()} VNĐ
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="flex justify-between items-center mt-4">
                                                <p className="text-xl font-medium text-slate-500">Tổng tiền:</p>
                                                <p className="text-xl font-bold text-amber-600">{selectedOrder.total_price.toLocaleString()} VNĐ</p>
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
                        </main>
                    </div>
                </div>
            </div>
            <Footer />

            <ScrollToTopButton />
        </>
    );
};

export default UserProfile;
