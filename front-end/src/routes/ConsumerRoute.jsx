import { Navigate } from "react-router-dom";

/**
 * Route guard for consumer-only pages.
 * Prevents logged-in admins from accessing user-facing pages, redirecting them to the admin dashboard.
 */
const ConsumerRoute = ({ children }) => {
  const accessToken = localStorage.getItem("accessToken");
  const storedUser = JSON.parse(localStorage.getItem("user"));

  if (accessToken && storedUser && storedUser.role === "admin") {
    // Admins are restricted to management pages only
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ConsumerRoute;
