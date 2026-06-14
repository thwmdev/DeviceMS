import { useEffect, useState } from "react";
import axios from "axios";
import { useDepreciation } from "../hooks/depre";
import Sidebar from "../components/sidebar";
import DepreciationChart from '../components/depreChart';
import "../styles/depre.css";

export default function Depreciation() {
  const { devices, formData, setFormData, fetchDevices, calculatePreview, saveConfig, fetchConfig, fetchHistory } = useDepreciation();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [history, setHistory] = useState([]); 
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

  const handleDeviceChange = async (e) => {
    const dev = devices.find(d => String(d.MaTB) === String(e.target.value));
    setSelectedDevice(dev || null);
    if (dev) {
        fetchConfig(dev.MaTB);
        const data = await fetchHistory(dev.MaTB); 
        setHistory(data);
    } else {
        setHistory([]);
    }
  };

  const handleRunMonthlyDepreciation = async () => {
    if (!confirm("Bạn có chắc chắn muốn chốt khấu hao cho tháng này?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post("http://127.0.0.1:5000/api/depreciation/run-monthly", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Chốt sổ tháng thành công!");
      fetchReport();
      if (selectedDevice) {
          const data = await fetchHistory(selectedDevice.MaTB);
          setHistory(data);
      }
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
          {reportData.length > 0 ? <DepreciationChart data={reportData} /> : <p>Chưa có dữ liệu.</p>}
        </div>
        
        <div className="card">
            <h3>Chọn thiết bị</h3>
            <select className="form-select" onChange={handleDeviceChange}>
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
                <option value="straight-line">Đường thẳng</option>
                <option value="declining-balance">Số dư giảm dần</option>
              </select>
            </div>
            <div className="form-group">
              <label>Thời gian sử dụng (năm):</label>
              <input type="number" value={formData.usefulLife} onChange={(e) => setFormData({...formData, usefulLife: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Giá trị thu hồi (VNĐ):</label>
              <input type="number" value={formData.residualValue} onChange={(e) => setFormData({...formData, residualValue: e.target.value})} />
            </div>
            
            <p>Khấu hao ước tính: <strong>{calculatePreview(selectedDevice.GiaTri, formData.residualValue, formData.usefulLife, formData.method).toLocaleString('vi-VN', {style: 'currency', currency: 'VND'})}</strong></p>
            
            {role === "ADMIN" && (
              <div className="action-buttons">
                <button className="btn-primary" onClick={handleSave} disabled={loading}>Lưu cấu hình</button>
                <button className="btn-danger" onClick={handleRunMonthlyDepreciation}>Chốt khấu hao tháng</button>
              </div>
            )}
          </div>
        )}

        
        {selectedDevice && (
          <div className="card">
            <h3>Lịch sử khấu hao</h3>
            {history.length > 0 ? (
              <table className="history-table">
                <thead><tr><th>Tháng/Năm</th><th>Số tiền</th><th>Ngày chốt</th></tr></thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td>{h.Thang}/{h.Nam}</td>
                      <td>{Number(h.SoTien).toLocaleString('vi-VN', {style: 'currency', currency: 'VND'})}</td>
                      <td>{new Date(h.NgayChot).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p>Chưa có dữ liệu lịch sử.</p>}
          </div>
        )}
      </main>
    </div>
  );
}