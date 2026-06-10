import React, { useState, useEffect } from "react";
import MainLayout from "../../layout/MainLayout";
import Breadcrumb from "../../components/Breadcrumb";
import { toast } from "react-toastify";
import "../page.scss";
import "./Checkout.scss";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import boxCard from "../../assets/images/box-card.png";
import bankCard from "../../assets/images/bank-card.png";
import { CheckCheck, ChevronDown } from "lucide-react";
import { BsBox2 } from "react-icons/bs";
import { createOrder } from "../../services/orderService";
import { createMomoPayment, createVNPayPayment } from "../../services/paymentService";
import {
  fetchShippingAddress,
  updateShippingAddress,
} from "../../services/userService";
import CheckoutVoucherSelector from "./components/CheckoutVoucherSelector";

const CheckOut = () => {
  const [deliveryOption, setDeliveryOption] = useState("delivery");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState("cod");
  const [errors, setErrors] = useState({});
  const [provinces, setProvinces] = useState([]);
  const [pickupProvince, setPickupProvince] = useState("");
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { cartItems, clearCart, removeFromCart } = useCart();
  const [user, setUser] = useState(null);
  const userId = user?._id || user?.id;
  const buyNowItems = location.state?.buyNowItems || null;
  const selectedItems = location.state?.selectedItems || null;

  // Lọc sản phẩm thanh toán từ giỏ hàng nếu người dùng chỉ chọn một số sản phẩm cụ thể
  const checkoutItems = buyNowItems && buyNowItems.length > 0
    ? buyNowItems
    : (selectedItems && selectedItems.length > 0
      ? cartItems.filter(item => selectedItems.includes(item._id))
      : cartItems);

  const isBuyNowMode = Boolean(buyNowItems && buyNowItems.length > 0);

  const subtotal = checkoutItems.reduce(
    (total, item) => total + (item.product_id?.price || 0) * item.quantity,
    0
  );
  const calculateTotal = () => {
    const baseTotal = deliveryOption === "pickup" ? subtotal : subtotal + shippingCost;
    return Math.max(0, baseTotal - (appliedVoucher?.discountAmount || 0));
  };
  const links = [
    { label: "Trang chủ", link: "/" },
    { label: "Giỏ hàng", link: "/cart" },
    { label: "Thanh toán" },
  ];

  const [formData, setFormData] = useState({
    receiverName: "",
    email: "",
    phone: "",
    province: "",
    district: "",
    ward: "",
    detailAddress: "",
  });

  useEffect(() => {
    toast.dismiss("cart-add-success-toast");

    const userData = JSON.parse(localStorage.getItem("user"));
    if (userData) {
      setUser(userData);
      setFormData((prevState) => ({
        ...prevState,
        receiverName: userData.fullName || "",
        email: userData.email || "",
        phone: userData.phone || "",
      }));
    } else {
      toast.error("Vui lòng đăng nhập để đặt hàng.");
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadProvinces = async () => {
      try {
        const response = await fetch("https://provinces.open-api.vn/api/?depth=3");
        if (!response.ok) {
          throw new Error("Không thể tải dữ liệu địa giới hành chính.");
        }
        const data = await response.json();
        if (isMounted) {
          setProvinces(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error loading provinces:", error);
        if (isMounted) {
          setAddressError(
            error.message || "Không thể tải dữ liệu tỉnh/thành."
          );
        }
      }
    };

    loadProvinces();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const loadShippingAddress = async () => {
      if (!userId) return;

      setIsAddressLoading(true);
      setAddressError("");

      try {
        const response = await fetchShippingAddress();
        const savedAddress = response?.data?.shippingAddress;
        if (savedAddress) {
          setFormData((prevState) => ({
            ...prevState,
            receiverName: savedAddress.receiverName || prevState.receiverName,
            phone: savedAddress.phone || prevState.phone,
            province: savedAddress.province || "",
            district: savedAddress.district || "",
            ward: savedAddress.ward || "",
            detailAddress: savedAddress.detailAddress || "",
          }));
        }
      } catch (error) {
        console.error("Error loading shipping address:", error);
        setAddressError(
          error.response?.data?.message || "Không thể tải địa chỉ đã lưu."
        );
      } finally {
        setIsAddressLoading(false);
      }
    };

    loadShippingAddress();
  }, [userId]);

  useEffect(() => {
    if (formData.province) {
      updateShippingCost(formData.province);
    } else {
      setShippingCost(0);
    }
  }, [formData.province]);

  const shippingRates = {
    "Miền Nam": 10000,
    "Miền Tây": 20000,
    "Miền Trung": 30000,
    "Miền Bắc": 40000,
  };

  const regions = {
    "Miền Bắc": [
      "Hà Nội",
      "Hải Phòng",
      "Quảng Ninh",
      "Bắc Giang",
      "Bắc Ninh",
      "Thái Nguyên",
      "Lạng Sơn",
      "Cao Bằng",
      "Hà Giang",
      "Lào Cai",
      "Yên Bái",
      "Phú Thọ",
      "Tuyên Quang",
      "Bắc Kạn",
      "Điện Biên",
      "Sơn La",
      "Hòa Bình",
    ],
    "Miền Trung": [
      "Đà Nẵng",
      "Huế",
      "Quảng Nam",
      "Quảng Ngãi",
      "Bình Định",
      "Phú Yên",
      "Khánh Hòa",
      "Ninh Thuận",
      "Bình Thuận",
    ],
    "Miền Nam": ["Hồ Chí Minh", "Bình Dương", "Đồng Nai", "Bà Rịa - Vũng Tàu"],
    "Miền Tây": [
      "Cần Thơ",
      "An Giang",
      "Đồng Tháp",
      "Tiền Giang",
      "Vĩnh Long",
      "Bến Tre",
      "Hậu Giang",
      "Kiên Giang",
      "Trà Vinh",
      "Sóc Trăng",
      "Bạc Liêu",
      "Cà Mau",
      "Long An",
    ],
  };

  const buildFullAddress = (data) => {
    return [
      data.detailAddress,
      data.ward,
      data.district,
      data.province,
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(", ");
  };

  const selectedProvinceData = provinces.find(
    (province) => province.name === formData.province
  );
  const districts = selectedProvinceData?.districts || [];
  const selectedDistrictData = districts.find(
    (district) => district.name === formData.district
  );
  const wards = selectedDistrictData?.wards || [];

  const updateShippingCost = (province) => {
    let cost = 0;
    for (let region in regions) {
      if (regions[region].includes(province)) {
        cost = shippingRates[region];
        break;
      }
    }
    setShippingCost(cost);
  };
  const validateAddressForm = () => {
    const newErrors = {};

    if (!formData.receiverName.trim()) {
      newErrors.receiverName = "Vui lòng nhập tên người nhận.";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Vui lòng nhập số điện thoại.";
    }

    if (!formData.province.trim()) {
      newErrors.province = "Vui lòng chọn tỉnh/thành phố.";
    }

    if (!formData.district.trim()) {
      newErrors.district = "Vui lòng chọn quận/huyện.";
    }

    if (!formData.ward.trim()) {
      newErrors.ward = "Vui lòng chọn phường/xã.";
    }

    if (!formData.detailAddress.trim()) {
      newErrors.detailAddress = "Vui lòng nhập địa chỉ chi tiết.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateForm = () => {
    const newErrors = {};

    if (deliveryOption === "delivery") {
      if (!validateAddressForm()) {
        return false;
      }
    } else {
      if (!pickupProvince) {
        newErrors.province = "Vui lòng chọn chi nhánh nhận hàng.";
      }
    }

    // Kiểm tra danh sách thanh toán có sản phẩm không
    if (checkoutItems.length === 0) {
      newErrors.cart = "Danh sách thanh toán đang trống.";
      toast.error(
        "Không có sản phẩm để thanh toán, vui lòng chọn sản phẩm trước khi đặt hàng."
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleProvinceChange = (e) => {
    const value = e.target.value;
    setFormData((prevState) => ({
      ...prevState,
      province: value,
      district: "",
      ward: "",
    }));
    updateShippingCost(value);
  };

  const handleDistrictChange = (e) => {
    const value = e.target.value;
    setFormData((prevState) => ({
      ...prevState,
      district: value,
      ward: "",
    }));
  };

  const handleWardChange = (e) => {
    const value = e.target.value;
    setFormData((prevState) => ({
      ...prevState,
      ward: value,
    }));
  };

  const handlePickupProvinceChange = (e) => {
    setPickupProvince(e.target.value);
  };

  const handleDeliveryOptionChange = (option) => {
    setDeliveryOption(option);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (deliveryOption !== "delivery") {
      toast.info("Vui lòng chọn giao tận nơi để lưu địa chỉ.");
      return;
    }

    if (!validateAddressForm()) {
      toast.error("Vui lòng điền đầy đủ thông tin địa chỉ.");
      return;
    }

    setIsSavingAddress(true);
    try {
      const payload = {
        receiverName: formData.receiverName,
        phone: formData.phone,
        province: deliveryOption === "pickup" ? pickupProvince : formData.province,
        district: formData.district,
        ward: formData.ward,
        detailAddress: formData.detailAddress,
      };

      const response = await updateShippingAddress(payload);
      const savedAddress = response?.data?.shippingAddress;
      const legacyAddress = response?.data?.address || buildFullAddress(payload);

      if (savedAddress) {
        setFormData((prevState) => ({
          ...prevState,
          receiverName: savedAddress.receiverName || prevState.receiverName,
          phone: savedAddress.phone || prevState.phone,
          province: savedAddress.province || prevState.province,
          district: savedAddress.district || prevState.district,
          ward: savedAddress.ward || prevState.ward,
          detailAddress: savedAddress.detailAddress || prevState.detailAddress,
        }));
      }

      if (user) {
        const nextUser = { ...user, address: legacyAddress };
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
      }

      toast.success("Đã lưu địa chỉ giao hàng.");
    } catch (error) {
      console.error("Error saving shipping address:", error);
      toast.error(
        error.response?.data?.message || "Có lỗi khi lưu địa chỉ giao hàng."
      );
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (validateForm()) {
      if (!user) {
        toast.error("Vui lòng đăng nhập để đặt hàng.");
        navigate("/login");
        return;
      }

      setIsSubmitting(true);
      const orderData = {
        user_id: userId,
        items: checkoutItems.map((item) => ({
          product_id: item.product_id?._id || item.product_id,
          quantity: item.quantity,
        })),
        total_price: calculateTotal(),
        status: "pending",
        fullName: formData.receiverName,
        email: formData.email,
        phone: formData.phone,
        address: buildFullAddress(formData),
        province: formData.province,
        deliveryOption: deliveryOption,
        paymentMethod: selectedMethod,
        payment_method: selectedMethod,
        shippingCost: deliveryOption === "pickup" ? 0 : shippingCost,
        voucherId: appliedVoucher?.voucherId || null,
        voucherCode: appliedVoucher?.code || null,
      };

      try {
        // show loading toast
        const loadingToastId = toast.loading("Đang xử lý đơn hàng...");

        // call API đặt hàng
        const response = await createOrder(orderData);
        const createdOrder = response.data;

        // Chỉ xóa những sản phẩm đã chọn thanh toán khỏi giỏ hàng
        if (!isBuyNowMode && userId) {
          if (selectedItems && selectedItems.length > 0) {
            for (const itemId of selectedItems) {
              await removeFromCart(userId, itemId);
            }
          } else {
            await clearCart(userId);
          }
        }

        // Reset form
        setShippingCost(0);
        setDeliveryOption("delivery");
        setSelectedMethod("cod");
        setAppliedVoucher(null);
        setErrors({});

        if ((selectedMethod === "momo" || selectedMethod === "vnpay") && createdOrder?._id) {
          const paymentMethodName = selectedMethod === "momo" ? "MoMo" : "VNPay";
          try {
            toast.update(loadingToastId, {
              render: `Đang tạo liên kết thanh toán ${paymentMethodName}...`,
              type: "info",
              isLoading: true,
            });

            const paymentRes = selectedMethod === "momo" 
              ? await createMomoPayment(createdOrder._id)
              : await createVNPayPayment(createdOrder._id);
            
            console.log("VNPAY/MoMo debug - paymentRes:", paymentRes);
            const payUrl = paymentRes?.data?.payUrl || paymentRes?.data?.paymentUrl;
            console.log("VNPAY/MoMo debug - payUrl:", payUrl);
            if (payUrl) {
              toast.update(loadingToastId, {
                render: `Đặt hàng thành công! Đang chuyển hướng sang ${paymentMethodName}...`,
                type: "success",
                isLoading: false,
                autoClose: 2000,
                closeButton: true,
              });
              setTimeout(() => {
                window.location.href = payUrl;
              }, 1000);
              return;
            } else {
              throw new Error(`Không nhận được URL thanh toán từ ${paymentMethodName}.`);
            }
          } catch (payError) {
            console.error(`Lỗi khi tạo thanh toán ${paymentMethodName}:`, payError);
            toast.update(loadingToastId, {
              render: "Đặt hàng thành công nhưng không tạo được liên kết thanh toán. Vui lòng thanh toán lại trong lịch sử mua hàng.",
              type: "warning",
              isLoading: false,
              autoClose: 6000,
              closeButton: true,
            });
            setTimeout(() => {
              navigate("/userProfile/history");
            }, 3000);
            return;
          }
        }

        // update toast thành công cho COD hoặc PayPal (do PayPal mock đã hoàn tất thanh toán)
        toast.update(loadingToastId, {
          render: "Đặt hàng thành công!",
          type: "success",
          isLoading: false,
          autoClose: 5000,
          closeButton: true,
        });

        setTimeout(() => {
          navigate("/userProfile/history");
        }, 1000);
      } catch (error) {
        console.error("Error submitting order:", error);
        toast.error(
          error.response?.data?.message || "Có lỗi xảy ra khi đặt hàng."
        );
      } finally {
        setIsSubmitting(false);
      }
    } else {
      toast.error("Vui lòng điền đầy đủ thông tin trước khi đặt hàng.");
    }
  };

  const storeLocations = [
    {
      id: 1,
      name: "Trang: 12 Nguyễn Văn Bảo, Quận Gò Vấp, Hồ Chí Minh",
    },
  ];

  const handlePaymentSelection = (method) => {
    setSelectedMethod(method);
  };

  return (
    <MainLayout>

      <Breadcrumb items={links} />
      <div className="max-w-6xl mx-auto px-4 py-8 checkout-page">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Pet Station</h1>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Left checkout */}
          <div className="md:w-3/5">
            <div className="shipping-card">
              <h2 className="shipping-title">THÔNG TIN GIAO HÀNG</h2>

              <div className="mb-5">
                <div
                  className={`border ${deliveryOption === "delivery"
                    ? "border-blue-0"
                    : "border-gray-300"
                    } rounded p-3 mb-3 cursor-pointer`}
                  onClick={() => handleDeliveryOptionChange("delivery")}
                >
                  <div className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-6 h-6 border-2 ${deliveryOption === "delivery"
                        ? "border-blue-0"
                        : "border-gray-300"
                        } rounded-full mr-2`}
                    >
                      <div
                        className={`w-3 h-3 ${deliveryOption === "delivery"
                          ? "bg-blue-0"
                          : "bg-transparent"
                          } rounded-full`}
                      ></div>
                    </div>
                    <span className="text-gray-700">Giao tận nơi</span>
                  </div>
                </div>

                <div
                  className={`border ${deliveryOption === "pickup"
                    ? "border-blue-0"
                    : "border-gray-300"
                    } rounded p-3 cursor-pointer`}
                  onClick={() => handleDeliveryOptionChange("pickup")}
                >
                  <div className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-6 h-6 border-2 ${deliveryOption === "pickup"
                        ? "border-blue-0"
                        : "border-gray-300"
                        } rounded-full mr-2`}
                    >
                      <div
                        className={`w-3 h-3 ${deliveryOption === "pickup"
                          ? "bg-blue-0"
                          : "bg-transparent"
                          } rounded-full`}
                      ></div>
                    </div>
                    <span className="text-gray-700">Nhận tại cửa hàng</span>
                  </div>
                </div>
              </div>

              {deliveryOption === "delivery" ? (
                <form className="shipping-form" onSubmit={handleSaveAddress}>
                  <div className="shipping-grid">
                    <div className="shipping-field">
                      <label className="shipping-label">Người nhận</label>
                      <input
                        type="text"
                        name="receiverName"
                        className="shipping-input"
                        placeholder="Nguyễn Văn Nam"
                        value={formData.receiverName}
                        onChange={handleInputChange}
                        disabled={isAddressLoading}
                      />
                      {errors.receiverName && (
                        <span className="shipping-error">
                          {errors.receiverName}
                        </span>
                      )}
                    </div>

                    <div className="shipping-field">
                      <label className="shipping-label">Số điện thoại</label>
                      <input
                        type="tel"
                        name="phone"
                        className="shipping-input"
                        placeholder="0912345678"
                        value={formData.phone}
                        onChange={handleInputChange}
                        disabled={isAddressLoading}
                      />
                      {errors.phone && (
                        <span className="shipping-error">{errors.phone}</span>
                      )}
                    </div>

                    <div className="shipping-field">
                      <label className="shipping-label">Tỉnh/Thành phố</label>
                      <select
                        name="province"
                        className="shipping-select"
                        value={formData.province}
                        onChange={handleProvinceChange}
                        disabled={isAddressLoading}
                      >
                        <option value="">Chọn tỉnh / thành</option>
                        {provinces.map((province) => (
                          <option key={province.code} value={province.name}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                      {errors.province && (
                        <span className="shipping-error">
                          {errors.province}
                        </span>
                      )}
                    </div>

                    <div className="shipping-field">
                      <label className="shipping-label">Quận/Huyện</label>
                      <select
                        name="district"
                        className="shipping-select"
                        value={formData.district}
                        onChange={handleDistrictChange}
                        disabled={!formData.province || isAddressLoading}
                      >
                        <option value="">Chọn quận / huyện</option>
                        {districts.map((district) => (
                          <option key={district.code} value={district.name}>
                            {district.name}
                          </option>
                        ))}
                      </select>
                      {errors.district && (
                        <span className="shipping-error">
                          {errors.district}
                        </span>
                      )}
                    </div>

                    <div className="shipping-field shipping-full">
                      <label className="shipping-label">Phường/Xã</label>
                      <select
                        name="ward"
                        className="shipping-select"
                        value={formData.ward}
                        onChange={handleWardChange}
                        disabled={!formData.district || isAddressLoading}
                      >
                        <option value="">Chọn phường / xã</option>
                        {wards.map((ward) => (
                          <option key={ward.code} value={ward.name}>
                            {ward.name}
                          </option>
                        ))}
                      </select>
                      {errors.ward && (
                        <span className="shipping-error">{errors.ward}</span>
                      )}
                    </div>

                    <div className="shipping-field shipping-full">
                      <label className="shipping-label">Địa chỉ chi tiết</label>
                      <input
                        type="text"
                        name="detailAddress"
                        className="shipping-input"
                        placeholder="25 Nguyễn Văn Nghi"
                        value={formData.detailAddress}
                        onChange={handleInputChange}
                        disabled={isAddressLoading}
                      />
                      {errors.detailAddress && (
                        <span className="shipping-error">
                          {errors.detailAddress}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shipping-actions">
                    <button
                      type="submit"
                      className="shipping-save"
                      disabled={isSavingAddress || isAddressLoading}
                    >
                      {isSavingAddress ? "ĐANG LƯU..." : "LƯU ĐỊA CHỈ"}
                    </button>
                    {isAddressLoading && (
                      <span className="shipping-hint">Đang tải địa chỉ...</span>
                    )}
                    {addressError && (
                      <span className="shipping-error">{addressError}</span>
                    )}
                  </div>
                </form>
              ) : (
                <div className="mb-6">
                  <div className="mb-4">
                    <div className="relative">
                      <select
                        name="province"
                        className="w-full border border-gray-300 rounded p-3 bg-white appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={pickupProvince}
                        onChange={handlePickupProvinceChange}
                        required={deliveryOption === "pickup"}
                      >
                        <option value="" disabled>
                          Chọn tỉnh / thành
                        </option>
                        <option value="hcm">TP Hồ Chí Minh</option>
                      </select>

                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDown />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">
                      Chi nhánh còn hàng
                    </h3>
                    <div className="border border-gray-200 rounded p-4">
                      {storeLocations.map((store) => (
                        <div key={store.id} className="flex items-center">
                          <div className="flex items-center justify-center w-6 h-6 bg-blue-0 rounded-full mr-2 text-white">
                            <CheckCheck size={16} color="white" />
                          </div>
                          <span className="text-gray-700">{store.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {deliveryOption === "delivery" && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-800 mb-5">
                    Phương thức vận chuyển
                  </h3>
                  {formData.province && (
                    <div className="flex justify-between shipping-cost border rounded p-3 ">
                      <span>Phí vận chuyển: </span>
                      <strong>{shippingCost.toLocaleString("vi-VN")}đ</strong>
                    </div>
                  )}

                  {!formData.province && (
                    <div className="flex items-center justify-center border border-gray-200 rounded p-8">
                      <div className="text-center">
                        <div className="mb-4 flex justify-center">
                          <BsBox2 size={90} className="text-gray-500" />
                        </div>
                        <p className="text-gray-600">
                          Vui lòng chọn tỉnh / thành để có danh sách phương thức
                          vận chuyển.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <h2 className="text-lg font-semibold mt-8 mb-4">
              Phương thức thanh toán
            </h2>

            <div
              className={`border p-4 rounded-lg flex items-center space-x-3 cursor-pointer ${selectedMethod === "cod"
                ? "border-blue-0 bg-blue-100"
                : "border-gray-300"
                }`}
              onClick={() => handlePaymentSelection("cod")}
            >
              <input
                type="radio"
                name="payment"
                value="cod"
                checked={selectedMethod === "cod"}
                onChange={() => handlePaymentSelection("cod")}
              />
              <img src={boxCard} alt="COD" width="30" />
              <span>Thanh toán khi giao hàng (COD)</span>
            </div>

            <div
              className={`border p-4 rounded-lg flex items-center space-x-3 cursor-pointer mt-3 ${selectedMethod === "momo"
                ? "border-blue-0 bg-blue-100"
                : "border-gray-300"
                }`}
              onClick={() => handlePaymentSelection("momo")}
            >
              <input
                type="radio"
                name="payment"
                value="momo"
                checked={selectedMethod === "momo"}
                onChange={() => handlePaymentSelection("momo")}
              />
              <div className="w-8 h-8 rounded bg-[#ff5f06] text-white flex items-center justify-center font-bold text-[9px] shadow-sm" style={{ minWidth: '32px' }}>
                MoMo
              </div>
              <span>Thanh toán qua Ví MoMo</span>
            </div>

            <div
              className={`border p-4 rounded-lg flex items-center space-x-3 cursor-pointer mt-3 ${selectedMethod === "vnpay"
                ? "border-blue-0 bg-blue-100"
                : "border-gray-300"
                }`}
              onClick={() => handlePaymentSelection("vnpay")}
            >
              <input
                type="radio"
                name="payment"
                value="vnpay"
                checked={selectedMethod === "vnpay"}
                onChange={() => handlePaymentSelection("vnpay")}
              />
              <div className="w-8 h-8 rounded bg-[#003087] text-white flex items-center justify-center font-bold text-[9px] shadow-sm" style={{ minWidth: '32px' }}>
                VNPay
              </div>
              <span>Thanh toán qua VNPay</span>
            </div>
          </div>
          {/* Right Checkout */}
          <div className="md:w-2/5 bg-gray-50 rounded-lg p-6">
            {/* Product list */}

            <div className="border-b border-gray-200 pb-6 mb-4">
              {checkoutItems.map((item, index) => (
                <div key={index} className="flex items-start mb-4">
                  <div className="relative mr-4">
                    <div className="bg-gray-200 rounded w-16 h-16 flex items-center justify-center relative">
                      <img
                        src={item.product_id?.images?.[0]}
                        alt={item.product_id?.name}
                        className="h-12 w-12 object-contain"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm">{item.product_id?.name}</h3>
                    <p className="text-gray-500 text-xs">SL: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">
                      {(
                        (item.product_id?.price || 0) * item.quantity
                      ).toLocaleString()}
                      ₫
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Voucher Selector */}
            <div className="mb-4">
              <CheckoutVoucherSelector
                cartItems={checkoutItems}
                shippingCost={shippingCost}
                deliveryOption={deliveryOption}
                appliedVoucher={appliedVoucher}
                onApplyVoucher={setAppliedVoucher}
                onRemoveVoucher={() => setAppliedVoucher(null)}
              />
            </div>

            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Tạm tính</span>
                <span>{subtotal.toLocaleString()}₫</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Phí vận chuyển </span>
                <strong>
                  {deliveryOption === "pickup"
                    ? "0đ"
                    : `${shippingCost.toLocaleString()}đ`}
                </strong>
              </div>
              {appliedVoucher && (
                <div className="flex justify-between mb-2 text-rose-600 font-semibold">
                  <span>Giảm giá Voucher</span>
                  <span>-{appliedVoucher.discountAmount.toLocaleString()}đ</span>
                </div>
              )}
              <div className="flex justify-between items-center font-semibold text-lg pt-4 border-t border-gray-200">
                <span>Tổng cộng</span>
                <div className="text-right">
                  <span className="text-gray-500 text-sm mr-1">VND</span>
                  <span>{calculateTotal().toLocaleString()}đ</span>
                </div>
              </div>
            </div>
            <button
              type="submit"
              className={`w-full cursor-pointer bg-blue-0 text-white py-3 px-4 rounded text-center hover:bg-blue-600 transition ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang xử lý đơn hàng..." : "Đặt hàng"}
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default CheckOut;
