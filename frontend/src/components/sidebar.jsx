import { useNavigate, useLocation } from 'react-router-dom';

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
    const r = role?.toUpperCase();
    return r === "ADMIN" || r === "MANAGER";
  },
  viewProductCategories: (role) => {
    const r = role?.toUpperCase();
    return r === "ADMIN" || r === "HR";
  }
};

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const currentPath = location.pathname;
  return (
    <div className="sidebar">

      {/* Brand logo/name */}
      <div className="sidebar-brand">
        <i className="ti ti-devices" />
        <span>DeviceMS</span>
      </div>

      {/* User Profile Summary */}
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

      {/* Main Navigation Menu */}
      <ul className="sidebar-menu">
        <li
          className={`menu-item ${currentPath === '/dashboard' || currentPath === '/' ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          <i className="ti ti-layout-dashboard" />
          <span>Dashboard</span>
        </li>
        <li
          className={`menu-item ${currentPath === '/devices' ? 'active' : ''}`}
          onClick={() => navigate('/devices')}
        >
          <i className="ti ti-device-laptop" />
          <span>Quản lý thiết bị</span>
        </li>
        {user && PERMISSIONS.viewProductCategories(user.role) && (
          <li
            className={`menu-item ${currentPath === '/product-categories' ? 'active' : ''}`}
            onClick={() => navigate('/product-categories')}
          >
            <i className="ti ti-category" />
            <span>Danh mục sản phẩm</span>
          </li>
        )}
        {user && PERMISSIONS.manageAccounts(user.role) && (
          <li
            className={`menu-item ${currentPath === '/accounts' ? 'active' : ''}`}
            onClick={() => navigate('/accounts')}
          >
            <i className="ti ti-users" />
            <span>Quản lý tài khoản</span>
          </li>
        )}
      </ul>

      {/* Sidebar Footer / Logout */}
      <div className="sidebar-footer">
        <button className="logout-button" onClick={handleLogout}>
          <i className="ti ti-logout" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
