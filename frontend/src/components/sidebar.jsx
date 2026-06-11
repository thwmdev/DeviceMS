import { useNavigate, useLocation } from 'react-router-dom';

const getStoredUser = () => {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("role");
  if (!token) return null;
  return { username: username || "User", role: role || "USER" };
};

const PERMISSIONS = {
  manageAccounts: (role) => {
    const r = role?.toUpperCase();
    return r === "ADMIN" || r === "MANAGER";
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
          className={`menu-item ${currentPath === '/devices' || currentPath === '/dashboard' || currentPath === '/' ? 'active' : ''}`}
          onClick={() => navigate('/devices')}
        >
          <i className="ti ti-device-laptop" />
          <span>Quản lý thiết bị</span>
        </li>
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