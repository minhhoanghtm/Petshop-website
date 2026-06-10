import { useOutletContext, useNavigate } from "react-router-dom";

const ProfileTab = () => {
    const {
        user,
        setUser,
        errors,
        handleProfileChange,
        formatDate,
        handleUpdateProfile,
        hasProfileChanged,
        handleCancelEdit,
        orderStats,
    } = useOutletContext();
    const navigate = useNavigate();

    return (
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
                            value={user.fullName || ""}
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
                            value={user.email || ""}
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
                            value={user.phone || ""}
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
                        <label className="text-sm font-medium text-slate-600">Hạng thành viên</label>
                        <div className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-800 flex items-center justify-between">
                            <span className="font-semibold text-slate-700">
                                {user.level === "silver" ? "Thành viên Bạc" :
                                 user.level === "gold" ? "Thành viên Vàng" :
                                 user.level === "vip" ? "Thành viên VIP" :
                                 "Thành viên Đồng"}
                            </span>
                            <span className="text-xs text-slate-400 font-medium select-none">Hạng tài khoản</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600">Địa chỉ</label>
                        <div className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-700">{user.address || "Chưa có địa chỉ giao hàng"}</div>
                                <button
                                    type="button"
                                    onClick={() => navigate("/userProfile/shipping")}
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
    );
};

export default ProfileTab;
