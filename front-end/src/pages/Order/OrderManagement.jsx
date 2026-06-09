import { useState, useEffect, useCallback } from "react";
import {
  FaBoxOpen,
  FaShippingFast,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import TopNavigation from "../../components/TopNavigation";
import OrderStats from "../../components/OrderStats";
import OrderFilters from "../../components/OrderFilters";
import OrdersTable from "../../components/OrdersTable";
import OrderDetailsModal from "../../components/OrderDetailsModal";
import Pagination from "../../components/Pagination";
import { toast } from "react-toastify";
import {
  deleteOrder as deleteOrderRequest,
  fetchOrderStats as fetchOrderStatsRequest,
  fetchOrders as fetchOrdersRequest,
  updateOrder as updateOrderRequest,
} from "../../services/orderService";
import { fetchUserById as fetchUserByIdRequest } from "../../services/userService";

const OrderManagement = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    averageOrderValue: 0,
  });
  const normalizeStatus = (status) => {
    if (!status) return "pending";
    const normalized = String(status).trim();

    switch (normalized) {
      case "pending":

      case "Chờ xử lý":
      case "Chờ xác nhận":
        return "pending";
      case "confirmed":
      case "Đang xử lý":
      case "Đã xác nhận":
        return "confirmed";
      case "shipping":
      case "Đang giao hàng":
      case "Đang giao":
        return "shipping";
      case "delivered":
      case "Đã giao hàng":
      case "Đã giao":
      case "Hoàn tất":
        return "delivered";
      case "cancelled":
      case "Đã hủy":
        return "cancelled";
      default:
        return "pending";
    }
  };
  const fetchCurrentUser = useCallback(async () => {
    try {
      const userLocal = JSON.parse(localStorage.getItem("user"));
      if (!userLocal || !userLocal._id)
        throw new Error("No user found in localStorage");
      const response = await fetchUserByIdRequest(userLocal._id);
      setCurrentUser(response.data);
    } catch (err) {
      console.error(
        "Failed to fetch current user:",
        err.response?.data || err.message
      );
      setCurrentUser({
        fullName: "Admin User",
        email: "admin@example.com",
        avatar: "",
      });
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [ordersResponse, statsResponse] = await Promise.all([
          fetchOrdersRequest({ limit: 1000 }),
          fetchOrderStatsRequest(),
        ]);

        const ordersData = Array.isArray(ordersResponse.data)
          ? ordersResponse.data
          : (ordersResponse.data?.orders || []);

        const normalizedOrders = ordersData.map((order) => ({
          ...order,
          statusNormalized: normalizeStatus(order.status),
        }));

        setOrders(normalizedOrders);
        setFilteredOrders(normalizedOrders);
        setStats(statsResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let result = orders;

    if (searchTerm) {
      result = result.filter(
        (order) =>
          order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.user_id &&
            order.user_id.fullName
              .toLowerCase()
              .includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(
        (order) => order.statusNormalized === statusFilter
      );
    }

    setFilteredOrders(result);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, orders]);

  // phân trang
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(
    indexOfFirstOrder,
    indexOfLastOrder
  );
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

  // thay đổi trang
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // cập nhật trạng thái
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await updateOrderRequest(orderId, {
        status: newStatus,
        updatedAt: Date.now(),
      });

      setOrders(
        orders.map((order) =>
          order._id === orderId
            ? {
              ...response.data,
              statusNormalized: normalizeStatus(response.data.status),
            }
            : order
        )
      );
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  // xóa đơn hàng
  const deleteOrder = async (orderId) => {
    if (window.confirm("Are you sure you want to delete this order?")) {
      try {
        await deleteOrderRequest(orderId);
        setOrders(orders.filter((order) => order._id !== orderId));
        toast.success("Order deleted successfully");
      } catch (error) {
        console.error("Error deleting order:", error);
        toast.error("Failed to delete order");
      }
    }
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case "pending":
        return {
          icon: <FaClock className="text-yellow-500" />,
          label: "Chờ xác nhận",
          color: "bg-yellow-100 text-yellow-800",
        };
      case "confirmed":
        return {
          icon: <FaBoxOpen className="text-blue-500" />,
          label: "Đã xác nhận",
          color: "bg-blue-100 text-blue-800",
        };
      case "shipping":
        return {
          icon: <FaShippingFast className="text-purple-500" />,
          label: "Đang giao",
          color: "bg-purple-100 text-purple-800",
        };
      case "delivered":
        return {
          icon: <FaCheckCircle className="text-green-500" />,
          label: "Đã giao",
          color: "bg-green-100 text-green-800",
        };
      case "cancelled":
        return {
          icon: <FaTimesCircle className="text-red-500" />,
          label: "Đã hủy",
          color: "bg-red-100 text-red-800",
        };
      default:
        return {
          icon: <FaBoxOpen className="text-gray-500" />,
          label: "Chưa xác định",
          color: "bg-gray-100 text-gray-600",
        };
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
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
        <main className="container mx-auto px-4 py-8 overflow-y-auto">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-800">
              Quản lý đơn hàng
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Tổng số: {filteredOrders.length}
            </p>
          </div>

          <OrderStats stats={stats} />

          <OrderFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />

          <OrdersTable
            orders={currentOrders}
            startIndex={indexOfFirstOrder}
            formatDate={formatDate}
            getStatusInfo={getStatusInfo}
            updateOrderStatus={updateOrderStatus}
            deleteOrder={deleteOrder}
            viewOrderDetails={viewOrderDetails}
          />

          {filteredOrders.length > ordersPerPage && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              indexOfFirstOrder={indexOfFirstOrder}
              indexOfLastOrder={indexOfLastOrder}
              filteredOrders={filteredOrders}
              paginate={paginate}
            />
          )}

          {showModal && selectedOrder && (
            <OrderDetailsModal
              selectedOrder={selectedOrder}
              formatDate={formatDate}
              getStatusInfo={getStatusInfo}
              setShowModal={setShowModal}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default OrderManagement;
