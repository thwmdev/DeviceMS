import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";
import Sidebar from "../components/sidebar";

const API_URL = "http://127.0.0.1:5000/api/device";

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
      const res = await axios.get(`${API_URL}/list?page=1&limit=100`, {
        headers: authHeader(),
      });
      setDevices(res.data.data || []);
      setTotal(res.data.total || 0);
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

  const recentDevices = devices.slice(0, 6);
  const statusRows = Object.entries(summary.byStatus);

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
              <h2>Phân bổ trạng thái</h2>
              <span>{loading ? "Đang tải..." : `${devices.length} thiết bị`}</span>
            </div>

            <div className="status-stack">
              {statusRows.map(([status, count]) => {
                const percent = devices.length ? Math.round((count / devices.length) * 100) : 0;
                return (
                  <div className="status-row" key={status}>
                    <div className="status-row-top">
                      <span>{STATUS_LABEL[status] || status}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="status-track">
                      <span
                        className={`status-fill ${STATUS_TONE[status] || "ready"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <small>{percent}%</small>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dashboard-section">
            <div className="section-heading">
              <h2>Thiết bị gần đây</h2>
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
