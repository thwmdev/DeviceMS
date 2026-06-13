import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// Import chuẩn trỏ vào đúng file login trong thư mục con của bạn
import Login from "./pages/login"; 
import AllocationRequests from "./pages/allocationRequests";
import Devices from "./pages/devices"
import Dashboard from "./pages/dashboard";
import ProductCategories from "./pages/productCategories";

// Guard: USER truy cập /dashboard sẽ bị redirect về /devices
function ProtectedDashboard() {
  const role = (localStorage.getItem("role") || "").toUpperCase();
  if (role === "USER") return <Navigate to="/devices" replace />;
  return <Dashboard />;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Khi người dùng vào trang gốc, tự động chuyển hướng sang trang /login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Tuyến đường dẫn hiển thị màn hình đăng nhập */}
        <Route path="/login" element={<Login />} />
        {/* Dashboard: USER tự động redirect → /devices */}
        <Route path="/dashboard" element={<ProtectedDashboard />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/allocation-requests" element={<AllocationRequests />} />
        <Route path="/product-categories" element={<ProductCategories />} />
      </Routes>
    </Router>
  );
}

export default App;
