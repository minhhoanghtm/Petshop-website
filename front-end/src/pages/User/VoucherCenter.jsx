import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  FaTicketAlt,
  FaPercentage,
  FaMoneyBillWave,
  FaShippingFast,
  FaCalendarAlt,
  FaInfoCircle,
} from "react-icons/fa";
import { fetchPublicVouchers, claimVoucher } from "../../services/voucherService";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import ScrollToTopButton from "../../components/ScrollToTopButton";

const LEVEL_MAP = {
  standard: "Đồng",
  silver: "Bạc",
  gold: "Vàng",
  vip: "VIP",
};

const VoucherCenter = () => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [claimLoadingId, setClaimLoadingId] = useState(null);
  const [selectedVoucherDetails, setSelectedVoucherDetails] = useState(null);

  // For checking if user is logged in
  const isLoggedIn = !!localStorage.getItem("accessToken");

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      const res = await fetchPublicVouchers();
      // Ensure list is sorted so active is first
      setVouchers(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách voucher khuyến mãi.");
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (voucherId) => {
    if (!isLoggedIn) {
      toast.warning("Vui lòng đăng nhập để nhận voucher này!");
      return;
    }

    try {
      setClaimLoadingId(voucherId);
      const res = await claimVoucher(voucherId);
      toast.success(res.data.message || "Nhận voucher thành công!");
      // Reload list to update claim status/counts
      await loadVouchers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Nhận voucher thất bại. Vui lòng thử lại.");
    } finally {
      setClaimLoadingId(null);
    }
  };

  const filteredVouchers = vouchers.filter((v) => {
    if (filterType === "all") return true;
    return v.type === filterType.toUpperCase();
  });

  return (
    <>
      <Header />
      <div className="bg-slate-50 dark:bg-slate-900 min-h-screen py-8 text-slate-800 dark:text-slate-100">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 space-y-8">
          {/* Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl p-8 md:p-12 text-white shadow-lg">
            <div className="relative z-10 space-y-3 max-w-xl">
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Voucher Center
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Săn Khuyến Mãi Ngập Tràn
              </h1>
              <p className="text-white/80 text-sm md:text-base leading-relaxed">
                Nhận các mã giảm giá, miễn phí vận chuyển siêu hấp dẫn để mua sắm phụ kiện, thức ăn tốt nhất cho thú cưng của bạn.
              </p>
            </div>
            {/* Background pattern */}
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-1/4 translate-x-1/4">
              <FaTicketAlt size={400} />
            </div>
          </div>

          {/* Filter Tab bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm rounded-2xl">
            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
              {[
                { key: "all", label: "Tất cả mã" },
                { key: "percent", label: "Giảm %" },
                { key: "fixed", label: "Giảm tiền mặt" },
                { key: "freeship", label: "Miễn phí vận chuyển" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterType(tab.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    filterType === tab.key
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-400 font-semibold hidden md:block">
              Tìm thấy {filteredVouchers.length} voucher khả dụng
            </div>
          </div>

          {/* Vouchers Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-40 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 shadow-sm rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filteredVouchers.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 shadow-sm rounded-3xl">
              <FaTicketAlt size={48} className="mx-auto text-slate-300" />
              <h3 className="text-lg font-bold text-slate-600 mt-4">Hiện không có mã nào</h3>
              <p className="text-slate-400 text-xs mt-1">Các mã khuyến mãi mới sẽ sớm được cập nhật. Quay lại sau nhé!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredVouchers.map((v) => {
                const claimStatus = v.userClaimStatus || { claimedCount: 0, isUsed: false, canClaim: true };
                const isOutOfStock = v.claimedCount >= v.totalQuantity;
                const progressPct = Math.round((v.claimedCount / v.totalQuantity) * 100);

                // Setup gradients based on voucher type
                const typeGradients = {
                  PERCENT: "from-orange-500 to-red-500",
                  FIXED: "from-amber-500 to-orange-500",
                  FREESHIP: "from-teal-500 to-emerald-500",
                };
                const gradient = typeGradients[v.type] || "from-amber-500 to-orange-500";

                return (
                  <div
                    key={v._id}
                    className="relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition duration-300 rounded-3xl flex overflow-hidden min-h-40 group"
                  >
                    {/* Left side ticket notch decor */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-slate-50 dark:bg-slate-900 rounded-r-full border-r border-slate-100 dark:border-slate-700/50 z-10" />
                    {/* Right side ticket notch decor */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-slate-50 dark:bg-slate-900 rounded-l-full border-l border-slate-100 dark:border-slate-700/50 z-10" />

                    {/* Badge left (Graphic & type) */}
                    <div className={`w-[30%] bg-gradient-to-br ${gradient} p-4 flex flex-col items-center justify-center text-white relative select-none`}>
                      <span className="absolute top-2 left-4 text-[9px] uppercase tracking-widest opacity-80 font-bold font-mono">
                        {v.code}
                      </span>
                      <div className="bg-white/20 p-2.5 rounded-full mb-2">
                        {v.type === "PERCENT" && <FaPercentage size={20} />}
                        {v.type === "FIXED" && <FaMoneyBillWave size={20} />}
                        {v.type === "FREESHIP" && <FaShippingFast size={20} />}
                      </div>
                      <span className="text-xs font-bold text-center tracking-wide">
                        {v.type === "PERCENT" && `${v.value}% OFF`}
                        {v.type === "FIXED" && `${v.value >= 1000 ? v.value / 1000 + "K" : v.value} OFF`}
                        {v.type === "FREESHIP" && "FREESHIP"}
                      </span>
                    </div>

                    {/* Dotted border divider */}
                    <div className="border-l border-dashed border-slate-200 dark:border-slate-700 h-full relative" />

                    {/* Right content */}
                    <div className="flex-1 p-5 flex flex-col justify-between pl-6 pr-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-slate-800 dark:text-white line-clamp-1 text-sm md:text-base">
                            {v.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {v.description || `Mã giảm giá áp dụng cho các sản phẩm tại hệ thống Pet Station.`}
                        </p>
                        <div className="text-[10px] font-semibold text-slate-400 space-y-1">
                          {v.minOrderValue > 0 && (
                            <div className="flex items-center gap-1">
                              <FaInfoCircle size={10} /> Đơn tối thiểu: {v.minOrderValue.toLocaleString()}đ
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <FaCalendarAlt size={10} /> HSD: {new Date(v.endDate).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", hour12: false })}
                          </div>
                        </div>

                        {/* Applicable products / categories */}
                        <div className="mt-2 text-[10px]">
                          {v.applicableProducts?.length > 0 || v.applicableCategories?.length > 0 ? (
                            <div className="space-y-1 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-100/80 dark:border-slate-800">
                              <div className="font-bold text-slate-600 dark:text-slate-300">Sản phẩm áp dụng:</div>
                              <div className="flex flex-wrap gap-1">
                                {v.applicableCategories?.slice(0, 1).map((c) => (
                                  <span key={c._id} className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-md border border-amber-100 dark:border-amber-900/30 font-medium">
                                    Danh mục: {c.name}
                                  </span>
                                ))}
                                {v.applicableProducts?.slice(0, 2 - (v.applicableCategories?.length > 0 ? 1 : 0)).map((p) => (
                                  <span key={p._id} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-md border border-blue-100 dark:border-blue-900/30 font-medium truncate max-w-[120px]" title={p.name}>
                                    {p.name}
                                  </span>
                                ))}
                                {((v.applicableProducts?.length || 0) + (v.applicableCategories?.length || 0)) > 2 && (
                                  <button
                                    onClick={() => setSelectedVoucherDetails(v)}
                                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-600 font-bold transition cursor-pointer"
                                  >
                                    +{((v.applicableProducts?.length || 0) + (v.applicableCategories?.length || 0)) - 2} Xem thêm
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-semibold italic">
                              Áp dụng cho toàn bộ cửa hàng
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Claim button and progress bar */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                            <span>Đã nhận</span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${gradient} rounded-full`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {claimStatus.claimedCount > 0 && !claimStatus.canClaim ? (
                          <span className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed select-none">
                            Đã nhận hết lượt
                          </span>
                        ) : isOutOfStock ? (
                          <span className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed select-none">
                            Đã Hết Lượt
                          </span>
                        ) : (
                          <button
                            disabled={claimLoadingId === v._id}
                            onClick={() => handleClaim(v._id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition transform active:scale-95 text-white bg-gradient-to-r ${gradient} hover:brightness-105 shadow-sm hover:shadow cursor-pointer disabled:opacity-50`}
                          >
                            {claimLoadingId === v._id ? "Đang lưu..." : "Nhận Ngay"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Footer />
      <ScrollToTopButton />

      {/* Voucher Details Modal */}
      {selectedVoucherDetails && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-xl overflow-hidden flex flex-col my-8 animate-scaleUp">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FaTicketAlt /> Chi Tiết Voucher
              </h3>
              <button
                onClick={() => setSelectedVoucherDetails(null)}
                className="p-1 hover:bg-white/20 text-white rounded-full cursor-pointer transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Voucher Code & Type */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <div>
                  <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold font-mono tracking-wider border border-amber-200/50">
                    {selectedVoucherDetails.code}
                  </span>
                  <h4 className="font-extrabold text-slate-800 dark:text-white text-base mt-2">
                    {selectedVoucherDetails.name}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-amber-600 dark:text-amber-400 font-extrabold text-base">
                    {selectedVoucherDetails.type === "PERCENT" && `${selectedVoucherDetails.value}% OFF`}
                    {selectedVoucherDetails.type === "FIXED" && `${selectedVoucherDetails.value.toLocaleString()}đ OFF`}
                    {selectedVoucherDetails.type === "FREESHIP" && "FREE SHIP"}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-400 uppercase">Mô tả</div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedVoucherDetails.description || "Mã giảm giá mua sắm các sản phẩm tại Pet Station."}
                </p>
              </div>

              {/* Conditions */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                <div className="text-xs font-bold text-slate-400 uppercase">Điều kiện áp dụng</div>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div>• Đơn tối thiểu: <span className="font-semibold">{selectedVoucherDetails.minOrderValue.toLocaleString()}đ</span></div>
                  {selectedVoucherDetails.maxDiscount && (
                    <div>• Giảm tối đa: <span className="font-semibold">{selectedVoucherDetails.maxDiscount.toLocaleString()}đ</span></div>
                  )}
                  <div>• Hạn sử dụng: <span className="font-semibold">{new Date(selectedVoucherDetails.endDate).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", hour12: false })}</span></div>
                  <div>• Đối tượng áp dụng: <span className="font-semibold">{selectedVoucherDetails.applicableUserLevels?.map(lvl => LEVEL_MAP[lvl] || lvl).join(", ") || "Tất cả thành viên"}</span></div>
                </div>
              </div>

              {/* Applicable Products / Categories list */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                <div className="text-xs font-bold text-slate-400 uppercase">Sản phẩm & Danh mục áp dụng</div>
                {selectedVoucherDetails.applicableProducts?.length > 0 || selectedVoucherDetails.applicableCategories?.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {selectedVoucherDetails.applicableCategories?.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400">Danh mục:</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedVoucherDetails.applicableCategories.map((c) => (
                            <span key={c._id} className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-md border border-amber-100 dark:border-amber-900/30 text-[10px] font-medium">
                              {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedVoucherDetails.applicableProducts?.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400">Sản phẩm:</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedVoucherDetails.applicableProducts.map((p) => (
                            <span key={p._id} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-md border border-blue-100/80 dark:border-blue-900/30 text-[10px] font-medium">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">Áp dụng cho toàn bộ cửa hàng (không giới hạn sản phẩm).</div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-900/30">
              <button
                onClick={() => setSelectedVoucherDetails(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoucherCenter;
