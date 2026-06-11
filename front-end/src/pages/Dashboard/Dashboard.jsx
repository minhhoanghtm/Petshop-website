import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart2,
  Bell,
  Upload,
  Download,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import TopNavigation from "../../components/TopNavigation";
import LoadingSpinner from "../../components/LoadingSpinner";
import { toast } from "react-toastify";
import Chart from "react-apexcharts";
import {
  fetchDashboardStats,
  fetchRecentOrders,
  fetchNotifications,
  fetchRevenueByDay,
  fetchRevenueByCategory,
  importOrders as importOrdersRequest,
} from "../../services/dashboardService";
import { fetchUserById as fetchUserByIdRequest, fetchUsersPaginated as fetchUsersPaginatedRequest } from "../../services/userService";
import { fetchProducts as fetchProductsRequest } from "../../services/productService";

const Dashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    averageOrderValue: 0,
    totalOrders: 0,
    activeUsers: 0,
    lowStockProducts: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [revenueByDay, setRevenueByDay] = useState({
    categories: [],
    data: [],
  });
  const [revenueByCategory, setRevenueByCategory] = useState({
    labels: [],
    data: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState("7days");
  const [isDarkTheme, setIsDarkTheme] = useState(
    document.documentElement.classList.contains("dark-theme")
  );
  const navigate = useNavigate();

  // Fetch current user
  const fetchCurrentUser = useCallback(async () => {
    try {
      const userLocal = JSON.parse(localStorage.getItem("user"));
      if (!userLocal || !userLocal._id) throw new Error("No user found");
      const response = await fetchUserByIdRequest(userLocal._id);
      setCurrentUser(response.data);
    } catch (err) {
      console.error("Failed to fetch current user:", err.message);
      setCurrentUser({
        fullName: "",
        email: "",
        avatar: "",
        role: "",
      });
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = { timeFilter };

      const [
        statsResponse,
        ordersResponse,
        notificationsResponse,
        revenueByDayResponse,
        revenueByCategoryResponse,
        usersResponse,
        productsResponse,
      ] = await Promise.all([
        fetchDashboardStats(params),
        fetchRecentOrders({ limit: 5 }),
        fetchNotifications(params),
        fetchRevenueByDay(params),
        fetchRevenueByCategory(params),
        fetchUsersPaginatedRequest({ page: 1, limit: 1 }),
        fetchProductsRequest(),
      ]);

      const activeUsers = usersResponse.data.stats?.active ?? 0;
      const lowStockProducts = productsResponse.data.filter(
        (product) => product.stock <= 10
      ).length;

      setStats({
        ...statsResponse.data,
        activeUsers,
        lowStockProducts,
      });
      setRecentOrders(ordersResponse.data); // data đã có customer từ backend
      setNotifications(notificationsResponse.data);
      setRevenueByDay(revenueByDayResponse.data);
      setRevenueByCategory(revenueByCategoryResponse.data);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err.message);
      toast.error("Không thể tải dữ liệu dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    fetchCurrentUser();
    fetchDashboardData();
  }, [fetchCurrentUser, fetchDashboardData]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.classList.contains("dark-theme"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Lấy giá trị màu từ biến CSS
  const getCSSVariable = (variable) => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
  };

  // Chart configurations
  const textColor = isDarkTheme
    ? getCSSVariable("--text-white") : getCSSVariable("--text-color");
  const secondaryTextColor = isDarkTheme ? "#666" : "#999";

  const barChartOptions = {
    chart: {
      id: "revenue-by-day",
      toolbar: { show: false },
      foreColor: textColor, // Màu chữ chính (nhãn trục, tooltip)
    },
    xaxis: {
      categories: revenueByDay.categories,
      labels: {
        rotate: timeFilter === "30days" || timeFilter === "90days" ? -45 : 0,
        style: {
          fontSize: "12px",
          colors: secondaryTextColor, // Màu nhãn trục x
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (val) => formatCurrency(val),
        style: {
          fontSize: "12px",
          colors: secondaryTextColor, // Màu nhãn trục y
        },
      },
    },
    colors: ["#4CAF50"],
    title: {
      text: `Doanh Thu Theo ${timeFilter === "7days"
          ? "Ngày (Tuần Này)"
          : timeFilter === "30days"
            ? "Ngày (30 Ngày Qua)"
            : timeFilter === "90days"
              ? "Ngày (90 Ngày Qua)"
              : timeFilter === "year"
                ? "Tháng (Năm Nay)"
                : "Năm (Tất Cả Thời Gian)"
        }`,
      align: "center",
      style: {
        fontSize: "16px",
        color: isDarkTheme ? "#666" : "#999", // Màu tiêu đề
      },
    },
    dataLabels: { enabled: false },
    tooltip: {
      style: {
        fontSize: "12px",
        color: "#fff",
      },
      theme: "dark",
      y: {
        formatter: (val) => formatCurrency(val),
      },
    },
    noData: {
      text: "Không có dữ liệu doanh thu trong khoảng thời gian này",
      align: "center",
      verticalAlign: "middle",
      style: {
        color: secondaryTextColor,
        fontSize: "14px",
      },
    },
  };

  const barChartSeries = [
    {
      name: "Doanh thu",
      data: revenueByDay.data,
    },
  ];

  const donutChartOptions = {
    chart: {
      id: "revenue-by-category",
      foreColor: textColor,
    },
    labels: revenueByCategory.labels,
    colors: ["#2196F3", "#4CAF50", "#FFC107", "#FF5722", "#9C27B0", "#E91E63"],
    title: {
      text: `Doanh Thu Theo Danh Mục (${timeFilter === "7days"
          ? "7 Ngày Qua"
          : timeFilter === "30days"
            ? "30 Ngày Qua"
            : timeFilter === "90days"
              ? "90 Ngày Qua"
              : timeFilter === "year"
                ? "Năm Nay"
                : "Tất Cả Thời Gian"
        })`,
      align: "center",
      style: {
        fontSize: "16px",
        color: textColor,
      },
    },
    dataLabels: {
      formatter: (val) => `${val.toFixed(1)}%`,
      style: {
        fontSize: "14px",
        colors: ["#fff"],
      },
    },
    legend: {
      position: "bottom",
      labels: {
        colors: secondaryTextColor,
      },
    },
    tooltip: {
      style: {
        fontSize: "12px",
        color: "#fff",
      },
      theme: "dark",
    },
    noData: {
      text: "Không có dữ liệu doanh thu theo danh mục",
      align: "center",
      verticalAlign: "middle",
      style: {
        color: secondaryTextColor,
        fontSize: "14px",
      },
    },
  };

  const donutChartSeries = revenueByCategory.data;

  // Format utilities
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${hours}:${minutes} ${day}/${month}/${year}`;
  };

  const handleExportStats = () => {
    const csvContent = [
      ["Chỉ số", "Giá trị"],
      ["Tổng doanh thu", formatCurrency(stats.totalRevenue)],
      ["Doanh thu tháng", formatCurrency(stats.monthlyRevenue)],
      ["Doanh thu tuần", formatCurrency(stats.weeklyRevenue)],
      ["Giá trị đơn hàng trung bình", formatCurrency(stats.averageOrderValue)],
      ["Tổng số đơn hàng", stats.totalOrders],
      ["Người dùng hoạt động", stats.activeUsers],
      ["Sản phẩm sắp hết hàng", stats.lowStockProducts],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard_stats_${timeFilter}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("Xuất dữ liệu thành công");
  };

  const handleImportOrders = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await importOrdersRequest(formData);
      toast.success("Nhập đơn hàng thành công");
      fetchDashboardData();
    } catch (err) {
      toast.error("Nhập đơn hàng thất bại: " + err.message);
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      pending: "text-yellow-500 bg-yellow-100",
      confirmed: "text-orange-500 bg-orange-100",
      shipping: "text-blue-500 bg-blue-100",
      delivered: "text-green-500 bg-green-100",
      cancelled: "text-red-500 bg-red-100",
    };
    return statusColors[status] || "text-gray-500 bg-gray-100";
  };

  const translateStatus = (status) => {
    const translations = {
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      shipping: "Đang giao",
      delivered: "Đã giao",
      cancelled: "Đã hủy",
    };
    return translations[status] || status;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "stock":
        return <Package size={25} className="text-red-500" />;
      case "order":
        return <ShoppingCart size={20} className="text-blue-500" />;
      case "user":
        return <Users size={20} className="text-green-500" />;
      case "system":
        return <AlertTriangle size={20} className="text-yellow-500" />;
      default:
        return <Bell size={20} className="text-gray-500" />;
    }
  };

  const getRevenueLabel = () => {
    switch (timeFilter) {
      case "7days":
        return "Doanh Thu 7 Ngày Qua";
      case "30days":
        return "Doanh Thu 30 Ngày Qua";
      case "90days":
        return "Doanh Thu 90 Ngày Qua";
      case "year":
        return "Doanh Thu Năm Nay";
      case "all":
        return "Tổng Doanh Thu (Tất Cả)";
      default:
        return "Doanh Thu Trong Kỳ";
    }
  };

  const getAverageOrderValueLabel = () => {
    switch (timeFilter) {
      case "7days":
        return "Giá Trị Đơn TB 7 Ngày";
      case "30days":
        return "Giá Trị Đơn TB 30 Ngày";
      case "90days":
        return "Giá Trị Đơn TB 90 Ngày";
      case "year":
        return "Giá Trị Đơn TB Năm Nay";
      case "all":
        return "Giá Trị Đơn TB (Tất Cả)";
      default:
        return "Giá Trị Đơn TB";
    }
  };

  const getOrdersLabel = () => {
    switch (timeFilter) {
      case "7days":
        return "Đơn Hàng 7 Ngày Qua";
      case "30days":
        return "Đơn Hàng 30 Ngày Qua";
      case "90days":
        return "Đơn Hàng 90 Ngày Qua";
      case "year":
        return "Đơn Hàng Năm Nay";
      case "all":
        return "Tổng Đơn Hàng (Tất Cả)";
      default:
        return "Đơn Hàng Trong Kỳ";
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentUser={currentUser}
      />
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNavigation
          setMobileSidebarOpen={setMobileSidebarOpen}
          currentUser={currentUser}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-900 pb-4 pt-2 -mx-4 px-4 md:-mx-6 md:px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Tổng Quan Dashboard
                </h2>
              </div>
              <div className="flex flex-col md:flex-row gap-2 w-modern md:w-auto">
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="7days">7 ngày qua</option>
                  <option value="30days">30 ngày qua</option>
                  <option value="90days">90 ngày qua</option>
                  <option value="year">Năm nay</option>
                  <option value="all">Tất cả thời gian</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportStats}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center cursor-pointer"
                  >
                    <Download size={16} className="mr-2" />
                    Xuất CSV
                  </button>
                  <label className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center cursor-pointer">
                    <Upload size={16} className="mr-2" />
                    Nhập CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportOrders}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <LoadingSpinner size="large" />
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[
                    {
                      label: getRevenueLabel(),
                      value: stats.totalRevenue,
                      icon: DollarSign,
                      color: "green",
                    },
                    {
                      label: "Doanh Thu Tháng",
                      value: stats.monthlyRevenue,
                      icon: TrendingUp,
                      color: "blue",
                    },
                    {
                      label: "Doanh Thu Tuần",
                      value: stats.weeklyRevenue,
                      icon: BarChart2,
                      color: "purple",
                    },
                    {
                      label: getAverageOrderValueLabel(),
                      value: stats.averageOrderValue,
                      icon: ShoppingCart,
                      color: "yellow",
                    },
                    {
                      label: getOrdersLabel(),
                      value: stats.totalOrders,
                      icon: Package,
                      color: "indigo",
                      format: "number",
                    },
                    {
                      label: "Người Dùng Hoạt Động",
                      value: stats.activeUsers,
                      icon: Users,
                      color: "teal",
                      format: "number",
                    },
                    {
                      label: "SP Sắp Hết Hàng",
                      value: stats.lowStockProducts,
                      icon: AlertTriangle,
                      color: "red",
                      format: "number",
                    },
                  ].map((stat, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-900">
                            {stat.label}
                          </p>
                          <p className="text-xl font-semibold text-gray-600 dark:text-gray-900">
                            {stat.format === "number"
                              ? stat.value
                              : formatCurrency(stat.value)}
                          </p>
                        </div>
                        <stat.icon
                          className={`text-${stat.color}-500`}
                          size={24}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <Chart
                      options={barChartOptions}
                      series={barChartSeries}
                      type="bar"
                      height={350}
                    />
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <Chart
                      options={donutChartOptions}
                      series={donutChartSeries}
                      type="donut"
                      height={350}
                    />
                  </div>
                </div>

                {/* Recent Orders and Notifications */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-800">
                      Đơn Hàng Gần Đây
                    </h3>
                    {recentOrders.length === 0 ? (
                      <p className="text-gray-600 dark:text-gray-400">
                        Không có đơn hàng nào
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 dark:text-gray-600 border-b dark:border-gray-400">
                              <th className="pb-2 px-2">STT</th>
                              <th className="pb-2 px-2">Mã</th>
                              <th className="pb-2 px-2">Khách hàng</th>
                              <th className="pb-2 px-2">Tổng tiền</th>
                              <th className="pb-2 px-2">Trạng thái</th>
                              <th className="pb-2 px-2">Ngày</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentOrders.map((order, index) => (
                              <tr
                                key={order.id}
                                className="border-b dark:border-gray-400 h-12"
                              >
                                <td className="py-2 px-2">
                                  {index + 1}
                                </td>
                                <td className="py-2 px-2">
                                  #{order.id}
                                </td>
                                <td className="py-2 px-2">
                                  {order.customer || "Khách không xác định"}
                                </td>
                                <td className="py-2 px-2">
                                  {formatCurrency(order.total)}
                                </td>
                                <td className="py-2 px-2">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                                      order.status
                                    )}`}
                                  >
                                    {translateStatus(order.status)}
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  {formatDate(order.date)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-800">
                      Thông Báo
                    </h3>
                    {notifications.length === 0 ? (
                      <p className="text-gray-600 dark:text-gray-600">
                        Không có thông báo mới
                      </p>
                    ) : (
                      <ul className="space-y-3 max-h-75 overflow-y-auto">
                        {notifications.map((notification, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-gray-800 dark:text-gray-600 border-b dark:border-gray-400 pb-2"
                          >
                            {getNotificationIcon(notification.type)}
                            <div>
                              <p>{notification.message}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-600">
                                {formatDate(notification.date)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
