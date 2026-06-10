import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import TopNavigation from "../../components/TopNavigation";
import LoadingSpinner from "../../components/LoadingSpinner";
import { toast } from "react-toastify";
import { FaUser, FaLock, FaEdit, FaSave, FaCrown, FaCalendar, FaPhone, FaEnvelope } from "react-icons/fa";
import {
    fetchProfile as fetchProfileRequest,
    updateProfile as updateProfileRequest,
    changePassword as changePasswordRequest
} from "../../services/userService";
import { isValidPhone } from "../../utils/validation";

const AdminProfile = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const fileInputRef = useRef(null);

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        fullName: "",
        email: "",
        phone: "",
        birthDate: "",
        gender: "",
        avatar: "",
    });

    // Password form state
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    const [profileErrors, setProfileErrors] = useState({});
    const [passwordErrors, setPasswordErrors] = useState({});

    const convertBase64ToImage = (value) => {
        if (!value) return "/avatar.png";
        if (typeof value !== "string") return "/avatar.png";
        if (value.startsWith("data:image")) return value;
        if (value.startsWith("/") || value.startsWith("http")) return value;
        return `data:image/jpeg;base64,${value}`;
    };

    const formatDateForInput = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const fetchProfileData = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetchProfileRequest();
            const userData = res.data;
            setCurrentUser(userData);
            setProfileForm({
                fullName: userData.fullName || "",
                email: userData.email || "",
                phone: userData.phone || "",
                birthDate: formatDateForInput(userData.birthDate),
                gender: userData.gender || "",
                avatar: convertBase64ToImage(userData.avatar),
            });
        } catch (err) {
            console.error("Lỗi khi tải thông tin cá nhân admin:", err);
            toast.error("Không thể tải thông tin cá nhân.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

    const handleProfileInputChange = (field) => (e) => {
        setProfileForm((prev) => ({ ...prev, [field]: e.target.value }));
        setProfileErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleAvatarClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Kích thước file ảnh không được vượt quá 2MB!");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProfileForm((prev) => ({ ...prev, avatar: reader.result }));
        };
        reader.onerror = () => {
            toast.error("Đọc file ảnh thất bại!");
        };
        reader.readAsDataURL(file);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        const errors = {};

        if (!profileForm.fullName.trim()) {
            errors.fullName = "Họ và tên không được để trống.";
        }
        if (profileForm.phone && !isValidPhone(profileForm.phone)) {
            errors.phone = "Số điện thoại phải có đúng 10 chữ số.";
        }

        if (Object.keys(errors).length > 0) {
            setProfileErrors(errors);
            return;
        }

        try {
            setIsSavingProfile(true);
            const payload = {
                fullName: profileForm.fullName,
                phone: profileForm.phone,
                birthDate: profileForm.birthDate,
                gender: profileForm.gender,
            };

            // Nếu người dùng tải avatar mới (chuỗi base64 chứa "data:image")
            if (profileForm.avatar && profileForm.avatar.startsWith("data:image")) {
                payload.avatar = profileForm.avatar.split(",")[1];
            }

            const res = await updateProfileRequest(payload);
            const updatedUser = res.data;
            
            // Cập nhật thông tin trong LocalStorage
            const storedUser = JSON.parse(localStorage.getItem("user")) || {};
            localStorage.setItem(
                "user",
                JSON.stringify({
                    ...storedUser,
                    fullName: updatedUser.fullName,
                    avatar: convertBase64ToImage(updatedUser.avatar),
                })
            );

            setCurrentUser(updatedUser);
            toast.success("Cập nhật thông tin cá nhân thành công!");
            
            // Reload page hoặc tải lại dữ liệu để đồng nhất
            fetchProfileData();
        } catch (err) {
            console.error("Lỗi cập nhật profile admin:", err);
            toast.error(err.response?.data?.message || "Cập nhật thông tin thất bại!");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handlePasswordInputChange = (field) => (e) => {
        setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));
        setPasswordErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        const errors = {};

        if (!passwordForm.currentPassword) {
            errors.currentPassword = "Mật khẩu hiện tại không được để trống.";
        }
        if (!passwordForm.newPassword) {
            errors.newPassword = "Mật khẩu mới không được để trống.";
        } else if (passwordForm.newPassword.length < 6) {
            errors.newPassword = "Mật khẩu mới phải có tối thiểu 6 ký tự.";
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            errors.confirmPassword = "Xác nhận mật khẩu mới không khớp.";
        }

        if (Object.keys(errors).length > 0) {
            setPasswordErrors(errors);
            return;
        }

        try {
            setIsChangingPassword(true);
            await changePasswordRequest({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            });

            toast.success("Đổi mật khẩu thành công!");
            setPasswordForm({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
        } catch (err) {
            console.error("Lỗi đổi mật khẩu admin:", err);
            toast.error(err.response?.data?.message || "Mật khẩu hiện tại không đúng.");
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                currentUser={currentUser}
            />
            {mobileSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}
            <div className="flex-1 flex flex-col overflow-hidden">
                <TopNavigation
                    setMobileSidebarOpen={setMobileSidebarOpen}
                    currentUser={currentUser}
                />
                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Page Title */}
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <FaUser className="text-amber-500" /> Quản lý tài khoản
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">
                                Cập nhật thông tin cá nhân và thay đổi mật khẩu của bạn
                            </p>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center items-center py-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xs">
                                <LoadingSpinner size="large" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Left Card: Avatar & Overview */}
                                <div className="md:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center text-center">
                                    <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                                        <img
                                            src={profileForm.avatar}
                                            alt="Admin Avatar"
                                            className="w-32 h-32 rounded-full object-cover ring-4 ring-amber-100 dark:ring-slate-700 group-hover:opacity-85 transition"
                                        />
                                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                            <FaEdit className="text-white text-lg" />
                                        </div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mt-4">
                                        {profileForm.fullName || "Admin"}
                                    </h3>
                                    <p className="text-sm text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-1">
                                        <FaEnvelope /> {profileForm.email}
                                    </p>
                                    
                                    <div className="mt-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                        <FaCrown />
                                        {currentUser?.role === "superadmin" ? "Super Admin" : "Quản trị viên"}
                                    </div>
                                    
                                    <p className="text-xs text-slate-400 mt-6 leading-relaxed">
                                        Ảnh đại diện hỗ trợ định dạng PNG, JPG, JPEG. Kích thước tối đa 2MB. Click vào ảnh để thay đổi.
                                    </p>
                                </div>

                                {/* Right Card: Form inputs */}
                                <div className="md:col-span-2 space-y-6">
                                    {/* Personal Info Form */}
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                            Thông tin cá nhân
                                        </h3>
                                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Họ và tên</label>
                                                    <input
                                                        type="text"
                                                        value={profileForm.fullName}
                                                        onChange={handleProfileInputChange("fullName")}
                                                        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                    />
                                                    {profileErrors.fullName && (
                                                        <p className="text-xs font-semibold text-rose-600 mt-1">
                                                            {profileErrors.fullName}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Email (Không thể sửa)</label>
                                                    <input
                                                        type="email"
                                                        value={profileForm.email}
                                                        disabled
                                                        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-slate-400 cursor-not-allowed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Số điện thoại</label>
                                                    <input
                                                        type="text"
                                                        value={profileForm.phone}
                                                        onChange={handleProfileInputChange("phone")}
                                                        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                    />
                                                    {profileErrors.phone && (
                                                        <p className="text-xs font-semibold text-rose-600 mt-1">
                                                            {profileErrors.phone}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Ngày sinh</label>
                                                    <input
                                                        type="date"
                                                        value={profileForm.birthDate}
                                                        onChange={handleProfileInputChange("birthDate")}
                                                        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Giới tính</label>
                                                    <select
                                                        value={profileForm.gender}
                                                        onChange={handleProfileInputChange("gender")}
                                                        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                    >
                                                        <option value="">-- Chọn giới tính --</option>
                                                        <option value="male">Nam</option>
                                                        <option value="female">Nữ</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={isSavingProfile}
                                                    className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-amber-500 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                                                >
                                                    <FaSave /> {isSavingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                                                </button>
                                            </div>
                                        </form>
                                    </div>

                                    {/* Password Form */}
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                            Thay đổi mật khẩu
                                        </h3>
                                        <form onSubmit={handleChangePassword} className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Mật khẩu hiện tại</label>
                                                    <input
                                                        type="password"
                                                        value={passwordForm.currentPassword}
                                                        onChange={handlePasswordInputChange("currentPassword")}
                                                        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                    />
                                                    {passwordErrors.currentPassword && (
                                                        <p className="text-xs font-semibold text-rose-600 mt-1">
                                                            {passwordErrors.currentPassword}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Mật khẩu mới</label>
                                                    <input
                                                        type="password"
                                                        value={passwordForm.newPassword}
                                                        onChange={handlePasswordInputChange("newPassword")}
                                                        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                    />
                                                    {passwordErrors.newPassword && (
                                                        <p className="text-xs font-semibold text-rose-600 mt-1">
                                                            {passwordErrors.newPassword}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Xác nhận mật khẩu mới</label>
                                                    <input
                                                        type="password"
                                                        value={passwordForm.confirmPassword}
                                                        onChange={handlePasswordInputChange("confirmPassword")}
                                                        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                                    />
                                                    {passwordErrors.confirmPassword && (
                                                        <p className="text-xs font-semibold text-rose-600 mt-1">
                                                            {passwordErrors.confirmPassword}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={isChangingPassword}
                                                    className="bg-slate-700 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-600 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                                                >
                                                    <FaLock /> {isChangingPassword ? "Đang xử lý..." : "Đổi mật khẩu"}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminProfile;
