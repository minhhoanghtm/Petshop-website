import { useEffect, useState } from "react";
import {
    FaUser,
    FaHistory,
    FaEdit,
    FaSignOutAlt,
    FaMapMarkerAlt,
    FaTicketAlt,
    FaCrown,
} from "react-icons/fa";
import { useNavigate, useLocation, Outlet, NavLink } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import LoadingOverlay from "../../components/LoadingOverlay";
import { toast } from "react-toastify";
import ScrollToTopButton from "../../components/ScrollToTopButton";

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
import { createMomoPayment, createVNPayPayment } from "../../services/paymentService";
import { isValidPhone, isValidGmailAddress } from "../../utils/validation";

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
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    const [orderStats, setOrderStats] = useState({
        totalOrders: 0,
        inProgressOrders: 0,
        deliveredOrders: 0,
        totalSpent: 0,
    });
    
    const [errors, setErrors] = useState({});

    const formatDate = (dateString) => {
        if (!dateString) return "";
        
        let date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return "";
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        
        if (year < 1900 || year > new Date().getFullYear() + 1) {
            return "";
        }
        
        return `${year}-${month}-${day}`;
    };

    const formatDisplayDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return "";

        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();

        return `${hours}:${minutes} ${day}/${month}/${year}`;
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
            const userOrders = Array.isArray(response.data)
                ? response.data
                : (response.data?.orders || []);

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
        const method = String(order.payment_method || "").trim().toUpperCase();
        if (method === "MOMO" || method === "VNPAY") {
            const isMomo = method === "MOMO";
            const providerName = isMomo ? "MoMo" : "VNPay";
            try {
                const loadingToastId = toast.loading(`Đang tạo link thanh toán ${providerName}...`);
                const response = isMomo 
                    ? await createMomoPayment(order._id)
                    : await createVNPayPayment(order._id);
                
                const payUrl = response?.data?.payUrl || response?.data?.paymentUrl;
                if (payUrl) {
                    toast.update(loadingToastId, {
                        render: `Đang chuyển hướng sang ${providerName}...`,
                        type: "success",
                        isLoading: false,
                        autoClose: 2000,
                    });
                    setTimeout(() => {
                        window.location.href = payUrl;
                    }, 1000);
                } else {
                    throw new Error(`Không nhận được URL thanh toán từ ${providerName}.`);
                }
            } catch (error) {
                console.error(`Lỗi khi thanh toán ${providerName}:`, error);
                toast.error(
                    error.response?.data?.message ||
                    `Không thể tạo liên kết thanh toán ${providerName}. Vui lòng thử lại sau!`
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
                                <div className="mt-2.5">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm ${
                                        user.level === "silver" ? "bg-slate-50 text-slate-600 border-slate-200" :
                                        user.level === "gold" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                        user.level === "vip" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                        "bg-orange-50/80 text-orange-700 border-orange-200/80"
                                    }`}>
                                        <FaCrown className={
                                            user.level === "silver" ? "text-slate-400" :
                                            user.level === "gold" ? "text-amber-500" :
                                            user.level === "vip" ? "text-purple-500" :
                                            "text-orange-500"
                                        } />
                                        {user.level === "silver" ? "Hạng Bạc" :
                                         user.level === "gold" ? "Hạng Vàng" :
                                         user.level === "vip" ? "Hạng VIP" :
                                         "Hạng Đồng"}
                                    </span>
                                </div>
                            </div>

                            <ul className="mt-6 space-y-2 w-full max-w-md mx-auto lg:max-w-none lg:mx-0">
                                {[
                                    { key: "profile", label: "Thông tin cá nhân", icon: FaUser, path: "/userProfile", end: true },
                                    { key: "shipping", label: "Thông tin giao hàng", icon: FaMapMarkerAlt, path: "/userProfile/shipping" },
                                    { key: "history", label: "Lịch sử mua hàng", icon: FaHistory, path: "/userProfile/history" },
                                    { key: "vouchers", label: "Kho Voucher", icon: FaTicketAlt, path: "/userProfile/vouchers" },
                                ].map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <li key={item.key}>
                                            <NavLink
                                                to={item.path}
                                                end={item.end}
                                                className={({ isActive }) =>
                                                    `w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${isActive
                                                        ? "bg-amber-50 text-amber-700"
                                                        : "text-slate-600 hover:bg-amber-50"
                                                        }`
                                                }
                                            >
                                                <Icon />
                                                {item.label}
                                            </NavLink>
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
                            <Outlet context={{
                                user,
                                setUser,
                                initialUser,
                                setInitialUser,
                                orders,
                                setOrders,
                                loading,
                                ordersLoading,
                                orderStats,
                                errors,
                                setErrors,
                                handleProfileChange,
                                validateProfile,
                                hasProfileChanged,
                                handleCancelEdit,
                                handleUpdateProfile,
                                formatDate,
                                formatDisplayDate,
                                handleCancelOrder,
                                handlePayNow,
                                hanldeGenerateInvoice,
                                handleShippingUpdated,
                                STATUS_META,
                                ORDER_TABS,
                            }} />
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
