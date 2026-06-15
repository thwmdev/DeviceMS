import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// Import chuẩn trỏ vào đúng file login trong thư mục con của bạn
import Login from "./pages/login"; 
import AllocationRequests from "./pages/allocationRequests";
import Devices from "./pages/devices"
import Inventory from "./pages/inventory"
import Dashboard from "./pages/dashboard";
import ProductCategories from "./pages/productCategories";
import Accounts from "./pages/accounts";
import Depreciation from "./pages/depreciation";


function ProtectedDashboard() {
  const role = (localStorage.getItem("role") || "").toUpperCase();
  if (role === "USER") return <Navigate to="/devices" replace />;
  return <Dashboard />;
}

function App() {
  return (
    <Router>
      <Routes>


        <Route path="/" element={<Navigate to="/login" replace />} />
        

        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedDashboard />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/inventory" element={<Inventory/>} />
        <Route path="/allocation-requests" element={<AllocationRequests />} />
        <Route path="/product-categories" element={<ProductCategories />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/depreciation" element={<Depreciation />} />



      </Routes>
    </Router>
  );
}

export default App;
