import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// Import chuẩn trỏ vào đúng file login trong thư mục con của bạn
import Login from "./pages/login"; 
import AllocationRequests from "./pages/allocationRequests";
import Devices from "./pages/devices"
import Dashboard from "./pages/dashboard";
import ProductCategories from "./pages/productCategories";
import Accounts from "./pages/accounts";
import Depreciation from "./pages/depreciation";


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


        <Route path="/" element={<Navigate to="/login" replace />} />
        

        <Route path="/login" element={<Login />} />
        {/* Dashboard: USER tự động redirect → /devices */}
        <Route path="/dashboard" element={<ProtectedDashboard />} />
        <Route path="/devices" element={<Devices />} />
<<<<<<< HEAD
        <Route path="/allocation-requests" element={<AllocationRequests />} />
=======
        <Route path="/accounts" element={<Accounts />} />
>>>>>>> b2e7dd6cf233678a99576fd15ad5494b7f4fd84d
        <Route path="/product-categories" element={<ProductCategories />} />
        <Route path="/depreciation" element={<Depreciation />} />



      </Routes>
    </Router>
  );
}

export default App;
