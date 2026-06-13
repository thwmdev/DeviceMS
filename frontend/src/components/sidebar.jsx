import { useLocation, useNavigate } from "react-router-dom";

const getRoleFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role;
  } catch {
    return null;
  }
};

const getStoredUser = () => {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const storedRole = localStorage.getItem("role");

  if (!token) return null;

  const role = storedRole && storedRole !== "undefined"
    ? storedRole
    : getRoleFromToken(token);

  return { username: username || "User", role: role || "USER" };
};

const PERMISSIONS = {
  manageAccounts: (role) => {
    const normalized = role?.toUpperCase();
    return normalized === "ADMIN" || normalized === "MANAGER";
  },
  viewProductCategories: (role) => {
    const normalized = role?.toUpperCase();
    return normalized === "ADMIN" || normalized === "HR";
  },
  viewDashboard: (role) => {
    const normalized = role?.toUpperCase();
    return normalized === "ADMIN" || normalized === "HR";
  },
};

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const currentPath = location.pathname;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <i className="ti ti-devices" />
        <span>DeviceMS</span>
      </div>

      {user && (
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <span className="profile-name">{user.username}</span>
            <span className="profile-role">{user.role}</span>
          </div>
        </div>
      )}

      <ul className="sidebar-menu">
        {user && PERMISSIONS.viewDashboard(user.role) && (
          <li
            className={`menu-item ${currentPath === "/dashboard" || currentPath === "/" ? "active" : ""}`}
            onClick={() => navigate("/dashboard")}
          >
            <i className="ti ti-layout-dashboard" />
            <span>Dashboard</span>
          </li>
        )}
        <li
          className={`menu-item ${currentPath === "/devices" ? "active" : ""}`}
          onClick={() => navigate("/devices")}
        >
          <i className="ti ti-device-laptop" />
          <span>Quản lý thiết bị</span>
        </li>
        <li
          className={`menu-item ${currentPath === "/allocation-requests" ? "active" : ""}`}
          onClick={() => navigate("/allocation-requests")}
        >
          <i className="ti ti-transfer" />
          <span>Cấp phát / thu hồi</span>
        </li>
        {user && PERMISSIONS.viewProductCategories(user.role) && (
          <li
            className={`menu-item ${currentPath === "/product-categories" ? "active" : ""}`}
            onClick={() => navigate("/product-categories")}
          >
            <i className="ti ti-category" />
            <span>Danh mục sản phẩm</span>
          </li>
        )}
        {user && PERMISSIONS.manageAccounts(user.role) && (
          <li
            className={`menu-item ${currentPath === "/accounts" ? "active" : ""}`}
            onClick={() => navigate("/accounts")}
          >
            <i className="ti ti-users" />
            <span>Quản lý tài khoản</span>
          </li>
        )}
      </ul>

      <div className="sidebar-footer">
        <button className="logout-button" onClick={handleLogout}>
          <i className="ti ti-logout" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
