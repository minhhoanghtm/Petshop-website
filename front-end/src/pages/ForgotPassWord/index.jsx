import { useEffect, useState } from "react";
import Header from "../../components/Header";
import {
  requestPasswordReset,
  resendPasswordResetOtp,
  resetPassword,
  verifyPasswordResetOtp,
} from "../../services/authService";
import { useNavigate } from "react-router-dom";
import { PASSWORD_RULE_MESSAGE, isValidPassword, normalizeEmail } from "../../utils/validation";

const PAW_SVG = (
  <svg viewBox="0 0 64 64" fill="currentColor" className="w-full h-full">
    <ellipse cx="32" cy="48" rx="14" ry="10" />
    <ellipse cx="14" cy="36" rx="6" ry="8" />
    <ellipse cx="50" cy="36" rx="6" ry="8" />
    <ellipse cx="20" cy="22" rx="5" ry="6.5" />
    <ellipse cx="44" cy="22" rx="5" ry="6.5" />
  </svg>
);

const BONE_SVG = (
  <svg viewBox="0 0 80 24" fill="currentColor" className="w-16 h-5 opacity-20">
    <circle cx="8" cy="8" r="7" /><circle cx="8" cy="16" r="7" />
    <rect x="8" y="6" width="64" height="12" rx="4" />
    <circle cx="72" cy="8" r="7" /><circle cx="72" cy="16" r="7" />
  </svg>
);

const steps = [
  { id: 1, label: "Nhận mã", icon: "📧" },
  { id: 2, label: "Xác thực", icon: "🔐" },
  { id: 3, label: "Đặt lại", icon: "🐾" },
];

const FloatingPaws = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
    {[
      { top: "8%", left: "5%", size: 28, rotate: -20, opacity: 0.12 },
      { top: "20%", right: "8%", size: 18, rotate: 15, opacity: 0.10 },
      { top: "55%", left: "3%", size: 22, rotate: 30, opacity: 0.09 },
      { bottom: "15%", right: "5%", size: 32, rotate: -10, opacity: 0.13 },
      { bottom: "5%", left: "30%", size: 16, rotate: 45, opacity: 0.08 },
      { top: "40%", right: "3%", size: 20, rotate: -35, opacity: 0.10 },
    ].map((p, i) => (
      <div
        key={i}
        className="absolute text-amber-900"
        style={{
          top: p.top, left: p.left, right: p.right, bottom: p.bottom,
          width: p.size, height: p.size,
          transform: `rotate(${p.rotate}deg)`,
          opacity: p.opacity,
        }}
      >
        {PAW_SVG}
      </div>
    ))}
  </div>
);

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (step !== 2 || countdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, countdown]);

  const inputCls =
    "w-full rounded-2xl border-2 border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/15";

  const btnPrimaryCls =
    "w-full rounded-2xl bg-amber-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-400/30 transition hover:-translate-y-0.5 hover:bg-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-400/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

  const btnSecCls =
    "w-full rounded-2xl border-2 border-amber-200 bg-white px-4 py-3.5 text-sm font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60";

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (loading || resendLoading) return;
    setLoading(true); setError(""); setMessage("");
    setOtpVerified(false); setCode(""); setStep(1);
    try {
      const response = await requestPasswordReset({ email: normalizeEmail(email) });
      setMessage(response.data?.message || "Đã gửi mã xác thực đến email của bạn.");
      setCountdown(response.data?.nextResendInSeconds || 60);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể gửi email. Vui lòng thử lại.");
    } finally { setLoading(false); }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (loading || resendLoading) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await verifyPasswordResetOtp({ email: normalizeEmail(email), code });
      setOtpVerified(true); setStep(3);
      setMessage(response.data?.message || "Xác thực OTP thành công!");
      setCountdown(response.data?.otpExpiresInSeconds || countdown);
    } catch (err) {
      setOtpVerified(false);
      setError(err.response?.data?.message || "OTP không đúng, đã hết hạn hoặc vượt quá số lần thử.");
    } finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    if (loading || resendLoading) return;
    setResendLoading(true); setError(""); setMessage("");
    try {
      const response = await resendPasswordResetOtp({ email: normalizeEmail(email) });
      setCode(""); setOtpVerified(false);
      setCountdown(response.data?.nextResendInSeconds || 60);
      setMessage(response.data?.message || "Đã gửi lại mã OTP mới.");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể gửi lại mã OTP. Vui lòng thử lại sau.");
    } finally { setResendLoading(false); }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (loading || resendLoading) return;
    if (!newPassword) { setError(PASSWORD_RULE_MESSAGE); return; }
    if (!isValidPassword(newPassword)) { setError(PASSWORD_RULE_MESSAGE); return; }
    if (!confirmPassword) { setError("Mật khẩu xác nhận không được để trống."); return; }
    if (!otpVerified) { setError("Vui lòng xác thực OTP trước khi đặt lại mật khẩu."); return; }
    if (newPassword !== confirmPassword) { setError("Mật khẩu xác nhận không khớp!"); return; }
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await resetPassword({ email: normalizeEmail(email), newPassword });
      setMessage(response.data?.message || "Đặt lại mật khẩu thành công!");
      navigate("/login");
      setEmail(""); setCode(""); setNewPassword(""); setConfirmPassword("");
      setOtpVerified(false); setCountdown(0);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
    } finally { setLoading(false); }
  };

  return (
    <>
      <Header />
      <main
        className="min-h-[calc(100vh-80px)] px-4 py-10 sm:px-6 lg:px-8"
        style={{
          background: "radial-gradient(ellipse at 20% 0%, #fef3c7 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, #fde68a 0%, transparent 45%), linear-gradient(160deg, #fffbeb 0%, #fef9ee 50%, #fff7ed 100%)",
        }}
      >
        <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-[1fr_1fr]">

          {/* LEFT PANEL */}
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-500 via-amber-400 to-orange-400 p-8 text-white shadow-2xl shadow-amber-400/40 sm:p-10">
            <FloatingPaws />

            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -left-8 w-52 h-52 rounded-full bg-amber-600/20" />

            <div className="relative">
              {/* Logo mark */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white">
                  <span className="text-xl">🐾</span>
                </div>
                <div>
                  <div className="font-black text-lg tracking-tight leading-none">PetShop</div>
                  <div className="text-amber-100 text-xs mt-0.5">Phụ kiện thú cưng</div>
                </div>
              </div>

              <h1 className="text-3xl font-black leading-tight sm:text-4xl">a
                Đừng lo,<br />
                <span className="text-amber-100">bạn đã có</span><br />
                chúng mình! 🐶
              </h1>

              <p className="mt-4 text-amber-100 text-sm leading-relaxed max-w-xs">
                Khôi phục mật khẩu chỉ trong vài bước đơn giản — để bạn sớm trở lại chọn đồ xinh cho thú cưng nhé!
              </p>

              {/* Step indicators */}
              <div className="mt-8 space-y-3">
                {steps.map((item) => {
                  const active = step === item.id;
                  const completed = step > item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300 ${
                        active
                          ? "bg-white/25 shadow-lg shadow-amber-600/20"
                          : completed
                          ? "bg-white/10 opacity-80"
                          : "opacity-40"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${
                        active ? "bg-white text-amber-500 shadow-md" :
                        completed ? "bg-white/20" : "bg-white/10"
                      }`}>
                        {completed ? "✓" : item.icon}
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-amber-100 leading-none">Bước {item.id}</div>
                        <div className="text-sm font-bold mt-0.5">{item.label}</div>
                      </div>
                      {active && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom bone decoration */}
              <div className="mt-8 flex justify-center text-white">
                {BONE_SVG}
              </div>
            </div>
          </section>

          {/* RIGHT PANEL — FORM */}
          <section className="rounded-[2rem] border-2 border-amber-100 bg-white p-7 shadow-xl shadow-amber-900/5 sm:p-9">
            {/* Header */}
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-600 mb-4">
                <span>🐾</span> Bảo mật tài khoản
              </div>
              <h2 className="text-2xl font-black text-stone-900">Quên mật khẩu</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                {step === 1 && "Nhập email để nhận mã xác thực."}
                {step === 2 && "Nhập mã OTP vừa được gửi tới hộp thư của bạn."}
                {step === 3 && "Tạo mật khẩu mới để hoàn tất khôi phục."}
              </p>
            </div>

            {/* Progress dots */}
            <div className="flex gap-2 mb-7">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    step >= s.id ? "bg-amber-400" : "bg-amber-100"
                  } ${step === s.id ? "w-8" : "w-2"}`}
                />
              ))}
            </div>

            {/* Messages */}
            {message && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <span className="shrink-0 text-base">✅</span>
                <span>{message}</span>
              </div>
            )}
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                <span className="shrink-0 text-base">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <form className="space-y-5" onSubmit={handleEmailSubmit}>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-stone-700">
                    Địa chỉ email 📧
                  </label>
                  <input
                    type="email" id="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    placeholder="example@email.com"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className={btnPrimaryCls}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Đang gửi...
                    </span>
                  ) : "Gửi mã xác thực →"}
                </button>
              </form>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <form className="space-y-5" onSubmit={handleOtpSubmit}>
                <div>
                  <label htmlFor="otp" className="mb-2 block text-sm font-semibold text-stone-700">
                    Mã OTP 🔑
                  </label>
                  <input
                    type="text" id="otp" value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={`${inputCls} text-center text-lg font-bold tracking-[0.3em]`}
                    placeholder="• • • • • •"
                    required
                  />
                  <p className="mt-1.5 text-xs text-stone-400">Kiểm tra hộp thư đến (và thư mục spam nhé! 🐶)</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="submit" disabled={loading} className={btnPrimaryCls}>
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Đang xác thực...
                      </span>
                    ) : "Xác thực OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendLoading || countdown > 0}
                    className={btnSecCls}
                  >
                    {resendLoading ? "Đang gửi lại..."
                      : countdown > 0
                      ? `⏱ Gửi lại sau ${countdown}s`
                      : "Gửi lại mã"}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <form className="space-y-5" onSubmit={handlePasswordSubmit}>
                <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <span className="text-lg">🐾</span>
                  <span className="font-semibold">OTP đã xác thực! Tạo mật khẩu mới nào.</span>
                </div>
                <div>
                  <label htmlFor="newPassword" className="mb-2 block text-sm font-semibold text-stone-700">
                    Mật khẩu mới 🔒
                  </label>
                  <input
                    type="password" id="newPassword" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputCls} placeholder="Nhập mật khẩu mới" required
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-stone-700">
                    Xác nhận mật khẩu 🔒
                  </label>
                  <input
                    type="password" id="confirmPassword" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputCls} placeholder="Nhập lại mật khẩu mới" required
                  />
                </div>
                <button type="submit" disabled={loading} className={btnPrimaryCls}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : "🐾 Đặt lại mật khẩu"}
                </button>
              </form>
            )}

            {/* Back to login */}
            <p className="mt-6 text-center text-sm text-stone-400">
              Nhớ mật khẩu rồi?{" "}
              <a href="/login" className="font-semibold text-amber-500 hover:text-amber-600 transition">
                Đăng nhập ngay
              </a>
            </p>
          </section>
        </div>
      </main>
    </>
  );
};

export default ForgotPassword;
