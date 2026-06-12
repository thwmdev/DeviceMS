import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// Import chuẩn trỏ vào đúng file login trong thư mục con của bạn
import Login from "./pages/login"; 
import Devices from "./pages/devices"
import Dashboard from "./pages/dashboard";
import ProductCategories from "./pages/productCategories";

function App() {
  return (
    <Router>
      <Routes>
        {/* Khi người dùng vào trang gốc, tự động chuyển hướng sang trang /login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Tuyến đường dẫn hiển thị màn hình đăng nhập */}
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/product-categories" element={<ProductCategories />} />
      </Routes>
    </Router>
  );
}

export default App;
