import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// Import chuẩn trỏ vào đúng file login trong thư mục con của bạn
import Login from "./pages/login"; 
import Devices from "./pages/devices"
import Dashboard from "./pages/dashboard";
import ProductCategories from "./pages/productCategories";
import Accounts from "./pages/accounts";
import Depreciation from "./pages/depreciation";


function App() {
  return (
    <Router>
      <Routes>


        <Route path="/" element={<Navigate to="/login" replace />} />
        

        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/product-categories" element={<ProductCategories />} />
        <Route path="/depreciation" element={<Depreciation />} />



      </Routes>
    </Router>
  );
}

export default App;
