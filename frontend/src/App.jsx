import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// Import chuẩn trỏ vào đúng file login trong thư mục con của bạn
import Login from "./pages/login"; 
import Devices from "./pages/devices"

function App() {
  return (
    <Router>
      <Routes>
        {/* Khi người dùng vào trang gốc, tự động chuyển hướng sang trang /login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Tuyến đường dẫn hiển thị màn hình đăng nhập */}
        <Route path="/login" element={<Login />} />
        <Route path="/devices" element={<Devices />} />
      </Routes>
    </Router>
  );
}

export default App;