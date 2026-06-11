import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  FaTicketAlt,
  FaPercentage,
  FaMoneyBillWave,
  FaShippingFast,
  FaClock,
  FaTimes,
  FaCheck,
  FaChevronRight,
} from "react-icons/fa";
import { fetchUserWallet, applyVoucher } from "../../../services/voucherService";

const CheckoutVoucherSelector = ({
  cartItems = [],
  shippingCost = 0,
  deliveryOption = "delivery",
  appliedVoucher = null,
  onApplyVoucher,
  onRemoveVoucher,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [walletVouchers, setWalletVouchers] = useState([]);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price || item.product_id?.price || 0) * item.quantity, 0);

  useEffect(() => {
    if (isModalOpen) {
      loadWalletVouchers();
    }
  }, [isModalOpen]);

  const loadWalletVouchers = async () => {
    try {
      setLoading(true);
      const res = await fetchUserWallet("available");
      setWalletVouchers(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách voucher từ ví.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCode = async (code) => {
    if (!code || !String(code).trim()) return;

    try {
      setBtnLoading(true);
      const itemsPayload = cartItems.map((item) => ({
        product_id: item.product_id?._id || item.product_id || item.id,
        quantity: item.quantity,
      }));

      const res = await applyVoucher({
        code: String(code).trim().toUpperCase(),
        items: itemsPayload,
        shippingCost,
        deliveryOption,
      });

      const { voucherId, discountAmount } = res.data;
      onApplyVoucher({
        voucherId,
        code: res.data.code,
        discountAmount,
      });

      toast.success(`Đã áp dụng mã giảm giá ${res.data.code}!`);
      setIsModalOpen(false);
      setManualCode("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Áp dụng mã giảm giá thất bại. Vui lòng kiểm tra lại điều kiện.");
    } finally {
      setBtnLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 p-4 rounded-2xl space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <FaTicketAlt className="text-amber-500" /> Voucher Khuyến Mãi
        </h4>
      </div>

      {appliedVoucher ? (
        <div className="flex items-center justify-between p-3 bg-amber-50/30 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-xl animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold font-mono tracking-wide border border-amber-200/50">
              {appliedVoucher.code}
            </span>
            <div className="text-xs">
              <div className="font-bold text-slate-800 dark:text-slate-200">Đã giảm -{appliedVoucher.discountAmount.toLocaleString()}đ</div>
              <div className="text-[10px] text-slate-400 font-medium">Đơn hàng đã được khấu trừ</div>
            </div>
          </div>
          <button
            onClick={onRemoveVoucher}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition cursor-pointer"
          >
            <FaTimes size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 hover:border-amber-500 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-amber-600 transition cursor-pointer bg-slate-50/50 dark:bg-slate-900/40"
        >
          <span className="flex items-center gap-2">
            <FaTicketAlt size={14} className="text-slate-400" /> Chọn hoặc nhập mã giảm giá
          </span>
          <FaChevronRight className="text-slate-400" />
        </button>
      )}

      {/* Selector Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh] my-8 animate-scaleUp">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FaTicketAlt className="text-amber-500" /> Chọn Voucher Của Bạn
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <FaTimes size={16} />
              </button>
            </div>

            {/* Manual Code Input */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                placeholder="Nhập mã giảm giá..."
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm font-semibold tracking-wider focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                disabled={btnLoading || !manualCode}
                onClick={() => handleApplyCode(manualCode)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap"
              >
                {btnLoading ? "..." : "Áp Dụng"}
              </button>
            </div>

            {/* Vouchers List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-48">
              {loading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-28 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl animate-pulse" />
                ))
              ) : walletVouchers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FaTicketAlt size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Ví voucher trống</p>
                  <p className="text-[11px] text-slate-400 mt-1">Hãy nhận thêm voucher tại Trung tâm Voucher trước nhé.</p>
                </div>
              ) : (
                walletVouchers.map((uv) => {
                  const v = uv.voucherId || {};
                  if (!v._id) return null;

                  const isApplicable = subtotal >= v.minOrderValue;
                  const discountEstimate = v.type === "PERCENT"
                    ? Math.round(Math.min((subtotal * v.value) / 100, v.maxDiscount || Infinity))
                    : v.type === "FIXED" ? v.value : Math.min(shippingCost, v.value);

                  // Setup gradients based on voucher type
                  const typeGradients = {
                    PERCENT: "from-orange-500 to-red-500",
                    FIXED: "from-amber-500 to-orange-500",
                    FREESHIP: "from-teal-500 to-emerald-500",
                  };
                  const defaultGradient = typeGradients[v.type] || "from-amber-500 to-orange-500";
                  const gradient = isApplicable ? defaultGradient : "from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700";

                  return (
                    <div
                      key={uv._id}
                      className={`relative border border-slate-100 dark:border-slate-700/50 rounded-2xl flex overflow-hidden min-h-24 ${
                        isApplicable ? "bg-white dark:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/10 opacity-60"
                      }`}
                    >
                      {/* Ticket notches */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-4 bg-white dark:bg-slate-800 rounded-r-full z-10" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-4 bg-white dark:bg-slate-800 rounded-l-full z-10" />

                      {/* Left Side Icon and type */}
                      <div className={`w-[24%] bg-gradient-to-br ${gradient} p-2.5 flex flex-col items-center justify-center text-white select-none relative`}>
                        <span className="absolute top-1 left-2 text-[7px] uppercase tracking-wider font-mono font-bold opacity-80">
                          {v.code}
                        </span>
                        <div className="bg-white/20 p-1.5 rounded-full mb-1">
                          {v.type === "PERCENT" && <FaPercentage size={12} />}
                          {v.type === "FIXED" && <FaMoneyBillWave size={12} />}
                          {v.type === "FREESHIP" && <FaShippingFast size={12} />}
                        </div>
                        <span className="text-[9px] font-bold text-center">
                          {v.type === "PERCENT" && `${v.value}%`}
                          {v.type === "FIXED" && `${v.value >= 1000 ? v.value / 1000 + "K" : v.value}`}
                          {v.type === "FREESHIP" && "FREE"}
                        </span>
                      </div>

                      {/* Dashed divider */}
                      <div className="border-l border-dashed border-slate-200 dark:border-slate-700 h-full" />

                      {/* Right Details */}
                      <div className="flex-1 p-3 flex flex-col justify-between pl-4 pr-4 text-xs">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-slate-800 dark:text-white line-clamp-1 text-[13px]">{v.name}</h4>
                          <p className="text-[10px] text-slate-400 leading-normal line-clamp-1">
                            {v.description}
                          </p>
                          {v.minOrderValue > 0 && (
                            <p className={`text-[10px] font-semibold ${isApplicable ? "text-slate-500" : "text-rose-500"}`}>
                              Giá trị tối thiểu đơn: {v.minOrderValue.toLocaleString()}đ (Mua thêm: {Math.max(0, v.minOrderValue - subtotal).toLocaleString()}đ)
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-700/50 text-[10px] font-semibold">
                          <span className="text-slate-400 flex items-center gap-1">
                            <FaClock /> HSD: {new Date(v.endDate).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", hour12: false })}
                          </span>

                          {isApplicable ? (
                            <button
                              disabled={btnLoading}
                              onClick={() => handleApplyCode(v.code)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition text-[10px] font-bold cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              <FaCheck size={8} /> Áp Dụng
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-md font-bold select-none border">
                              Không đủ điều kiện
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutVoucherSelector;
