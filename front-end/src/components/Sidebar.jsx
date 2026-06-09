import { Home, Users, Settings, LogOut, Bell, Layers } from "lucide-react";
import { FaBell } from "react-icons/fa";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { RiGalleryView2 } from "react-icons/ri";
import { MdOutlineInventory2 } from "react-icons/md";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import LoadingOverlay from "./LoadingOverlay";
import "./darkMode.scss";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { toast } from "react-toastify"; // Thêm import toast
import { signOut } from "../services/authService";

const Sidebar = ({ sidebarOpen, setSidebarOpen, currentUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  const convertBase64ToImage = (base64) => {
    if (!base64) return "/avatar.png";
    return `data:image/jpeg;base64,${base64}`;
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success("Đăng xuất thành công!");

      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      setTimeout(() => {
        setIsLoggingOut(false);
        navigate("/");
      }, 2000);
    } catch (err) {
      console.error("Logout Error:", err.response?.data || err.message);
      // Still logout on error
      localStorage.removeItem("accessToken");
      toast.error("Đăng xuất thất bại. Vui lòng thử lại!");
      setIsLoggingOut(false);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("darkMode", newMode);
      document.body.classList.toggle("dark-theme", newMode);
      return newMode;
    });
  };

  useEffect(() => {
    const isDark = localStorage.getItem("darkMode") === "true";
    document.body.classList.toggle("dark-theme", isDark);
    setDarkMode(isDark);
  }, []);

  const navItems = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: <Home size={18} className="mr-3" />,
    },
    {
      path: "/user-management",
      label: "Quản lý người dùng",
      icon: <Users size={18} className="mr-3" />,
    },
    {
      path: "/admin/categories",
      label: "Quản lý danh mục",
      icon: <Layers size={18} className="mr-3" />,
    },
    {
      path: "/inventory-management",
      label: "Quản lý sản phẩm",
      icon: <MdOutlineInventory2 size={18} className="mr-3" />,
    },
    {
      path: "/order-management",
      label: "Quản lý đơn hàng",
      icon: <RiGalleryView2 size={18} className="mr-3" />,
    },
    {
      path: "/settings",
      label: "Cài đặt",
      icon: <Settings size={18} className="mr-3" />,
    },
  ];

  return (
    <>
      <LoadingOverlay isVisible={isLoggingOut} />
      <aside
        className={`${sidebarOpen ? "w-64" : "w-20"
          } hidden md:flex flex-col transition-all duration-300 ease-in-out`}
      >
        <div className="flex items-center justify-between p-4 sidebar-header">
          {sidebarOpen ? (
            <>
              <Link to="/">
                <h1 className="text-xl font-bold">Pet Station Shop</h1>
              </Link>
            </>
          ) : (
            <img
              src={convertBase64ToImage(currentUser?.avatar)}
              alt={currentUser?.fullName || "User"}
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sidebar-toggle-btn cursor-pointer"
          >
            {sidebarOpen ? <FaChevronLeft /> : <FaChevronRight />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <ul className="p-2 space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center p-2 ${location.pathname === item.path
                      ? "nav-item-active"
                      : "nav-item"
                    }`}
                >
                  {item.icon}
                  {sidebarOpen && item.label}
                </Link>
              </li>
            ))}
          </ul>

          {sidebarOpen && currentUser && (
            <div className="p-4 sidebar-footer mt-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img
                    src={convertBase64ToImage(currentUser.avatar)}
                    alt={currentUser.fullName || "User"}
                    className="w-8 h-8 rounded-full mr-2 object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium user-name">
                      {currentUser.fullName || "Unknown User"}
                    </p>
                    <p className="text-xs user-email">
                      {currentUser.email || "No email"}
                    </p>
                  </div>
                </div>
                <button className="relative notification-btn cursor-pointer">
                  <FaBell size={18} />
                  {/* <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    3
                  </span> */}
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex items-center text-sm cursor-pointer logout-btn"
                >
                  <LogOut size={16} className="mr-2" />
                  Đăng xuất
                </button>
                {/* <button
                  onClick={toggleDarkMode}
                  className="text-sm theme-toggle-btn cursor-pointer"
                >
                  {darkMode ? (
                    <MdLightMode size={25} />
                  ) : (
                    <MdDarkMode size={25} />
                  )}
                </button> */}
              </div>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
