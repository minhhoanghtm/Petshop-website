import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home/Home";
import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import ProductDetail from "../pages/Product/ProductDetail";
import Search from "../pages/Search/Search";
import CartShop from "../pages/CartShop/CartShop";
import CheckOut from "../pages/Checkout/CheckOut";
import UserProfile from "../pages/User/UserProfile";
import ProfileTab from "../pages/User/components/ProfileTab";
import ShippingTab from "../pages/User/components/ShippingTab";
import HistoryTab from "../pages/User/components/HistoryTab";
import News from "../pages/News/News";
import NewsDetail from "../pages/News/NewsDetail";
import NotFoundPage from "../pages/Error/NotFoundPage";
import UserManagement from "../pages/User/UserManagement";
import Category from "../pages/Category/Category";
import Dashboard from "../pages/Dashboard/Dashboard";
import Settings from "../pages/Setting/Settings";
import OrderManagement from "../pages/Order/OrderManagement";
import InventoryManagement from "../pages/Product/InventoryManagement";
import CategoryManagement from "../pages/Category/CategoryManagement";
import UsersPage from "../pages/Admin/UsersPage";
import VouchersPage from "../pages/Admin/VouchersPage";
import ContactUs from "../pages/ContactUs/ContactUs";
import ForgotPassword from "../pages/ForgotPassWord";
import ProtectedRoute from "./ProtectedRoute";
import ConsumerRoute from "./ConsumerRoute";
import MyReviews from "../pages/Review/MyReviews";
import ReviewPage from "../pages/Review/ReviewPage";
import VoucherCenter from "../pages/User/VoucherCenter";
import VoucherTab from "../pages/User/components/VoucherTab";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="*" element={<NotFoundPage />} />
      <Route path="/" element={<ConsumerRoute><Home /></ConsumerRoute>} />
      <Route path="/login" element={<ConsumerRoute><Login /></ConsumerRoute>} />
      <Route path="/register" element={<ConsumerRoute><Register /></ConsumerRoute>} />
      <Route path="/product/:slug" element={<ConsumerRoute><ProductDetail /></ConsumerRoute>} />
      <Route path="/search" element={<ConsumerRoute><Search /></ConsumerRoute>} />
      <Route path="/cart" element={<ConsumerRoute><CartShop /></ConsumerRoute>} />
      <Route path="/checkout" element={<ConsumerRoute><CheckOut /></ConsumerRoute>} />
      <Route path="/vouchers" element={<ConsumerRoute><VoucherCenter /></ConsumerRoute>} />
      <Route path="/userProfile" element={<ConsumerRoute><UserProfile /></ConsumerRoute>}>
        <Route index element={<ProfileTab />} />
        <Route path="profile" element={<ProfileTab />} />
        <Route path="shipping" element={<ShippingTab />} />
        <Route path="history" element={<HistoryTab />} />
        <Route path="vouchers" element={<VoucherTab />} />
      </Route>
      <Route path="/my-reviews" element={<ConsumerRoute><MyReviews /></ConsumerRoute>} />
      <Route path="/review/:productId/:orderId" element={<ConsumerRoute><ReviewPage /></ConsumerRoute>} />
      <Route path="/blogs/news" element={<ConsumerRoute><News /></ConsumerRoute>} />
      <Route path="/blogs/news/:slug" element={<ConsumerRoute><NewsDetail /></ConsumerRoute>} />
      <Route path="/categories/:slug" element={<ConsumerRoute><Category /></ConsumerRoute>} />
      <Route
        path="/user-management"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/vouchers"
        element={
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <VouchersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/order-management"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <OrderManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory-management"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <InventoryManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <CategoryManagement />
          </ProtectedRoute>
        }
      />
      <Route path="/contactus" element={<ConsumerRoute><ContactUs /></ConsumerRoute>} />
      <Route path="/forgot-password" element={<ConsumerRoute><ForgotPassword /></ConsumerRoute>} />
    </Routes>
  );
};

export default AppRoutes;
