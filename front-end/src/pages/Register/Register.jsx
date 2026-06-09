import { useEffect, useState } from "react";
import Breadcrumb from "../../components/Breadcrumb";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook } from "react-icons/fa";
import logo from "/pet.png";
import Header from "../../components/Header";
import ScrollToTopButton from "../../components/ScrollToTopButton";
import { Link, useNavigate } from "react-router-dom";
import "../page.scss";
import { toast } from "react-toastify";
import { checkDuplicate, sendSignupCode, verifySignup, signInWithGoogle } from "../../services/authService";
import { fetchProfile } from "../../services/userService";
import { useGoogleLogin } from "@react-oauth/google";
import {
  EMAIL_RULE_MESSAGE,
  PASSWORD_RULE_MESSAGE,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
} from "../../utils/validation";

const Register = () => {
  const links = [{ label: "Trang chủ", link: "/" }, { label: "Đăng ký" }];
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    birthDate: "",
    password: "",
    confirmPassword: "",
    gender: "",
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate("/login");
        setErrors({});
        setSuccess(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  // Bộ đếm ngược 60 giây cho nút Gửi lại OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    setErrors((preErros) => ({
      ...preErros,
      [name]: null, // xóa lỗi khi người dùng bắt đầu nhập lại
    }));
  };

  const validateForm = () => {
    const { fullName, email, birthDate, password, confirmPassword, gender } =
      formData;

    const newErrors = {};
    const emailNormalized = normalizeEmail(email);

    if (!fullName.trim()) newErrors.fullName = "Họ và tên không được để trống.";
    // if (!phone.match(/^\d{10}$/))
    //   newErrors.phone = "Số điện thoại không hợp lệ.";
    if (
      false && email &&
      !email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    )
      newErrors.email = "Email không hợp lệ.";
    if (!emailNormalized) newErrors.email = EMAIL_RULE_MESSAGE;
    else if (!isValidEmail(emailNormalized)) newErrors.email = EMAIL_RULE_MESSAGE;

    if (!birthDate) newErrors.birthDate = "Ngày sinh không được để trống.";
    if (!isValidPassword(password)) {
      newErrors.password = PASSWORD_RULE_MESSAGE;
    }
      // newErrors.password =
        "Mật khẩu phải tối thiểu 6 ký tự, có ít nhất 1 chữ và 1 số.";
    if (!confirmPassword) newErrors.confirmPassword = "Vui lòng nhập lại mật khẩu.";
    else if (password !== confirmPassword)
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";

    if (!gender) newErrors.gender = "Vui lòng chọn giới tính.";
    return newErrors;
  };

  const loginGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setErrors({});
      try {
        const res = await signInWithGoogle({ token: tokenResponse.access_token });
        const { accessToken } = res.data;

        if (!accessToken) {
          toast.error("Đăng ký bằng Google thất bại.");
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
        toast.success("Đăng ký/Đăng nhập bằng Google thành công!");
        setTimeout(() => {
          if (isAdmin) {
            navigate("/dashboard");
          } else {
            navigate("/");
          }
        }, 500);
      } catch (err) {
        console.error("Google Register Error:", err);
        const errorMessage = err.response?.data?.message || "Đăng ký bằng Google thất bại. Vui lòng thử lại.";
        setErrors({ general: errorMessage });
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error("Google Register Failed:", error);
      toast.error("Đăng ký bằng Google thất bại.");
    }
  });

  const handleRegister = async (e) => {
    e.preventDefault();

    // Prevent double click
    if (loading) return;

    setErrors({});
    setSuccess(false);
    setMessage("");

    const validationError = validateForm();
    if (Object.keys(validationError).length > 0) {
      setErrors(validationError);
      return;
    }

    setLoading(true);

    try {
      // Kiểm tra trùng lặp email và số điện thoại
      const { phone, email } = formData;
      const emailNormalized = normalizeEmail(email);
      const checkDuplicateResponse = await checkDuplicate({ phone, email: emailNormalized });

      if (checkDuplicateResponse.data.duplicateEmail) {
        setErrors({ email: "Email đã tồn tại." });
        toast.error("Email đã tồn tại!");
        return;
      }

      if (checkDuplicateResponse.data.duplicatePhone) {
        setErrors({ phone: "Số điện thoại đã tồn tại." });
        toast.error("Số điện thoại đã tồn tại!");
        return;
      }

      const imagePath = "/avatar.png";
      const response = await fetch(imagePath);
      const blob = await response.blob();

      // Chuyển đổi Blob thành base64
      const defaultAvatarBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      if (!defaultAvatarBase64) {
        throw new Error("Không thể chuyển đổi hình ảnh mặc định.");
      }

      console.log("defaultAvatarBase64:", defaultAvatarBase64);

      // Split fullName into firstName and lastName
      const nameParts = formData.fullName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || nameParts[0]; // If only one name, use it for both

      // Tạo người dùng mới
      const userData = {
        firstName: firstName,
        lastName: lastName,
        // phone: formData.phone,
        email: emailNormalized,
        birthDate: formData.birthDate,
        password: formData.password,
        role: "user",
        avatar: defaultAvatarBase64.split(",")[1],
        gender: formData.gender,
      };

      // send signup code and store payload in backend temporarily
      const res = await sendSignupCode(userData);
      setMessage(res.data?.message || "Đã gửi mã xác thực đến email.");
      setStep(2);
      setCooldown(60); // Bắt đầu đếm ngược 60 giây khi chuyển sang bước xác thực OTP
    } catch (err) {
      console.error("API Error:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.message || "Đã có lỗi xảy ra. Vui lòng thử lại.";
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();

    // Prevent double click
    if (loading) return;

    setErrors({});
    setLoading(true);

    try {
      const res = await verifySignup({ email: normalizeEmail(formData.email), code });
      if (res.status === 201) {
        toast.success("Đăng ký thành công. Đến trang đăng nhập.");
        setFormData({
          fullName: "",
          phone: "",
          email: "",
          birthDate: "",
          password: "",
          confirmPassword: "",
          gender: "",
        });
        setStep(1);
        setCode("");
        setSuccess(true);
        setTimeout(() => navigate('/login'), 800);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Xác thực thất bại. Vui lòng thử lại.";
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
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
            Đăng ký với
          </h1>
          {/* social login */}
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
          {/* form */}
          {step === 1 && (
            <form onSubmit={handleRegister}>
              {errors.general && (
                <span className="error-message">{errors.general}</span>
              )}
              <div className="space-y-6">
                <div className="input-container">
                  <input
                    type="text"
                    name="fullName"
                    placeholder=" "
                    className="w-full mb-2"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                  <label>Nhập họ và tên</label>
                  {errors.fullName && (
                    <span className="error-message">{errors.fullName}</span>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block mb-2">Giới tính</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={formData.gender === 'male'}
                        onChange={handleChange}
                      />
                      Nam
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={formData.gender === 'female'}
                        onChange={handleChange}
                      />
                      Nữ
                    </label>
                  </div>
                  {errors.gender && (
                    <span className="error-message">{errors.gender}</span>
                  )}
                </div>

                {/* <div className="input-container">
                  <input
                    type="text"
                    name="phone"
                    placeholder=" "
                    className="w-full mb-2"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                  <label>Nhập số điện thoại</label>
                  {errors.phone && (
                    <span className="error-message">{errors.phone}</span>
                  )}
                </div> */}

                <div className="input-container">
                  <input
                    type="text"
                    name="email"
                    placeholder=" "
                    className="w-full mb-2"
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
                    type="date"
                    name="birthDate"
                    placeholder=" "
                    className="w-full"
                    value={formData.birthDate}
                    onChange={handleChange}
                  />
                  <label>Chọn ngày sinh</label>
                  {errors.birthDate && (
                    <span className="error-message">{errors.birthDate}</span>
                  )}
                </div>

                <div className="input-container">
                  <input
                    type="password"
                    name="password"
                    placeholder=" "
                    className="w-full mb-2"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <label>Nhập mật khẩu</label>
                  {errors.password && (
                    <span className="error-message">{errors.password}</span>
                  )}
                </div>

                <div className="input-container">
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder=" "
                    className="w-full mb-2"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                  <label>Xác nhận mật khẩu</label>
                  {errors.confirmPassword && (
                    <span className="error-message">
                      {errors.confirmPassword}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-brown text-white py-3 rounded-md mt-2 font-semibold hover:shadow-lg cursor-pointer"
                disabled={loading}
              >
                {loading ? 'Đang gửi mã...' : 'Đăng ký'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="max-w-sm mx-auto">
              {message && <div className="mb-4 text-green-700">{message}</div>}
              {errors.general && (
                <div className="mb-4 text-red-600">{errors.general}</div>
              )}
              <div className="mb-4">
                <label className="block mb-2">Mã xác thực</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-brown text-white py-2 rounded"
                  disabled={loading}
                >
                  {loading ? 'Đang xác thực...' : 'Xác thực & Tạo tài khoản'}
                </button>
                <button
                  type="button"
                  className={`flex-1 border rounded py-2 ${cooldown > 0 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}`}
                  disabled={loading || cooldown > 0}
                  onClick={async () => {
                    // Prevent double click
                    if (loading || cooldown > 0) return;

                    setLoading(true);
                    try {
                      const imagePath = '/avatar.png';
                      const response = await fetch(imagePath);
                      const blob = await response.blob();
                      const defaultAvatarBase64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                      });
                      const nameParts = formData.fullName.trim().split(/\s+/);
                      const firstName = nameParts[0];
                      const lastName = nameParts.slice(1).join(' ') || nameParts[0];
                      await sendSignupCode({
                        firstName,
                        lastName,
                        // phone: formData.phone,
                        email: normalizeEmail(formData.email),
                        birthDate: formData.birthDate,
                        password: formData.password,
                        role: 'user',
                        avatar: defaultAvatarBase64.split(',')[1],
                        gender: formData.gender,
                      });
                      setMessage('Mã xác thực đã được gửi lại.');
                      toast.success('Mã xác thực đã được gửi lại.');
                      setCooldown(60); // Kích hoạt lại cooldown 60 giây sau khi gửi thành công
                    } catch (err) {
                      const errorMessage = err.response?.data?.message || err.message || "Gửi lại mã thất bại. Vui lòng thử lại.";
                      setErrors({ general: errorMessage });
                      toast.error(errorMessage);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  {loading ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại mã (${cooldown}s)` : 'Gửi lại mã'}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-gray-600 mt-6">
            Bạn đã có tài khoản?{" "}
            <Link to="/login" className="text-brown font-semibold">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>

      <ScrollToTopButton />

    </>
  );
};

export default Register;
