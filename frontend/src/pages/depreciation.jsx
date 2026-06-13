import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Sidebar from "../components/sidebar";
import "../styles/depre.css";

export default function Depreciation() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    method: "straight-line",
    usefulLife: 5,
    residualValue: 0,
  });

  const fetchDevices = useCallback(async () => {
    try {
      // Lưu ý: Đảm bảo endpoint này trả về danh sách có trường GiaTri (Nguyên giá)
      const res = await axios.get("http://127.0.0.1:5000/api/device/list?limit=100", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setDevices(res.data.data || []);
    } catch (err) {
      console.error("Lỗi tải thiết bị", err);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // Hàm tính toán khấu hao hiển thị cho người dùng
  const getCalculationPreview = () => {
    if (!selectedDevice || !formData.usefulLife) return 0;
    const cost = Number(selectedDevice.GiaTri || 0);
    const salvage = Number(formData.residualValue || 0);
    const life = Number(formData.usefulLife);
    
    if (formData.method === "straight-line") {
      return ((cost - salvage) / life).toLocaleString("vi-VN");
    } else {
      const rate = (1 / life) * 2;
      return (cost * rate).toLocaleString("vi-VN");
    }
  };

  const handleSave = async () => {
    if (!selectedDevice) return alert("Vui lòng chọn thiết bị!");
    if (formData.usefulLife <= 0) return alert("Thời gian sử dụng phải lớn hơn 0");
    
    setLoading(true);
    try {
      await axios.post("http://127.0.0.1:5000/api/depreciation", { 
        ...formData, 
        MaTB: selectedDevice.MaTB 
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      alert(`Thiết lập khấu hao thành công cho: ${selectedDevice.TenThietBi}`);
    } catch (err) {
      alert("Lỗi lưu dữ liệu: " + (err.response?.data?.message || "Kiểm tra lại kết nối"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content">
        <h1>Thiết lập khấu hao</h1>
        
        <div className="card">
          <h3>Chọn thiết bị</h3>
          <select 
            className="form-select"
            onChange={(e) => setSelectedDevice(devices.find(d => d.MaTB == e.target.value))}
          >
            <option value="">-- Chọn thiết bị để cấu hình --</option>
            {devices.map(d => (
              <option key={d.MaTB} value={d.MaTB}>{d.TenThietBi} (Nguyên giá: {Number(d.GiaTri).toLocaleString()}đ)</option>
            ))}
          </select>
        </div>

        {selectedDevice && (
          <div className="card">
            <h3>Cấu hình phương pháp</h3>
            <div className="form-group">
              <label>Phương pháp:</label>
              <select value={formData.method} onChange={(e) => setFormData({...formData, method: e.target.value})}>
                <option value="straight-line">Đường thẳng (Straight Line)</option>
                <option value="declining-balance">Số dư giảm dần (Declining Balance)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Thời gian sử dụng (năm):</label>
              <input type="number" value={formData.usefulLife} onChange={(e) => setFormData({...formData, usefulLife: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Giá trị thu hồi ước tính (đ):</label>
              <input type="number" value={formData.residualValue} onChange={(e) => setFormData({...formData, residualValue: e.target.value})} />
            </div>

            <div className="calculation-preview">
              <p>Khấu hao ước tính hàng năm: <strong>{getCalculationPreview()} đ</strong></p>
            </div>

            <button className="btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? "Đang xử lý..." : "Xác nhận lưu cấu hình"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}