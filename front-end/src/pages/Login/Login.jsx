import { useEffect, useRef, useState } from "react";
import Breadcrumb from "../../components/Breadcrumb";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook } from "react-icons/fa";
import logo from "/pet.png";
import Header from "../../components/Header";
import ScrollToTopButton from "../../components/ScrollToTopButton";
import { Link, useNavigate } from "react-router-dom";
import "../page.scss";
import { toast } from "react-toastify";
import { signIn, signInWithGoogle } from "../../services/authService";
import { fetchProfile } from "../../services/userService";
import { useGoogleLogin } from "@react-oauth/google";
import {
  EMAIL_RULE_MESSAGE,
  PASSWORD_RULE_MESSAGE,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
} from "../../utils/validation";

const Login = () => {
  const links = [{ label: "Trang chủ", link: "/" }, { label: "Đăng nhập" }];
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);
  const errorTimeoutRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    setFormData({ email: "", password: "" });
    setErrors({});
    setSuccess(false);

    toast.dismiss();

    console.log("Login page mounted - form cleared and toast dismissed");

    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!lockUntil) {
      setLockRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockRemainingSeconds(remaining);

      if (remaining === 0) {
        setLockUntil(0);
      }
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);

    return () => clearInterval(timer);
  }, [lockUntil]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        const storedUser = JSON.parse(localStorage.getItem("user"));
        if (storedUser && storedUser.role === "admin") {
          navigate("/dashboard");
        } else {
          navigate("/");
        }
        setErrors({});
        setSuccess(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    setErrors((preErrors) => ({
      ...preErrors,
      [name]: null,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    const email = normalizeEmail(formData.email);
    if (!email) {
      newErrors.email = "Email không được để trống.";
    } else if (!isValidEmail(email)) {
      newErrors.email = EMAIL_RULE_MESSAGE;
    }

    if (!formData.password) {
      newErrors.password = "Mật khẩu không được để trống.";
    } else if (!isValidPassword(formData.password)) {
      newErrors.password = PASSWORD_RULE_MESSAGE;
    }

    return newErrors;
  };

  const showApiError = (message) => {
    setErrors((prev) => ({ ...prev, general: message }));

    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    errorTimeoutRef.current = setTimeout(() => {
      setErrors((prev) => ({ ...prev, general: undefined }));
      errorTimeoutRef.current = null;
    }, 5000);
  };

  const loginGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setErrors({});
      try {
        const res = await signInWithGoogle({ token: tokenResponse.access_token });
        const { accessToken } = res.data;

        if (!accessToken) {
          showApiError("Đăng nhập bằng Google thất bại.");
          return;
        }

        localStorage.setItem("accessToken", accessToken);
        const profileRes = await fetchProfile();
        let isAdmin = false;
        if (profileRes?.data) {
          localStorage.setItem("user", JSON.stringify(profileRes.data));
          isAdmin = profileRes.data.role === "admin";
        }
        setSuccess(true);
        toast.success("Đăng nhập bằng Google thành công!");
        setTimeout(() => {
          if (isAdmin) {
            navigate("/dashboard");
          } else {
            navigate("/");
          }
        }, 500);
      } catch (err) {
        console.error("Google Login Error:", err);
        const errorMessage = err.response?.data?.message || "Đăng nhập bằng Google thất bại. Vui lòng thử lại.";
        showApiError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error("Google Login Failed:", error);
      toast.error("Đăng nhập bằng Google thất bại.");
    }
  });

  const handleLogin = async (e) => {
    e.preventDefault();

    // Prevent double click
    if (loading) return;

    setErrors({});
    setSuccess(false);

    if (lockUntil && lockUntil > Date.now()) {
      const remainingMs = lockUntil - Date.now();
      const seconds = Math.ceil(remainingMs / 1000);
      let durationText = "";
      
      if (seconds < 60) {
        durationText = `${seconds} giây`;
      } else {
        const minutes = Math.ceil(remainingMs / 60000);
        if (minutes < 60) {
          durationText = `${minutes} phút`;
        } else {
          const hours = Math.floor(minutes / 60);
          const remMinutes = minutes % 60;
          if (remMinutes === 0) {
            durationText = `${hours} giờ`;
          } else {
            durationText = `${hours} giờ ${remMinutes} phút`;
          }
        }
      }

      showApiError(
        `Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau ${durationText}.`,
      );
      return;
    }

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      const res = await signIn({
        email: normalizeEmail(formData.email),
        password: formData.password,
      });

      const { accessToken } = res.data;

      if (!accessToken) {
        showApiError("Email hoặc mật khẩu không chính xác.");
        return;
      }

      localStorage.setItem("accessToken", accessToken);
      const profileRes = await fetchProfile();
      let isAdmin = false;
      if (profileRes?.data) {
        localStorage.setItem("user", JSON.stringify(profileRes.data));
        isAdmin = profileRes.data.role === "admin";
      }
      setLockUntil(0);
      setSuccess(true);
      toast.success("Đăng nhập thành công!");
      setTimeout(() => {
        if (isAdmin) {
          navigate("/dashboard");
        } else {
          navigate("/");
        }
      }, 500);
    } catch (err) {
      console.error("API Error:", err.response?.data || err.message);
      const responseStatus = err.response?.status;
      const responseLockUntil = Number(err.response?.data?.lockUntil || 0);
      const errorMessage = err.response?.data?.message;

      if (responseLockUntil > Date.now()) {
        setLockUntil(responseLockUntil);
      } else {
        setLockUntil(0);
      }

      if (responseStatus === 429 || responseStatus === 423) {
        showApiError(
          errorMessage ||
            "Tài khoản đang tạm thời bị khóa. Vui lòng thử lại sau.",
        );
      } else if (responseStatus === 401) {
        showApiError("Email hoặc mật khẩu không chính xác.");
      } else if (responseStatus === 403) {
        showApiError(errorMessage || "Tài khoản đã bị khóa.");
      } else {
        showApiError(errorMessage || "Đã có lỗi xảy ra. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <Breadcrumb items={links} />
      <div className="container mx-auto px-4 md:px-8 flex flex-col items-center -mt-10">
        <div className="w-full max-w-2xl bg-white rounded-md shadow-md p-8">
          <div className="flex justify-center">
            <img src={logo} alt="Logo" className="w-30 h-30 object-contain" />
          </div>
          <h1 className="text-2xl font-semibold text-center mb-4">
            Đăng nhập với
          </h1>
          <div className="flex justify-center gap-4 mb-6">
            <button
              type="button"
              onClick={() => loginGoogle()}
              className="flex items-center gap-2 bg-gray-100 px-6 py-3 rounded-md hover:bg-gray-200 shadow-sm cursor-pointer"
              disabled={loading}
            >
              <FcGoogle className="text-4xl" />
              Google
            </button>
            <button className="flex items-center gap-2 bg-gray-100 px-6 py-3 rounded-md hover:bg-gray-200 shadow-sm cursor-pointer">
              <FaFacebook className="text-4xl text-blue-600" />
              Facebook
            </button>
          </div>
          <div className="flex items-center my-6">
            <hr className="grow border-gray-300" />
            <span className="mx-4 text-gray-500">hoặc</span>
            <hr className="grow border-gray-300" />
          </div>
          {errors.general && (
            <div
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-10"
              role="alert"
            >
              {errors.general}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <div className="space-y-6">
              <div className="input-container">
                <input
                  type="email"
                  name="email"
                  placeholder=" "
                  className="w-full"
                  value={formData.email}
                  onChange={handleChange}
                />
                <label>Nhập email</label>
                {errors.email && (
                  <span className="error-message">{errors.email}</span>
                )}
              </div>
              <div className="input-container">
                <input
                  type="password"
                  name="password"
                  placeholder=" "
                  className="w-full"
                  value={formData.password}
                  onChange={handleChange}
                />
                <label>Nhập mật khẩu</label>
                {errors.password && (
                  <span className="error-message">{errors.password}</span>
                )}
              </div>
              {/* {lockRemainingSeconds > 0 && (
                <small className="text-red-600 italic mx-2">
                  Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau{" "}
                  {lockRemainingSeconds} giây.
                </small>
              )}
              <br /> */}
              <small className="text-gray-500 italic mx-2">
                Quên mật khẩu?{" "}
                <Link
                  to="/forgot-password"
                  className="text-brown font-semibold"
                >
                  Lấy lại mật khẩu
                </Link>
              </small>
            </div>
            <button
              type="submit"
              className="w-full bg-brown text-white py-3 rounded-md mt-6 font-semibold hover:shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <p className="text-center text-gray-600 mt-6">
            Bạn chưa có tài khoản?{" "}
            <Link to="/register" className="text-brown font-semibold">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>

      <ScrollToTopButton />
    </>
  );
};

export default Login;
