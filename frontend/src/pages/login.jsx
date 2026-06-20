import { useState } from "react";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";

import "../App.css";
import { getCanonicalStoredRole, getRoleFromAuthResponse, isEmployeeRole } from "../utils/roles";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:5000/api" : "/api");
const AUTH_API_URL = `${API_BASE_URL}/auth`;

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  /** Lưu thông tin đăng nhập và redirect theo role */
  const _handleAuthSuccess = (data) => {
    const role = getRoleFromAuthResponse(data);
    const storedRole = getCanonicalStoredRole(role);

    localStorage.setItem("token", data.token);
    if (storedRole) {
      localStorage.setItem("role", storedRole);
    } else {
      localStorage.removeItem("role");
    }
    localStorage.setItem("username", data.username || data.display_name || "");

    window.location.href = isEmployeeRole(role) ? "/devices" : "/dashboard";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Vui lòng nhập đầy đủ tài khoản và mật khẩu!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(`${AUTH_API_URL}/login`, {
        username,
        password,
      });
      if (response.data && response.data.token) {
        _handleAuthSuccess(response.data);
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response) {
        setError(`Lỗi máy chủ (${err.response.status}). Vui lòng thử lại!`);
      } else if (err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setError("Không kết nối được máy chủ (port 5000). Hãy chắc chắn backend đang chạy!");
      } else {
        setError("Đã xảy ra lỗi. Vui lòng thử lại!");
      }
    } finally {
      setLoading(false);
    }
  };

  /** Xử lý đăng nhập Google thành công */
  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleLoading(true);
    setError("");
    try {
      const response = await axios.post(`${AUTH_API_URL}/google-login`, {
        credential: credentialResponse.credential,
      });
      if (response.data && response.data.token) {
        _handleAuthSuccess(response.data);
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response) {
        setError(`Lỗi máy chủ (${err.response.status}). Vui lòng thử lại!`);
      } else if (err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setError("Không kết nối được máy chủ (port 5000). Hãy chắc chắn backend đang chạy!");
      } else {
        setError("Đăng nhập Google thất bại. Vui lòng thử lại!");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Đăng nhập Google thất bại. Vui lòng thử lại!");
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <p className="login-eyebrow">DeviceMS · Hệ thống quản lý thiết bị</p>
        <h2 className="login-title">Đăng nhập</h2>
        <p className="login-subtitle">Đăng nhập để tiếp tục quản lý thiết bị của bạn.</p>

        {error && <div className="login-error-alert">{error}</div>}

        <div className="login-input-group">
          <label className="login-label">Tên đăng nhập:</label>
          <input
            id="login-username"
            type="text"
            className="login-input"
            placeholder="Nhập tên đăng nhập"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div className="login-input-group">
          <label className="login-label">Mật khẩu:</label>
          <input
            id="login-password"
            type="password"
            className="login-input"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button id="login-submit-btn" type="submit" disabled={loading || googleLoading} className="login-button">
          {loading ? "Đang xử lý..." : "Đăng Nhập"}
        </button>

        {/* Divider */}
        <div className="login-divider">
          <span className="login-divider-text">hoặc</span>
        </div>

        {/* Google Login */}
        <div className="login-google-wrapper">
          {googleLoading ? (
            <div className="login-google-loading">Đang xác thực Google...</div>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              text="signin_with"
              shape="pill"
              locale="vi"
              width="100%"
            />
          )}
        </div>
      </form>
    </div>
  );
};

export default Login;
