import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/login"; 
import AllocationRequests from "./pages/allocationRequests";
import Devices from "./pages/devices"
import Inventory from "./pages/inventory"
import Dashboard from "./pages/dashboard";
import ProductCategories from "./pages/productCategories";
import Accounts from "./pages/accounts";
import Depreciation from "./pages/depreciation";
import { getStoredRole, isEmployeeRole } from "./utils/roles";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


function ProtectedDashboard() {
  const role = getStoredRole();
  if (isEmployeeRole(role)) return <Navigate to="/devices" replace />;
  return <Dashboard />;
}

function App() {
  return (
    <Router>
      <ConfirmProvider>
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
        <ToastContainer
          className="app-toast-container"
          toastClassName="app-toast"
          bodyClassName="app-toast-body"
          progressClassName="app-toast-progress"
          position="top-right"
          autoClose={3200}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </ConfirmProvider>
    </Router>
  );
}

export default App;
