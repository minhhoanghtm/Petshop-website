import { useEffect, useState } from "react";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { CiMenuFries } from "react-icons/ci";
import { useNavigate } from "react-router-dom";

const TopNavigation = ({ setMobileSidebarOpen, currentUser }) => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");

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

  const handleBack = () => {
    const hasHistory = window.history.state?.idx > 0 || window.history.length > 1;
    if (hasHistory) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  const convertBase64ToImage = (base64) => {
    if (!base64) return "/avarar.png";
    return `data:image/jpeg;base64,${base64}`;
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            className="md:hidden text-gray-500"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <CiMenuFries size={24} />
          </button>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 text-gray-500 hover:text-gray-700 cursor-pointer"
            aria-label={darkMode ? "Tắt chế độ tối" : "Bật chế độ tối"}
            title={darkMode ? "Tắt chế độ tối" : "Bật chế độ tối"}
          >
            {darkMode ? <MdLightMode size={22} /> : <MdDarkMode size={22} />}
          </button>
          <div className="flex items-center">
            <img
              src={convertBase64ToImage(currentUser?.avatar)}
              alt={currentUser?.fullName || "User"}
              className="w-8 h-8 rounded-full mr-2"
            />
            <span className="hidden md:inline text-lg font-medium">
              {currentUser?.fullName || "Admin"}{" "}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavigation;
