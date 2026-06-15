import { useEffect, useState } from "react";
import axios from "axios";
import { useDepreciation } from "../hooks/depre";
import Sidebar from "../components/sidebar";
import "../styles/depre.css";

export default function Depreciation() {
  const { fetchDevices, fetchHistory } = useDepreciation();
  const [reportData, setReportData] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceHistory, setDeviceHistory] = useState([]);
  
  const [filter, setFilter] = useState({ 
    thang: new Date().getMonth() + 1, 
    nam: new Date().getFullYear() 
  });

  useEffect(() => {
    fetchReport(filter.thang, filter.nam);
  }, [filter.thang, filter.nam]);

  const fetchReport = async (thang, nam) => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`http://127.0.0.1:5000/api/depreciation/report-by-month?thang=${thang}&nam=${nam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(res.data || []);
    } catch (err) { console.error("Lỗi lấy báo cáo:", err); }
  };

  const handleRowClick = async (item) => {
    setSelectedDevice(item);
    const history = await fetchHistory(item.MaTB); 
    setDeviceHistory(history || []);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        <h1>Quản lý khấu hao</h1>


        <div className="card filter-card">
          <select value={filter.thang} onChange={(e) => setFilter({...filter, thang: e.target.value})}>
            {[...Array(12).keys()].map(i => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
          </select>
          <select value={filter.nam} onChange={(e) => setFilter({...filter, nam: e.target.value})}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>



        <div className="card">
          <table className="depreciation-table">
            <thead>
              <tr><th>Mã TS</th><th>Tên tài sản</th><th>Khấu hao tháng</th></tr>
            </thead>
            <tbody>
              {reportData.map((item) => (
                <tr key={item.MaTB} onClick={() => handleRowClick(item)}>
                  <td>{item.MaTB}</td>
                  <td>{item.TenThietBi}</td>
                  <td>{Number(item.GiaTriKhauHaoThang || 0).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>



        {selectedDevice && (
          <div className="card">
            <h3>Chi tiết: {selectedDevice.TenThietBi}</h3>
            {/* Form Cập nhật khấu hao */}
            <div className="form-group">
                <label>Số năm sử dụng còn lại:</label>
                <input type="number" defaultValue="5" />
                <button className="btn-primary" style={{marginTop: '10px'}}>Lưu cấu hình</button>
            </div>



            <h4>Lịch sử khấu hao</h4>
            <table className="history-table">
              <thead>
                <tr><th>Tháng/Năm</th><th>Giá trị còn lại</th></tr>
              </thead>
              <tbody>
                {deviceHistory.map((h, i) => (
                  <tr key={i}><td>{h.Thang}/{h.Nam}</td><td>{h.GiaTriConLai.toLocaleString('vi-VN')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}