import { useState } from "react";
import axios from "axios";

import "../App.css";
import { getCanonicalStoredRole, getRoleFromAuthResponse, isEmployeeRole } from "../utils/roles";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);




  const handleLogin = async (e) => {
    e.preventDefault();
    console.log({ username, password });  
    if (!username || !password) {
      setError("Vui lòng nhập đầy đủ tài khoản và mật khẩu!");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post("http://127.0.0.1:5000/api/auth/login", {
        username: username, 
        password: password,
      });




      if (response.data && response.data.token) {
        const role = getRoleFromAuthResponse(response.data);
        const storedRole = getCanonicalStoredRole(role);

        
        localStorage.setItem("token", response.data.token);
        if (storedRole) {
          localStorage.setItem("role", storedRole);
        } else {
          localStorage.removeItem("role");
        }
        localStorage.setItem("username", response.data.username || username);

        window.location.href = isEmployeeRole(role) ? "/devices" : "/dashboard"; 
      }
    } catch (err) {
      if (err.response) {
        setError(err.response.data.message || "Tài khoản hoặc mật khẩu không đúng!");
      } else {
        setError("Port 5000!");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <h2 className="login-title">Đăng nhập</h2>

        {error && <div className="login-error-alert">{error}</div>}

        <div className="login-input-group">
          <label className="login-label">Tên đăng nhập:</label>
          <input
            type="text"
            className="login-input"
            placeholder="Nhập tên đăng nhập"
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required
          />
        </div>

        <div className="login-input-group">
          <label className="login-label">Mật khẩu:</label>
          <input
              type="password"
              className="login-input"
              placeholder="Nhập mật khẩu"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
            />
        </div>

        <button type="submit" disabled={loading} className="login-button">
          {loading ? "Đang xử lý..." : "Đăng Nhập"}
        </button>
      </form>
    </div>
  );
};

export default Login;
