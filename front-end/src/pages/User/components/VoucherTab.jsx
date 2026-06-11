import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  FaTicketAlt,
  FaPercentage,
  FaMoneyBillWave,
  FaShippingFast,
  FaCalendarAlt,
  FaClock,
} from "react-icons/fa";
import { fetchUserWallet } from "../../../services/voucherService";

const LEVEL_MAP = {
  standard: "Đồng",
  silver: "Bạc",
  gold: "Vàng",
  vip: "VIP",
};

const VoucherTab = () => {
  const [activeSubTab, setActiveSubTab] = useState("available");
  const [userVouchers, setUserVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoucherDetails, setSelectedVoucherDetails] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadWallet();
  }, [activeSubTab]);

  const loadWallet = async () => {
    try {
      setLoading(true);
      const res = await fetchUserWallet(activeSubTab);
      // Backend returns UserVoucher documents populated with voucherId
      setUserVouchers(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải ví voucher cá nhân.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs bar */}
      <div className="flex border-b border-slate-100 dark:border-slate-700">
        {[
          { key: "available", label: "Mã Khả Dụng" },
          { key: "used", label: "Đã Sử Dụng" },
          { key: "expired", label: "Hết Hiệu Lực" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex-1 pb-3 text-center text-xs md:text-sm font-bold border-b-2 transition cursor-pointer ${
              activeSubTab === tab.key
                ? "border-amber-600 text-amber-700 dark:text-amber-500"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vouchers list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-32 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : userVouchers.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FaTicketAlt size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold">Ví voucher trống</p>
          <p className="text-xs text-slate-400 mt-1">
            {activeSubTab === "available"
              ? "Bạn chưa có voucher nào khả dụng."
              : activeSubTab === "used"
              ? "Bạn chưa từng sử dụng voucher nào."
              : "Không có voucher nào hết hạn."}
          </p>
          {activeSubTab === "available" && (
            <button
              onClick={() => navigate("/vouchers")}
              className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer"
            >
              Đến Săn Voucher Ngay
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {userVouchers.map((uv) => {
            const v = uv.voucherId || {};
            if (!v._id) return null;

            // Setup colors and styles based on availability
            const isAvailable = activeSubTab === "available";
            const isUsed = activeSubTab === "used";

            const typeGradients = {
              PERCENT: "from-orange-500 to-red-500",
              FIXED: "from-amber-500 to-orange-500",
              FREESHIP: "from-teal-500 to-emerald-500",
            };
            const defaultGradient = typeGradients[v.type] || "from-amber-500 to-orange-500";
            const gradient = isAvailable ? defaultGradient : "from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700";

            return (
              <div
                key={uv._id}
                className={`relative border border-slate-100 dark:border-slate-700/50 shadow-sm rounded-3xl flex overflow-hidden min-h-32 transition ${
                  isAvailable ? "bg-white dark:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/20 opacity-70"
                }`}
              >
                {/* Left side ticket notch decor */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-3 h-6 rounded-r-full border-r border-slate-100 dark:border-slate-700 z-10 ${isAvailable ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-900"}`} />
                {/* Right side ticket notch decor */}
                <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-6 rounded-l-full border-l border-slate-100 dark:border-slate-700 z-10 ${isAvailable ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-900"}`} />

                {/* Left Side Icon and type */}
                <div className={`w-[28%] bg-gradient-to-br ${gradient} p-3 flex flex-col items-center justify-center text-white select-none relative`}>
                  <span className="absolute top-1.5 left-3 text-[8px] uppercase tracking-wider font-mono font-bold opacity-80">
                    {v.code}
                  </span>
                  <div className="bg-white/20 p-2 rounded-full mb-1">
                    {v.type === "PERCENT" && <FaPercentage size={16} />}
                    {v.type === "FIXED" && <FaMoneyBillWave size={16} />}
                    {v.type === "FREESHIP" && <FaShippingFast size={16} />}
                  </div>
                  <span className="text-[10px] font-bold text-center">
                    {v.type === "PERCENT" && `${v.value}% OFF`}
                    {v.type === "FIXED" && `${v.value >= 1000 ? v.value / 1000 + "K" : v.value} OFF`}
                    {v.type === "FREESHIP" && "FREE SHIP"}
                  </span>
                </div>

                {/* Dashed divider line */}
                <div className="border-l border-dashed border-slate-200 dark:border-slate-700 h-full" />

                {/* Right Content details */}
                <div className="flex-1 p-4 flex flex-col justify-between pl-5 pr-5">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-800 dark:text-white line-clamp-1 text-sm">
                      {v.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-normal line-clamp-1">
                      {v.description || "Giảm giá mua sắm phụ kiện & thực phẩm thú cưng"}
                    </p>
                    {v.minOrderValue > 0 && (
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        Đơn tối thiểu: {v.minOrderValue.toLocaleString()}đ
                      </p>
                    )}

                    {/* Applicable products / categories */}
                    <div className="mt-1.5 text-[9px]">
                      {v.applicableProducts?.length > 0 || v.applicableCategories?.length > 0 ? (
                        <div className="space-y-0.5 bg-slate-50 dark:bg-slate-900/40 p-1.5 rounded-lg border border-slate-100/80 dark:border-slate-800">
                          <div className="font-bold text-slate-600 dark:text-slate-300">Sản phẩm áp dụng:</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {v.applicableCategories?.slice(0, 1).map((c) => (
                              <span key={c._id} className="px-1 py-0.2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded border border-amber-100 dark:border-amber-900/30 font-medium">
                                Danh mục: {c.name}
                              </span>
                            ))}
                            {v.applicableProducts?.slice(0, 2 - (v.applicableCategories?.length > 0 ? 1 : 0)).map((p) => (
                              <span key={p._id} className="px-1 py-0.2 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded border border-blue-100/80 dark:border-blue-900/30 font-medium truncate max-w-[100px]" title={p.name}>
                                {p.name}
                              </span>
                            ))}
                            {((v.applicableProducts?.length || 0) + (v.applicableCategories?.length || 0)) > 2 && (
                              <button
                                onClick={() => setSelectedVoucherDetails(v)}
                                className="px-1 py-0.2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600 font-bold transition cursor-pointer"
                              >
                                +{((v.applicableProducts?.length || 0) + (v.applicableCategories?.length || 0)) - 2} Xem thêm
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-semibold italic text-[9px]">
                          Áp dụng cho toàn bộ cửa hàng
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50 text-[10px] font-semibold">
                    <span className="text-slate-400 flex items-center gap-1">
                      <FaClock /> HSD: {new Date(v.endDate).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", hour12: false })}
                    </span>

                    {isAvailable ? (
                      <button
                        onClick={() => navigate("/")}
                        className={`px-3 py-1 bg-gradient-to-r ${defaultGradient} hover:brightness-105 active:scale-95 text-white rounded-lg transition text-[10px] font-bold cursor-pointer shadow-sm`}
                      >
                        Dùng Ngay
                      </button>
                    ) : isUsed ? (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-md font-bold select-none border border-slate-200/50">
                        Đã sử dụng
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-md font-bold select-none border border-slate-200/50">
                        Hết hạn
                      </span>
                    )}
                  </div>
                </div>

                {/* Stylized Used Stamp Overlay */}
                {isUsed && (
                  <div className="absolute right-12 top-2 pointer-events-none select-none opacity-20 transform rotate-12 border-4 border-rose-600 rounded-xl p-1 text-rose-600 font-extrabold text-xs uppercase tracking-wider">
                    Đã Dùng
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
    </div>
  );
};

export default VoucherTab;
