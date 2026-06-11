import { useSearchParams, Link } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaHistory, FaHome } from "react-icons/fa";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

const PaymentResult = () => {
    const [searchParams] = useSearchParams();
    const success = searchParams.get("success") === "true";
    const message = searchParams.get("message") || "Không có thông tin chi tiết về giao dịch.";

    return (
        <>
            <Header />
            <div className="flex flex-col items-center justify-center min-h-[70vh] bg-slate-50 py-12 px-4">
                <div className="bg-white border border-slate-100 rounded-3xl p-8 max-w-md w-full shadow-lg text-center">
                    <div className="flex justify-center mb-6">
                        {success ? (
                            <FaCheckCircle className="w-20 h-20 text-emerald-500 animate-bounce" />
                        ) : (
                            <FaTimesCircle className="w-20 h-20 text-rose-500 animate-pulse" />
                        )}
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        {success ? "Thanh toán thành công!" : "Thanh toán thất bại"}
                    </h1>

                    <p className="text-slate-600 mb-8 px-2 text-sm leading-relaxed">
                        {message}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            to="/userProfile/history"
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium transition cursor-pointer text-sm shadow-md"
                        >
                            <FaHistory />
                            Lịch sử đơn hàng
                        </Link>
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer text-sm"
                        >
                            <FaHome />
                            Trang chủ
                        </Link>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default PaymentResult;
