import logo from "/pet.png";
import { useState, useEffect, useRef, useCallback } from "react";
import "./component.scss";
import { FaCaretDown, FaPhone } from "react-icons/fa6";
import {
  FaSearch,
  FaShoppingCart,
  FaUser,
  FaShoppingBag,
  FaHistory,
  FaSignOutAlt,
} from "react-icons/fa";
import { IoMdMenu, IoIosClose } from "react-icons/io";
import { RiMenu3Fill, RiAdminFill } from "react-icons/ri";
import { MdDashboardCustomize } from "react-icons/md";
import { Link, useNavigate } from "react-router-dom";
import PopupMenu from "./PopupMenu";
import HoverPopupMenu from "./HoverPopupMenu";
import LoadingOverlay from "./LoadingOverlay";
import { useSelector } from "react-redux";
import DialogCart from "./DialogCart";
import PopupSearch from "./PopupSearch";
import CartButton from "./CartButton";
import { useCart } from "../context/CartContext";
import { toast } from "react-toastify";
import { fetchCategories as fetchCategoriesRequest } from "../services/categoryService";
import { fetchProfile as fetchProfileRequest } from "../services/userService";
import { signOut as signOutRequest } from "../services/authService";
import { searchProducts as searchProductsRequest } from "../services/productService";

const Header = () => {
  const { fetchCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState({
    name: "",
    avatar: "",
    role: "",
    id: "",
  });
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPopupSearch, setShowPopupSearch] = useState(false);
  const searchRef = useRef(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const headerRef = useRef(null);
  // useEffect(() => {
  //   const handleScroll = () => {
  //     if (window.scrollY > 100) {
  //       setIsScrolled(true);
  //     } else {
  //       setIsScrolled(false);
  //     }
  //   };

  //   window.addEventListener("scroll", handleScroll);
  //   return () => window.removeEventListener("scroll", handleScroll);
  // }, []);


  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMenuOpen(false);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const convertBase64ToImage = useCallback((value) => {
    if (!value) return "/avatar.png";
    if (typeof value !== "string") return "/avatar.png";
    if (value.startsWith("data:image")) return value;
    if (value.startsWith("/") || value.startsWith("http")) return value;
    return `data:image/jpeg;base64,${value}`;
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data } = await fetchCategoriesRequest();
        setCategories(data);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
        // Don't redirect on error - categories loading failure shouldn't affect navigation
        if (err.response?.status === 401) {
          // Silently ignore 401 for public endpoints
          return;
        }
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) return; // Don't call API if no token

      const cachedUser = JSON.parse(localStorage.getItem("user") || "null");
      if (cachedUser) {
        const cachedAvatar = convertBase64ToImage(cachedUser.avatar);
        setUser({
          name: cachedUser.fullName,
          avatar: cachedAvatar,
          role: cachedUser.role,
          id: cachedUser._id || cachedUser.id,
        });
        setLoggedIn(true);
        setIsAdmin(cachedUser.role === "admin");
      }

      try {
        const { data } = await fetchProfileRequest();
        const userData = data;

        userData.avatar = convertBase64ToImage(userData.avatar);
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...data,
            id: data._id || data.id,
          }),
        );
        setUser({
          name: userData.fullName,
          avatar: userData.avatar,
          role: userData.role,
          id: userData._id,
        });

        if (userData.role === "admin") {
          setIsAdmin(true);
        }

        setLoggedIn(true);
      } catch (err) {
        const status = err.response?.status;
        if (status && status !== 401) {
          console.error("API Error:", err.response?.data || err.message);
        }

        if (status === 401) {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("user");
          setLoggedIn(false);
          setIsAdmin(false);
        }
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchCart(user.id);
    }
  }, [user?.id]);

  const fetchSearchResults = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await searchProductsRequest(query);
      setSearchResults(response.data);
    } catch (err) {
      console.error("Failed to fetch search results:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getAdaptiveSearchDelay = () => {
    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (!connection) {
      return 300;
    }

    const typeDelayMap = {
      "slow-2g": 1200,
      "2g": 1000,
      "3g": 650,
      "4g": 250,
    };

    const typeDelay = typeDelayMap[connection.effectiveType] || 300;
    const rttDelay = connection.rtt ? Math.round(connection.rtt * 1.5) : 0;

    return Math.min(1200, Math.max(200, Math.max(typeDelay, rttDelay)));
  };

  useEffect(() => {
    const debounceDelay = getAdaptiveSearchDelay();
    const debounceTimer = setTimeout(() => {
      if (searchTerm.trim()) {
        fetchSearchResults(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, debounceDelay);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  useEffect(() => {
    const savedHistory = localStorage.getItem("searchHistory");
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error("Failed to parse search history:", error);
        localStorage.removeItem("searchHistory");
      }
    }
  }, []);

  const saveToHistory = (term) => {
    if (!term.trim()) return;

    const newHistory = [
      term,
      ...searchHistory.filter((item) => item !== term),
    ].slice(0, 5);

    setSearchHistory(newHistory);
    localStorage.setItem("searchHistory", JSON.stringify(newHistory));
  };

  const handleClearHistory = () => {
    localStorage.removeItem("searchHistory");
    setSearchHistory([]);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target) &&
        !event.target.closest(".popup-search-container")
      ) {
        setShowPopupSearch(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOutRequest();

      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      setUser({ name: "", avatar: "", role: "", id: "" });
      setLoggedIn(false);
      setIsAdmin(false);

      setTimeout(() => {
        toast.success("Đăng xuất thành công!");
        navigate("/");
        setIsLoggingOut(false);
      }, 700);
    } catch (err) {
      console.error("Logout Error:", err.response?.data || err.message);
      // Still logout on error
      localStorage.removeItem("accessToken");
      setLoggedIn(false);
      toast.error("Đăng xuất thất bại. Vui lòng thử lại!");
      setIsLoggingOut(false);
    }
  };

  const handleSearch = (term) => {
    if (!term.trim()) return;

    saveToHistory(term);
    setSearchTerm(term);
    setShowPopupSearch(false);
    navigate(`/search?q=${term}`);
  };

  const handleSearchResultClick = (result) => {
    if (!result) return;

    if (result.name) {
      saveToHistory(result.name);
      setSearchTerm(result.name);
    }

    if (
      result.price !== undefined ||
      (result.images && result.images.length > 0)
    ) {
      navigate(`/product/${result.slug}`);
    } else if (result.category_id && result.category_id.slug) {
      navigate(`/categories/${result.category_id.slug}`);
    } else if (result.slug) {
      navigate(`/categories/${result.slug}`);
    }

    setShowPopupSearch(false);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchTerm.trim()) {
      handleSearch(searchTerm);
    }
  };

  const handleHistoryItemClick = (term) => {
    setSearchTerm(term);
    fetchSearchResults(term);
  };

  const menuOptionsCategories = categories.map((category) => ({
    label: category.name,
    href: `/categories/${category.slug}`,
  }));

  const menuOptionsCategoriesCat = categories
    .filter((category) => category.type === "SHOP CHO MÈO")
    .map((category) => ({
      label: category.name,
      href: `/categories/${category.slug}`,
    }));

  const menuOptionsCategoriesDog = categories
    .filter((category) => category.type === "SHOP CHO CÚN")
    .map((category) => ({
      label: category.name,
      href: `/categories/${category.slug}`,
    }));

  const menuOptionsUser = [
    {
      label: "Tài khoản của bạn",
      icon: <FaUser className="mr-2" />,
      href: `/userProfile`,
    },
    {
      label: "Đăng xuất",
      icon: <FaSignOutAlt className="mr-2" />,
      onClick: handleLogout,
    },
  ];

  const menuOptionsAdmin = [
    {
      label: "Tài khoản của bạn",
      icon: <FaUser className="mr-2" />,
      href: `/userProfile`,
    },
    // {
    //   label: "Thống kê",
    //   icon: <MdDashboardCustomize className="mr-2" />,
    //   href: `/dashboard/`,
    // },

    // {
    //   label: "Quản lý người dùng",
    //   icon: <RiAdminFill className="mr-2" />,
    //   href: `/user-management`,
    // },
    ...(isAdmin
      ? [
        {
          label: "Quản lý cửa hàng",
          icon: <RiAdminFill className="mr-2" />,
          href: `/dashboard`,
        },
      ]
      : []),
    {
      label: "Đăng xuất",
      icon: <FaSignOutAlt className="mr-2" />,
      onClick: handleLogout,
    },
  ];

  return (
    <header
      className="bg-white shadow-md sticky top-0 z-[10000] overflow-visible"
      ref={headerRef}
    >
      <LoadingOverlay isVisible={isLoggingOut} />
      <div className="relative z-[200]">
        <div className="container mx-auto flex flex-wrap items-center justify-evenly py-2 px-4 md:px-8 lg:px-16">
          {/* logo */}
          <div className="flex items-center space-x-3">
            <Link to="/">
              <img
                src={logo}
                alt="Logo Pet Shop"
                className="h-17 w-17 object-cover"
              />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                PET STATION SHOP
              </h1>
              <p className="text-sm text-brown mx-4">The happy store for pet</p>
            </div>
          </div>

          {/* mobile menu button & cart */}
          <div className="flex items-center space-x-4 md:hidden ml-auto">
            <CartButton idUser={user.id} />
            <button
              className="md:hidden text-gray-700 focus:outline-none ml-auto cursor-pointer relative"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <RiMenu3Fill className="text-2xl" />
            </button>
          </div>

          {/* search bar & links */}
          {!isMobile && (
            <>
              <div
                className="flex items-center w-full max-w-md lg:max-w-lg relative"
                ref={searchRef}
                style={{ position: "relative" }}
              >
                <input
                  type="text"
                  placeholder="Nhập từ khóa tìm kiếm"
                  className="w-full px-4 py-2 border-brown rounded-l-full focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => setShowPopupSearch(true)}
                />
                <Link to="/search" className="">
                  <button
                    className="bg-brown px-4 py-2 text-white rounded-full focus:outline-none w-14 h-13 relative -left-4 flex items-center justify-center cursor-pointer"
                    onClick={() => handleSearch(searchTerm)}
                  >
                    <FaSearch className="text-lg" />
                  </button>
                </Link>

                {showPopupSearch && !isMobile && (
                  <PopupSearch
                    searchResults={searchResults}
                    searchHistory={searchHistory}
                    onSearch={handleSearchResultClick}
                    onHistoryItemClick={handleHistoryItemClick}
                    onClearHistory={handleClearHistory}
                  />
                )}
              </div>
              {/* user */}
              <div className="flex items-center space-x-4 cursor-pointer user-menu">
                {loggedIn ? (
                  isAdmin ? (
                    <PopupMenu
                      trigger={
                        <div className="flex items-center space-x-2 cursor-pointer z-50">
                          <img
                            src={user.avatar}
                            alt="User avatar"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <span
                            className="text-gray-700 text-sm font-medium text-brown-hover"
                            style={{ fontSize: "1.1rem" }}
                          >
                            {user.name}
                          </span>
                        </div>
                      }
                      options={menuOptionsAdmin}
                      menuType="menuOptionsUser"
                    />
                  ) : (
                    <PopupMenu
                      trigger={
                        <div className="flex items-center space-x-2 cursor-pointer">
                          <img
                            src={user.avatar}
                            alt="User avatar"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <span
                            className="text-gray-700 text-sm font-medium text-brown-hover"
                            style={{ fontSize: "1.1rem" }}
                          >
                            {user.name}
                          </span>
                        </div>
                      }
                      options={menuOptionsUser}
                      menuType="menuOptionsUser"
                    />
                  )
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="text-gray-700 text-sm text-brown-hover"
                    >
                      ĐĂNG KÝ
                    </Link>
                    <span className="text-brown mb-1">|</span>
                    <Link
                      to="/login"
                      className="text-gray-700 text-sm text-brown-hover"
                    >
                      ĐĂNG NHẬP
                    </Link>
                  </>
                )}
                <CartButton idUser={user.id} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative z-[100]">
        {/* nav bar */}
        <nav className={`border-none ${isMobile ? "hidden" : ""}`}>
          <div className="container mx-auto -mt-1 flex flex-wrap items-center justify-evenly px-4 py-1 lg:px-16">
            <div className="relative group">
              <PopupMenu
                trigger={
                  <button className="flex items-center space-x-3 bg-brown w-65 h-12 text-white px-5 rounded-lg focus:outline-none cursor-pointer">
                    <IoMdMenu className="text-2xl" />
                    <span className="font-semibold text-2sm">
                      DANH MỤC SẢN PHẨM
                    </span>
                  </button>
                }
                options={menuOptionsCategories}
                menuType="menuOptionsCategories"
              />
            </div>

            <div className="hidden lg:flex space-x-8">
              <HoverPopupMenu
                trigger={
                  <a
                    href="#"
                    className="text-gray-700 flex items-center text-brown-hover"
                  >
                    SHOP CHO CÚN
                    <FaCaretDown className="ml-2 text-lg " />
                  </a>
                }
                options={menuOptionsCategoriesDog}
                menuType="menuOptionsDog"
              />

              <HoverPopupMenu
                trigger={
                  <a
                    href="#"
                    className="text-gray-700 flex items-center text-brown-hover"
                  >
                    SHOP CHO MÈO
                    <FaCaretDown className="ml-2 text-lg" />
                  </a>
                }
                options={menuOptionsCategoriesCat}
                menuType="menuOptionsCat"
              />
              <a href="/blogs/news" className="text-gray-700 text-brown-hover">
                TIN TỨC
              </a>
              <Link to="/vouchers" className="text-gray-700 text-brown-hover">
                VOUCHER
              </Link>
              <Link to="/contactus" className="text-gray-700 text-brown-hover">
                VỀ CHÚNG TÔI
              </Link>
            </div>

            <div className="flex items-center space-x-2 mt-4 lg:mt-0">
              <FaPhone className="text-lg text-brown" />
              <span className="font-medium">
                Hotline:
                <span className="text-red text-brown-hover cursor-pointer">
                  {" "}
                  0915020903
                </span>
              </span>
            </div>
          </div>
        </nav>
      </div>

      {/* overlay */}
      {menuOpen && (
        <div className="overlay" onClick={() => setMenuOpen(false)} />
      )}

      {/* mobile hidden menu */}
      <div className={`hidden-menu ${menuOpen ? "open" : ""}`}>
        <div className="flex justify-end mt-2">
          <button
            onClick={() => setMenuOpen(false)}
            className="text-gray-700 text-xl focus:outline-none cursor-pointer"
          >
            <IoIosClose className="text-4xl" />
          </button>
        </div>
        <ul>
          <li
            className="flex items-center w-full relative pb-4"
            ref={searchRef}
          >
            <div className="flex w-full relative">
              <input
                type="text"
                placeholder="Nhập từ khóa tìm kiếm"
                className="w-full px-4 py-2 border-brown rounded-l-full focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setShowPopupSearch(true)}
              />
              <button
                className="bg-brown px-4 py-2 text-white rounded-full focus:outline-none w-14 h-10 relative -left-4 flex items-center justify-center cursor-pointer"
                onClick={() => handleSearch(searchTerm)}
              >
                <FaSearch className="text-lg" />
              </button>
            </div>
            {showPopupSearch && (
              <PopupSearch
                searchResults={searchResults}
                searchHistory={searchHistory}
                onSearch={handleSearchResultClick}
                onHistoryItemClick={handleHistoryItemClick}
                onClearHistory={handleClearHistory}
              />
            )}
          </li>
          {loggedIn ? (
            <PopupMenu
              trigger={
                <div className="flex items-center space-x-2 cursor-pointer">
                  <img
                    src={user.avatar}
                    alt="User avatar"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <span
                    className="text-gray-700 text-sm font-medium text-brown-hover"
                    style={{ fontSize: "1.1rem" }}
                  >
                    {user.name}
                  </span>
                </div>
              }
              options={menuOptionsUser}
              menuType="menuOptionsUser"
            />
          ) : (
            <>
              <li className="py-3">
                <Link
                  to="/register"
                  className="block text-gray-700 text-sm text-brown-hover"
                >
                  ĐĂNG KÝ
                </Link>
              </li>
              <li className="py-3">
                <Link
                  to="/login"
                  className="block text-gray-700 text-sm text-brown-hover"
                >
                  ĐĂNG NHẬP
                </Link>
              </li>
            </>
          )}

          <li className="pt-5">
            <Link
              href="#"
              className="text-gray-700 flex items-center text-brown-hover"
            >
              SHOP CHO CÚN
              <FaCaretDown className="ml-2 text-lg" />
            </Link>
          </li>
          <li className="py-1">
            <Link
              href="#"
              className="text-gray-700 flex items-center text-brown-hover"
            >
              SHOP CHO MÈO
              <FaCaretDown className="ml-2 text-lg" />
            </Link>
          </li>
          <li className="py-1">
            <Link
              href="/blogs/news"
              className="block text-gray-700 text-sm text-brown-hover"
            >
              TIN TỨC
            </Link>
          </li>
          <li className="py-1">
            <Link
              to="/vouchers"
              className="block text-gray-700 text-sm text-brown-hover"
            >
              MÃ GIẢM GIÁ
            </Link>
          </li>
          <li className="py-1">
            <Link
              href="/contactus"
              className="block text-gray-700 text-sm text-brown-hover"
            >
              VỀ CHÚNG TÔI
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
};

export default Header;
