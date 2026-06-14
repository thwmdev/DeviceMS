import { useEffect, useState } from "react";
import axios from "axios";
import { useDepreciation } from "../hooks/depre";
import Sidebar from "../components/sidebar";
import DepreciationChart from '../components/depreChart';
import "../styles/depre.css";

export default function Depreciation() {
  const { devices, formData, setFormData, fetchDevices, calculatePreview, saveConfig, fetchConfig } = useDepreciation();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const role = (localStorage.getItem("role") || "").toUpperCase();

  useEffect(() => { 
    fetchDevices(); 
    fetchReport();
  }, [fetchDevices]);

  const fetchReport = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://127.0.0.1:5000/api/depreciation/report", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(res.data || []);
    } catch (err) { console.error("Lỗi tải báo cáo:", err); }
  };

  const handleRunMonthlyDepreciation = async () => {
    if (!confirm("Bạn có chắc chắn muốn chốt khấu hao cho tháng này? Hành động này không thể hoàn tác.")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post("http://127.0.0.1:5000/api/depreciation/run-monthly", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Chốt sổ tháng thành công!");
      fetchReport(); // Cập nhật lại biểu đồ
    } catch (err) { alert("Lỗi: " + (err.response?.data?.message || "Không thể chốt sổ")); }
  };

  const handleSave = async () => {
    if (!selectedDevice) return;
    setLoading(true);
    try {
      await saveConfig(selectedDevice.MaTB, formData);
      alert("Lưu cấu hình thành công!");
    } catch (err) { alert("Lỗi: " + (err.response?.data?.message || "Kiểm tra lại kết nối")); }
    finally { setLoading(false); }
  };

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content">
        <h1>Thiết lập khấu hao tài sản</h1>

        <div className="card">
          <h3>Báo cáo khấu hao (12 tháng gần nhất)</h3>
          {reportData.length > 0 ? (
            <DepreciationChart data={reportData} />
          ) : (
            <p className="text-muted">Chưa có dữ liệu báo cáo.</p>
          )}
        </div>
        
        <div className="card">
            <h3>Chọn thiết bị</h3>
            <select className="form-select" onChange={(e) => {
            const dev = devices.find(d => String(d.MaTB) === String(e.target.value));
            setSelectedDevice(dev || null);
            if (dev) fetchConfig(dev.MaTB);
            }}>
            <option value="">-- Chọn thiết bị để cấu hình --</option>
            {devices.map(d => <option key={d.MaTB} value={d.MaTB}>{d.TenThietBi}</option>)}
            </select>
        </div>

        {selectedDevice && (
          <div className="card">
            <h3>Cấu hình phương pháp cho: {selectedDevice.TenThietBi}</h3>
            
            <div className="form-group">
              <label>Phương pháp:</label>
              <select value={formData.method} onChange={(e) => setFormData({...formData, method: e.target.value})}>
                <option value="straight-line">Đường thẳng (Straight Line)</option>
                <option value="declining-balance">Số dư giảm dần (Declining Balance)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Thời gian sử dụng (năm):</label>
              <input type="number" min="1" value={formData.usefulLife} onChange={(e) => setFormData({...formData, usefulLife: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Giá trị thu hồi (VNĐ):</label>
              <input type="number" min="0" value={formData.residualValue} onChange={(e) => setFormData({...formData, residualValue: e.target.value})} />
            </div>
            
            <div className="result-box">
              <p>Khấu hao ước tính mỗi tháng: <strong>{calculatePreview(selectedDevice.GiaTri, formData.residualValue, formData.usefulLife, formData.method).toLocaleString('vi-VN', {style: 'currency', currency: 'VND'})}</strong></p>
            </div>
            
            {role === "ADMIN" && (
              <div className="action-buttons">
                <button className="btn-primary" onClick={handleSave} disabled={loading}>{loading ? "Đang lưu..." : "Lưu cấu hình"}</button>
                <button className="btn-danger" onClick={handleRunMonthlyDepreciation}>Chốt khấu hao tháng</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}