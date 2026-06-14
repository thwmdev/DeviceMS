import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import "../App.css";
import Sidebar from "../components/sidebar";

const API_URL = "http://127.0.0.1:5000/api/device";
const ALLOCATION_API_URL = "http://127.0.0.1:5000/api/allocation-request";

const STATUS_LABEL = {
  SAN_SANG: "Sẵn sàng",
  DA_CAP_PHAT: "Đã cấp phát",
  THANH_LY: "Thanh lý",
};

const STATUS_TONE = {
  SAN_SANG: "ready",
  DA_CAP_PHAT: "assigned",
  THANH_LY: "retired",
};

const formatMoney = (value) => {
  const number = Number(value || 0);
  if (!number) return "0 đ";
  return `${number.toLocaleString("vi-VN")} đ`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeader = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      
      const [devRes, reqRes] = await Promise.all([
        axios.get(`${API_URL}/list?page=1&limit=100`, { headers: authHeader() }),
        axios.get(`${ALLOCATION_API_URL}/list?page=1&limit=5`, { headers: authHeader() })
      ]);
      
      setDevices(devRes.data.data || []);
      setTotal(devRes.data.total || 0);
      setRequests(reqRes.data.data || []);
    } catch (err) {
      handleAuthError(err);
      setError(err?.response?.data?.message || "Không tải được dữ liệu dashboard.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, handleAuthError]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = useMemo(() => {
    const byStatus = devices.reduce(
      (acc, device) => {
        const status = device.TrangThai || "SAN_SANG";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { SAN_SANG: 0, DA_CAP_PHAT: 0, THANH_LY: 0 }
    );

    const inventoryValue = devices.reduce(
      (sum, device) => sum + Number(device.GiaTri || 0),
      0
    );

    const activeCount = byStatus.SAN_SANG + byStatus.DA_CAP_PHAT;
    const assignedRate = activeCount
      ? Math.round((byStatus.DA_CAP_PHAT / activeCount) * 100)
      : 0;

    return {
      byStatus,
      inventoryValue,
      assignedRate,
    };
  }, [devices]);

  const pieData = useMemo(() => {
    return [
      { name: "Sẵn sàng", value: summary.byStatus.SAN_SANG, color: "var(--success, #2f7654)" },
      { name: "Đã cấp phát", value: summary.byStatus.DA_CAP_PHAT, color: "var(--accent, #315a58)" },
      { name: "Thanh lý", value: summary.byStatus.THANH_LY, color: "var(--danger, #b4433b)" },
    ].filter(d => d.value > 0);
  }, [summary]);

  const categoryData = useMemo(() => {
    const cats = devices.reduce((acc, dev) => {
      const type = dev.LoaiThietBi || "Khác";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(cats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [devices]);

  const recentDevices = devices.slice(0, 5);

  const role = (localStorage.getItem("role") || "").toUpperCase();
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";
  const isHR = role === "HR";
  

  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content dashboard-page">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-kicker">Tổng quan tài sản</p>
          </div>
          <button className="btn-primary" onClick={() => navigate("/devices")}>
            Mở quản lý thiết bị
          </button>
        </section>

        {error && <div className="dashboard-error">{error}</div>}

        <section className="dashboard-metrics" aria-label="Chỉ số thiết bị">
          <article className="metric-panel metric-panel-strong">
            <span className="metric-label">Tổng thiết bị</span>
            <strong>{total.toLocaleString("vi-VN")}</strong>
            <small>{devices.length < total ? `Đang phân tích ${devices.length} bản ghi mới nhất` : "Toàn bộ danh sách"}</small>
          </article>
          <article className="metric-panel">
            <span className="metric-label">Sẵn sàng</span>
            <strong>{summary.byStatus.SAN_SANG}</strong>
            <small>Có thể cấp phát</small>
          </article>
          <article className="metric-panel">
            <span className="metric-label">Đã cấp phát</span>
            <strong>{summary.byStatus.DA_CAP_PHAT}</strong>
            <small>{summary.assignedRate}% trên thiết bị hoạt động</small>
          </article>
          <article className="metric-panel">
            <span className="metric-label">Giá trị ghi nhận</span>
            <strong>{formatMoney(summary.inventoryValue)}</strong>
            <small>Trong dữ liệu đã tải</small>
          </article>
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-section">
            <div className="section-heading">
              <h2>Trạng thái thiết bị</h2>
              <span>{loading ? "Đang tải..." : `${devices.length} thiết bị`}</span>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dashboard-section">
            <div className="section-heading">
              <h2>Phân bổ theo danh mục (Top 5)</h2>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={categoryData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.04)'}} />
                  <Bar dataKey="count" fill="var(--accent, #315a58)" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="dashboard-grid" style={{ marginTop: '18px' }}>
          <div className="dashboard-section">
            <div className="section-heading">
              <h2>Yêu cầu cấp phát gần đây</h2>
              <button className="link-button" onClick={() => navigate("/allocation-requests")}>
                Xem tất cả
              </button>
            </div>

            <div className="recent-list">
              {loading ? (
                <div className="empty-state">Đang tải dữ liệu...</div>
              ) : requests.length === 0 ? (
                <div className="empty-state">Chưa có yêu cầu nào.</div>
              ) : (
                requests.map((req) => (
                  <div className="recent-item" key={req.ID_YC}>
                    <div>
                      <strong>#{req.ID_YC} - {req.LoaiYeuCau === "CAP_PHAT" ? "Cấp phát" : "Thu hồi"}</strong>
                      <span>{req.HoTen || `NV #${req.ID_NV}`} • {req.TenThietBi || `TB #${req.ID_TB || "-"}`}</span>
                    </div>
                    <span className={`status-badge status-${req.TrangThaiDuyet === 'ChoDuyet' ? 'PENDING' : req.TrangThaiDuyet === 'DaDuyet' ? 'APPROVED' : 'REJECTED'}`}>
                      {req.TrangThaiDuyet === 'ChoDuyet' ? "Chờ duyệt" : req.TrangThaiDuyet === 'DaDuyet' ? "Đã duyệt" : "Từ chối"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-section">
            <div className="section-heading">
              <h2>Thiết bị thêm gần đây</h2>
              <button className="link-button" onClick={() => navigate("/devices")}>
                Xem tất cả
              </button>
            </div>

            <div className="recent-list">
              {loading ? (
                <div className="empty-state">Đang tải dữ liệu...</div>
              ) : recentDevices.length === 0 ? (
                <div className="empty-state">Chưa có thiết bị.</div>
              ) : (
                recentDevices.map((device) => (
                  <div className="recent-item" key={device.MaTB}>
                    <div>
                      <strong>{device.TenThietBi}</strong>
                      <span>{device.MaThietBi || `#${device.MaTB}`} · {device.LoaiThietBi}</span>
                    </div>
                    <span className={`status-badge status-${device.TrangThai}`}>
                      {STATUS_LABEL[device.TrangThai] || device.TrangThai}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
