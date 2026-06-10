import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  FaPlus,
  FaSearch,
  FaTicketAlt,
  FaEdit,
  FaTrashAlt,
  FaToggleOn,
  FaToggleOff,
  FaCalendarAlt,
  FaPercentage,
  FaMoneyBillWave,
  FaShippingFast,
  FaUserGraduate,
  FaHistory,
  FaEye,
  FaCheckCircle,
  FaTimesCircle,
  FaChartBar,
} from "react-icons/fa";
import {
  createVoucher,
  updateVoucher,
  softDeleteVoucher,
  toggleVoucherActive,
  fetchVoucherStats,
  fetchVoucherHistory,
} from "../../services/voucherService";
import axiosInstance from "../../utils/axiosInstance";
import Sidebar from "../../components/Sidebar";
import TopNavigation from "../../components/TopNavigation";
import { fetchUserById as fetchUserByIdRequest } from "../../services/userService";

const VouchersPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [stats, setStats] = useState({
    totalVouchers: 0,
    activeVouchers: 0,
    expiredVouchers: 0,
    claimedVouchers: 0,
    usedVouchers: 0,
    redemptionRate: 0,
    abuseAttempts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    type: "PERCENT",
    value: "",
    maxDiscount: "",
    minOrderValue: "",
    totalQuantity: "",
    usageLimitPerUser: 1,
    startDate: "",
    endDate: "",
    applicableUserLevels: ["standard", "silver", "gold", "vip"],
    applicableProducts: [],
    applicableCategories: [],
    isPublic: true,
    status: "ACTIVE",
    restoreVoucherOnCancel: false,
    restoreOnlyIfCancelledWithinMinutes: 30,
  });

  // History Drawer State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyVoucher, setHistoryVoucher] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Selector choices from DB
  const [productsList, setProductsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);

  const fetchCurrentUser = async () => {
    try {
      const userLocal = JSON.parse(localStorage.getItem("user"));
      if (!userLocal || !userLocal._id) {
        throw new Error("No user found in localStorage");
      }
      const response = await fetchUserByIdRequest(userLocal._id);
      setCurrentUser(response.data);
    } catch (err) {
      console.error("Failed to fetch current user:", err.response?.data || err.message);
      setCurrentUser({
        fullName: "Admin User",
        email: "admin@example.com",
        avatar: "",
      });
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    loadData();
    fetchSupportData();
  }, [page, statusFilter, search]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch stats
      const statsRes = await fetchVoucherStats();
      // Fetch advanced metrics from security monitoring if available
      try {
        const metricsRes = await axiosInstance.get("/api/admin/security/metrics");
        if (metricsRes.data?.voucherMetrics) {
          setStats({
            ...statsRes.data,
            ...metricsRes.data.voucherMetrics,
          });
        } else {
          setStats(statsRes.data);
        }
      } catch (err) {
        setStats(statsRes.data);
      }

      // Fetch all vouchers for Admin
      const allRes = await axiosInstance.get("/api/vouchers/public?admin=true");
      let list = allRes.data || [];

      // Filter by search term
      if (search.trim()) {
        const query = search.toLowerCase();
        list = list.filter(
          (v) =>
            v.code.toLowerCase().includes(query) ||
            v.name.toLowerCase().includes(query)
        );
      }

      // Filter by statusFilter
      if (statusFilter !== "all") {
        list = list.filter((v) => {
          // Compute lifecycleState if not populated by virtual on frontend json
          const state = v.lifecycleState || "ACTIVE";
          return state === statusFilter;
        });
      }

      // Frontend pagination
      const itemsPerPage = 8;
      setTotalPages(Math.ceil(list.length / itemsPerPage) || 1);
      const startIndex = (page - 1) * itemsPerPage;
      const paginatedList = list.slice(startIndex, startIndex + itemsPerPage);

      setVouchers(paginatedList);
    } catch (error) {
      console.error("Error loading vouchers:", error);
      toast.error("Không thể tải danh sách voucher.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportData = async () => {
    try {
      const prodRes = await axiosInstance.get("/api/products");
      // Fallback if structure is paginated
      const prods = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data.products || [];
      setProductsList(prods);

      const catRes = await axiosInstance.get("/api/categories");
      const cats = Array.isArray(catRes.data) ? catRes.data : catRes.data.categories || [];
      setCategoriesList(cats);
    } catch (error) {
      console.error("Error fetching support data:", error);
    }
  };

  // We will load the actual voucher list later. Let's first implement the visual layout and core flow.
  // Let's write the fetch logic for vouchers. If we need to fetch all vouchers for admin, we can fetch from a new endpoint `GET /api/vouchers/admin/list` or just add a query param or route.
  // Let's assume we can fetch all vouchers.
  // Wait, let's write a new method in `voucherService.js` and `voucherController.js` to get all vouchers for admin!
  // Let's double check if we can add a route. Yes, we can! Let's add `GET /` to `voucherRoutes.js` for admin to fetch all vouchers.
  // Wait, let's see. Let's create the file VouchersPage.jsx with complete styling and state.
  
  return (
    <div className="flex h-screen">
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
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-6 space-y-6 text-slate-800 dark:text-slate-100">
            {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FaTicketAlt className="text-amber-500" /> Quản Lý Hệ Thống Voucher
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tạo, cập nhật và theo dõi hiệu năng sử dụng mã giảm giá trên toàn hệ thống.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingVoucher(null);
            setFormData({
              name: "",
              code: "",
              description: "",
              type: "PERCENT",
              value: "",
              maxDiscount: "",
              minOrderValue: "",
              totalQuantity: "",
              usageLimitPerUser: 1,
              startDate: "",
              endDate: "",
              applicableUserLevels: ["standard", "silver", "gold", "vip"],
              applicableProducts: [],
              applicableCategories: [],
              isPublic: true,
              status: "ACTIVE",
              restoreVoucherOnCancel: false,
              restoreOnlyIfCancelledWithinMinutes: 30,
            });
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm cursor-pointer"
        >
          <FaPlus size={14} /> Thêm Voucher Mới
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: "Tổng Voucher", value: stats.totalVouchers, icon: FaTicketAlt, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
          { label: "Đang Hoạt Động", value: stats.activeVouchers, icon: FaCheckCircle, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "Hết Hạn/Tắt", value: stats.expiredVouchers, icon: FaTimesCircle, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30" },
          { label: "Đã Nhận (Claim)", value: stats.claimedVouchers, icon: FaEye, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
          { label: "Đã Dùng (Used)", value: stats.usedVouchers, icon: FaCheckCircle, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
          { label: "Lượt Spam Chặn", value: stats.abuseAttempts || 0, icon: FaChartBar, color: "text-red-600 bg-red-50 dark:bg-red-950/30" },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-white dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">{item.label}</span>
                <span className={`p-1.5 rounded-lg ${item.color}`}><Icon size={14} /></span>
              </div>
              <span className="text-xl font-bold mt-2 text-slate-900 dark:text-white">{item.value}</span>
            </div>
          );
        })}
      </div>

      {/* Advanced Metrics banner */}
      <div className="bg-white dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-xl">
            <FaChartBar size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Chỉ Số Hiệu Suất Hoạt Động (Redemption Rate)</h3>
            <p className="text-xs text-slate-500">Tỷ lệ sử dụng voucher = (Đã dùng / Đã nhận) x 100%</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-2xl font-bold text-amber-600">
              {stats.claimedVouchers > 0 ? Math.round((stats.usedVouchers / stats.claimedVouchers) * 100) : 0}%
            </div>
            <div className="text-xs text-slate-500">Tỷ lệ quy đổi</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm rounded-2xl">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <FaSearch size={14} />
          </span>
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { key: "all", label: "Tất cả" },
            { key: "ACTIVE", label: "Hoạt động" },
            { key: "DISABLED", label: "Vô hiệu" },
            { key: "EXPIRED", label: "Hết hạn" },
            { key: "DRAFT", label: "Bản nháp" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab.key
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 shadow-sm rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                <th className="p-4">Thông tin Voucher</th>
                <th className="p-4">Loại & Giá trị</th>
                <th className="p-4">Số lượng (Đã nhận/Tổng)</th>
                <th className="p-4">Thời gian hiệu lực</th>
                <th className="p-4">Trạng thái vận hành</th>
                <th className="p-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" /><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded mt-2" /></td>
                    <td className="p-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="p-4"><div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
                    <td className="p-4"><div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg mx-auto" /></td>
                  </tr>
                ))
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">
                    Không tìm thấy voucher nào phù hợp.
                  </td>
                </tr>
              ) : (
                vouchers.map((voucher) => {
                  const state = voucher.lifecycleState || "ACTIVE";
                  const stateBadges = {
                    ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30",
                    DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-400 border-slate-200 dark:border-slate-700",
                    SCHEDULED: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30",
                    OUT_OF_STOCK: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30",
                    EXPIRED: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-100 dark:border-rose-900/30",
                    DISABLED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
                  };
                  const stateTexts = {
                    ACTIVE: "Đang hoạt động",
                    DRAFT: "Bản nháp",
                    SCHEDULED: "Lên lịch",
                    OUT_OF_STOCK: "Hết lượt",
                    EXPIRED: "Hết hạn",
                    DISABLED: "Vô hiệu hóa",
                  };

                  return (
                    <tr key={voucher._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded text-xs border border-amber-100 dark:border-amber-900/30 tracking-wider font-mono">
                            {voucher.code}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-semibold">{voucher.name}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                          {voucher.type === "PERCENT" && <><FaPercentage className="text-slate-400" /> {voucher.value}%</>}
                          {voucher.type === "FIXED" && <><FaMoneyBillWave className="text-slate-400" /> {voucher.value.toLocaleString()}đ</>}
                          {voucher.type === "FREESHIP" && <><FaShippingFast className="text-slate-400" /> FreeShip {voucher.value.toLocaleString()}đ</>}
                        </div>
                        {voucher.type === "PERCENT" && voucher.maxDiscount && (
                          <div className="text-xs text-slate-400 mt-0.5">Tối đa {voucher.maxDiscount.toLocaleString()}đ</div>
                        )}
                        {voucher.minOrderValue > 0 && (
                          <div className="text-[11px] text-slate-400 font-medium">Đơn tối thiểu: {voucher.minOrderValue.toLocaleString()}đ</div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {voucher.claimedCount} / {voucher.totalQuantity}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Đã dùng: {voucher.usedCount}</div>
                      </td>
                      <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1"><FaCalendarAlt /> Bắt đầu: {new Date(voucher.startDate).toLocaleDateString("vi-VN")}</div>
                        <div className="flex items-center gap-1 mt-1"><FaCalendarAlt /> Kết thúc: {new Date(voucher.endDate).toLocaleDateString("vi-VN")}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${stateBadges[state]}`}>
                          {stateTexts[state]}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingVoucher(voucher);
                              setFormData({
                                ...voucher,
                                startDate: voucher.startDate ? new Date(voucher.startDate).toISOString().split("T")[0] : "",
                                endDate: voucher.endDate ? new Date(voucher.endDate).toISOString().split("T")[0] : "",
                              });
                              setIsModalOpen(true);
                            }}
                            title="Sửa"
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition cursor-pointer"
                          >
                            <FaEdit size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              const isActive = voucher.status === "ACTIVE";
                              try {
                                await toggleVoucherActive(voucher._id, !isActive);
                                toast.success(`Đã ${!isActive ? "kích hoạt" : "vô hiệu hóa"} voucher thành công!`);
                                loadData();
                              } catch (err) {
                                toast.error("Không thể thay đổi trạng thái hoạt động.");
                              }
                            }}
                            title={voucher.status === "ACTIVE" ? "Tắt" : "Bật"}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              voucher.status === "ACTIVE" ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                          >
                            {voucher.status === "ACTIVE" ? <FaToggleOn size={16} /> : <FaToggleOff size={16} />}
                          </button>
                          <button
                            onClick={() => handleOpenHistory(voucher)}
                            title="Lịch sử dùng"
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600 rounded-lg transition cursor-pointer"
                          >
                            <FaHistory size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Bạn có chắc chắn muốn xóa voucher ${voucher.code}?`)) return;
                              try {
                                await softDeleteVoucher(voucher._id);
                                toast.success("Đã xóa voucher thành công!");
                                loadData();
                              } catch (err) {
                                toast.error("Xóa voucher thất bại.");
                              }
                            }}
                            title="Xóa"
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 rounded-lg transition cursor-pointer"
                          >
                            <FaTrashAlt size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-xs">
            <span className="text-slate-500">Trang {page} / {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-semibold cursor-pointer"
              >
                Trước
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-semibold cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Creation/Editing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FaTicketAlt className="text-amber-500" /> {editingVoucher ? "Chỉnh Sửa Voucher" : "Tạo Mới Voucher"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Tên Voucher *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: Giảm Giá Chào Mừng"
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Code */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Mã Code * (Viết liền, không dấu)</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingVoucher}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                    placeholder="Ví dụ: WELCOME50"
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-semibold tracking-wider disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase text-slate-500">Mô Tả Chi Tiết</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả các điều kiện áp dụng của voucher..."
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Loại Giảm Giá *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="PERCENT">Giảm Theo Phần Trăm (%)</option>
                    <option value="FIXED">Giảm Số Tiền Cố Định (đ)</option>
                    <option value="FREESHIP">Miễn Phí Vận Chuyển (đ)</option>
                  </select>
                </div>

                {/* Value */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Giá Trị Giảm * {formData.type === "PERCENT" ? "(%)" : "(đ)"}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={formData.type === "PERCENT" ? "100" : undefined}
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || "" })}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Max Discount */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    Giảm Giá Tối Đa {formData.type === "PERCENT" ? "(Bắt buộc)" : "(Không áp dụng)"}
                  </label>
                  <input
                    type="number"
                    disabled={formData.type !== "PERCENT"}
                    value={formData.maxDiscount || ""}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: parseFloat(e.target.value) || null })}
                    placeholder="Không giới hạn"
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Min Order Value */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Giá Trị Đơn Hàng Tối Thiểu (đ)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData({ ...formData, minOrderValue: parseFloat(e.target.value) || 0 })}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Total Quantity */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Tổng Số Lượt Phát Hành *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.totalQuantity}
                    onChange={(e) => setFormData({ ...formData, totalQuantity: parseInt(e.target.value) || "" })}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Usage Limit Per User */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Lượt Nhận Tối Đa Mỗi User *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.usageLimitPerUser}
                    onChange={(e) => setFormData({ ...formData, usageLimitPerUser: parseInt(e.target.value) || 1 })}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Ngày Bắt Đầu *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* End Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Ngày Kết Thúc *</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* User Levels */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
                  <FaUserGraduate /> Áp Dụng Theo Hạng Thành Viên
                </label>
                <div className="flex flex-wrap gap-4 p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900">
                  {["standard", "silver", "gold", "vip"].map((lvl) => (
                    <label key={lvl} className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.applicableUserLevels.includes(lvl)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...formData.applicableUserLevels, lvl]
                            : formData.applicableUserLevels.filter((x) => x !== lvl);
                          setFormData({ ...formData, applicableUserLevels: next });
                        }}
                        className="accent-amber-600 rounded"
                      />
                      {lvl === "standard" ? "Đồng" : lvl === "silver" ? "Bạc" : lvl === "gold" ? "Vàng" : "VIP"}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Applicable Products */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Giới Hạn Sản Phẩm Áp Dụng (Tuỳ chọn)</label>
                  <select
                    multiple
                    value={formData.applicableProducts}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                      setFormData({ ...formData, applicableProducts: selected });
                    }}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none h-24"
                  >
                    {productsList.map((p) => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400">Giữ Ctrl (hoặc Cmd) để chọn nhiều sản phẩm.</span>
                </div>

                {/* Applicable Categories */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500">Giới Hạn Danh Mục Áp Dụng (Tuỳ chọn)</label>
                  <select
                    multiple
                    value={formData.applicableCategories}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                      setFormData({ ...formData, applicableCategories: selected });
                    }}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none h-24"
                  >
                    {categoriesList.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400">Giữ Ctrl (hoặc Cmd) để chọn nhiều danh mục.</span>
                </div>
              </div>

              {/* Restore Policy on Cancel */}
              <div className="p-4 border border-amber-100 dark:border-amber-950/20 bg-amber-50/20 dark:bg-amber-950/5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Chính Sách Hoàn Voucher Khi Hủy Đơn</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Tự động trả lại voucher cho người dùng khi đơn hàng bị huỷ.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.restoreVoucherOnCancel}
                    onChange={(e) => setFormData({ ...formData, restoreVoucherOnCancel: e.target.checked })}
                    className="accent-amber-600 w-5 h-5 cursor-pointer"
                  />
                </div>

                {formData.restoreVoucherOnCancel && (
                  <div className="flex items-center gap-3 animate-fadeIn">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Thời gian giới hạn huỷ đơn được hoàn lại (Phút):</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.restoreOnlyIfCancelledWithinMinutes}
                      onChange={(e) => setFormData({ ...formData, restoreOnlyIfCancelledWithinMinutes: parseInt(e.target.value) || 30 })}
                      className="p-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm w-20 text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Status and Visibility Options */}
              <div className="grid grid-cols-3 gap-4 p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="accent-amber-600 rounded"
                  />
                  Công khai tại Center
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="modal_status"
                    checked={formData.status === "ACTIVE"}
                    onChange={() => setFormData({ ...formData, status: "ACTIVE" })}
                    className="accent-amber-600"
                  />
                  Kích hoạt ngay
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="modal_status"
                    checked={formData.status === "DRAFT"}
                    onChange={() => setFormData({ ...formData, status: "DRAFT" })}
                    className="accent-amber-600"
                  />
                  Lưu nháp
                </label>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 bg-white dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Drawer Modal */}
      {isHistoryOpen && historyVoucher && (
        <div className="fixed inset-y-0 right-0 z-[1000] w-full max-w-lg bg-white dark:bg-slate-800 shadow-2xl flex flex-col border-l border-slate-100 dark:border-slate-700 animate-slideLeft">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FaHistory className="text-amber-500" /> Lịch Sử Sử Dụng
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Chi tiết lượt săn và sử dụng mã: <span className="font-mono font-bold text-amber-600">{historyVoucher.code}</span>
              </p>
            </div>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              &times;
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {historyLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="animate-pulse bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700 rounded-2xl flex flex-col gap-2">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))
            ) : historyList.length === 0 ? (
              <div className="text-center p-8 text-slate-400">Chưa có ai nhận hoặc sử dụng voucher này.</div>
            ) : (
              historyList.map((item) => (
                <div key={item._id} className="bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.userId?.fullName || "Khách hàng ẩn"}</span>
                    <span className="text-[10px] text-slate-500 font-mono tracking-wider">Index #{item.claimIndex}</span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Email: {item.userId?.email}</div>
                    <div>Hạng User: {item.userId?.level === "standard" ? "Đồng" : item.userId?.level === "silver" ? "Bạc" : item.userId?.level === "gold" ? "Vàng" : item.userId?.level === "vip" ? "VIP" : item.userId?.level || "Đồng"}</div>
                    <div className="flex items-center gap-1 mt-1"><FaCalendarAlt /> Ngày nhận: {new Date(item.claimedAt).toLocaleString("vi-VN")}</div>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center text-xs">
                    <span className="font-semibold">Trạng thái:</span>
                    <span className={`px-2 py-0.5 rounded font-semibold border ${
                      item.isUsed
                        ? "bg-rose-50 text-rose-700 border-rose-100"
                        : "bg-emerald-50 text-emerald-700 border-emerald-100"
                    }`}>
                      {item.isUsed ? "Đã Sử Dụng" : "Chưa Sử Dụng"}
                    </span>
                  </div>
                  {item.isUsed && item.usedAt && (
                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div>Thời gian dùng: {new Date(item.usedAt).toLocaleString("vi-VN")}</div>
                      {item.orderId && <div>Mã đơn hàng: #{String(item.orderId).slice(-6).toUpperCase()}</div>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Drawer Pagination */}
          {!historyLoading && historyTotalPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center text-xs">
              <span className="text-slate-500">Trang {historyPage} / {historyTotalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={historyPage === 1}
                  onClick={() => handleHistoryPageChange(historyPage - 1)}
                  className="px-2 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-100 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  disabled={historyPage === historyTotalPages}
                  onClick={() => handleHistoryPageChange(historyPage + 1)}
                  className="px-2 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-100 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}
          </div>
        </main>
      </div>
    </div>
  );

  // Form Submit Handler
  async function handleSubmit(e) {
    e.preventDefault();
    // Validate value
    if (formData.type === "PERCENT" && formData.value > 100) {
      return toast.error("Phần trăm giảm giá không được vượt quá 100%.");
    }
    if (formData.startDate > formData.endDate) {
      return toast.error("Ngày kết thúc phải lớn hơn ngày bắt đầu.");
    }

    try {
      if (editingVoucher) {
        await updateVoucher(editingVoucher._id, formData);
        toast.success("Cập nhật thông tin voucher thành công!");
      } else {
        await createVoucher(formData);
        toast.success("Đã tạo mới voucher thành công!");
      }
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Lưu voucher thất bại. Vui lòng thử lại.");
    }
  }

  // History Drawer Handler
  async function handleOpenHistory(voucher) {
    setHistoryVoucher(voucher);
    setHistoryList([]);
    setHistoryPage(1);
    setIsHistoryOpen(true);
    fetchHistory(voucher._id, 1);
  }

  async function fetchHistory(voucherId, pageNum) {
    try {
      setHistoryLoading(true);
      const res = await fetchVoucherHistory(voucherId, pageNum, 5);
      setHistoryList(res.data.history || []);
      setHistoryTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải lịch sử sử dụng.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleHistoryPageChange(nextPage) {
    setHistoryPage(nextPage);
    fetchHistory(historyVoucher._id, nextPage);
  }
};

export default VouchersPage;
