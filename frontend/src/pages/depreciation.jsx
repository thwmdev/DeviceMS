import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDepreciation } from "../hooks/depre";
import Sidebar from "../components/sidebar";
import Pagination from "../components/Pagination";
import DepreciationChart from "../components/depreChart";
import "../index.css";
import "../App.css";
import "../styles/depre.css";

const API_URL = "http://127.0.0.1:5000/api/depreciation";

const formatMoney = (value) => {
  const n = Number(value || 0);
  if (!n) return "0 đ";
  return `${n.toLocaleString("vi-VN")} đ`;
};

export default function Depreciation() {
  const navigate = useNavigate();
  const { formData, setFormData, saveConfig, fetchConfig, fetchHistory } = useDepreciation();

  // Data states
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Filter
  const [filter, setFilter] = useState({
    thang: new Date().getMonth() + 1,
    nam: new Date().getFullYear(),
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceHistory, setDeviceHistory] = useState([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ type: "", text: "" });

  // Run monthly
  const [runLoading, setRunLoading] = useState(false);
  const [runMsg, setRunMsg] = useState({ type: "", text: "" });

  const authHeader = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  // ─── Fetch report ───
  const fetchReport = useCallback(async (thang, nam) => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_URL}/report-by-month?thang=${thang}&nam=${nam}`,
        { headers: authHeader() }
      );
      setReportData(res.data || []);
    } catch (err) {
      handleAuthError(err);
      console.error("Lỗi lấy báo cáo:", err);
    } finally {
      setLoading(false);
    }
  }, [authHeader, handleAuthError]);

  useEffect(() => {
    fetchReport(filter.thang, filter.nam);
  }, [filter.thang, filter.nam, fetchReport]);

  // ─── Search debounce ───
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setCurrentPage(1); }, [search]);

  // ─── Filter + Paginate ───
  const filtered = useMemo(() => {
    if (!search.trim()) return reportData;
    const q = search.toLowerCase();
    return reportData.filter(
      (r) =>
        String(r.MaTB).includes(q) ||
        (r.TenThietBi || "").toLowerCase().includes(q)
    );
  }, [reportData, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const pageData = useMemo(
    () => filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filtered, currentPage]
  );

  // ─── Metrics ───
  const metrics = useMemo(() => {
    const data = reportData;
    return {
      tongNguyenGia: data.reduce((s, r) => s + Number(r.NguyenGia || r.GiaTriBanDau || 0), 0),
      tongKhauHaoThang: data.reduce((s, r) => s + Number(r.GiaTriKhauHaoThang || 0), 0),
      tongLuyKe: data.reduce((s, r) => s + Number(r.GiaTriLuyKe || 0), 0),
      tongConLai: data.reduce((s, r) => s + Number(r.GiaTriConLai || 0), 0),
    };
  }, [reportData]);

  // ─── Row click → open modal ───
  const handleRowClick = async (item) => {
    setSelectedDevice(item);
    setModalOpen(true);
    setSaveMsg({ type: "", text: "" });
    setConfigLoading(true);
    try {
      await fetchConfig(item.MaTB);
      const history = await fetchHistory(item.MaTB);
      setDeviceHistory(history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setConfigLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedDevice(null);
    setDeviceHistory([]);
    setSaveMsg({ type: "", text: "" });
  };

  // ─── Save config ───
  const handleSaveConfig = async () => {
    if (!selectedDevice) return;
    setSaveLoading(true);
    setSaveMsg({ type: "", text: "" });
    try {
      await saveConfig(selectedDevice.MaTB, {
        method: formData.method,
        usefulLife: formData.usefulLife,
        residualValue: formData.residualValue,
      });
      setSaveMsg({ type: "success", text: "Lưu cấu hình thành công!" });
    } catch (err) {
      setSaveMsg({ type: "error", text: err.response?.data?.message || "Lỗi lưu cấu hình" });
    } finally {
      setSaveLoading(false);
    }
  };

  // ─── Run monthly depreciation ───
  const handleRunMonthly = async () => {
    setRunLoading(true);
    setRunMsg({ type: "", text: "" });
    try {
      const res = await axios.post(`${API_URL}/run-monthly`, {}, { headers: authHeader() });
      const data = res.data;
      if (data.status === "skipped") {
        setRunMsg({ type: "warning", text: data.message });
      } else {
        setRunMsg({ type: "success", text: "Tính khấu hao tháng thành công!" });
        fetchReport(filter.thang, filter.nam);
      }
    } catch (err) {
      handleAuthError(err);
      setRunMsg({ type: "error", text: err.response?.data?.message || "Lỗi chạy khấu hao" });
    } finally {
      setRunLoading(false);
    }
  };

  // ─── Chart data ───
  const chartData = useMemo(() => {
    if (!deviceHistory || deviceHistory.length === 0) return [];
    return [...deviceHistory]
      .sort((a, b) => a.Nam - b.Nam || a.Thang - b.Thang)
      .map((h) => ({
        label: `T${h.Thang}/${h.Nam}`,
        GiaTriConLai: Number(h.GiaTriConLai || 0),
        GiaTriKhauHaoThang: Number(h.GiaTriKhauHaoThang || 0),
      }));
  }, [deviceHistory]);

  // ─── Calc percentage ───
  const calcPercent = (item) => {
    const base = Number(item.NguyenGia || item.GiaTriBanDau || 0);
    const luyKe = Number(item.GiaTriLuyKe || 0);
    if (!base) return 0;
    return Math.min(100, Math.round((luyKe / base) * 100));
  };

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content">
        {/* ─── Header ─── */}
        <div className="page-header">
          <div className="module-header">
            <div>
              <p className="module-kicker">QUẢN LÝ TÀI SẢN</p>
              <h1>Khấu hao</h1>
            </div>
            <span className="module-count">
              {reportData.length} thiết bị · Tháng {filter.thang}/{filter.nam}
            </span>
          </div>
        </div>

        {/* ─── Metrics ─── */}
        <div className="depre-metrics">
          <div className="metric-panel metric-panel-strong">
            <span className="metric-label">Tổng nguyên giá</span>
            <strong>{formatMoney(metrics.tongNguyenGia)}</strong>
            <small>Giá trị ban đầu tài sản</small>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Khấu hao tháng {filter.thang}</span>
            <strong>{formatMoney(metrics.tongKhauHaoThang)}</strong>
            <small>Chi phí KH tháng này</small>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Tổng lũy kế</span>
            <strong>{formatMoney(metrics.tongLuyKe)}</strong>
            <small>Đã khấu hao tích lũy</small>
          </div>
          <div className="metric-panel">
            <span className="metric-label">Giá trị còn lại</span>
            <strong>{formatMoney(metrics.tongConLai)}</strong>
            <small>Giá trị sổ sách hiện tại</small>
          </div>
        </div>

        {/* ─── Filter Bar ─── */}
        <div className="filter-bar" style={{ maxWidth: 1320, margin: "0 auto 20px" }}>
          <div className="filter-bar-left">
            <div className="search-input-wrap">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="filter-search-input"
                placeholder="Tìm mã TS hoặc tên thiết bị..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {search && (
                <span className="search-result-badge">{filtered.length}</span>
              )}
            </div>
            <select
              className="filter-select"
              value={filter.thang}
              onChange={(e) => setFilter({ ...filter, thang: Number(e.target.value) })}
            >
              {[...Array(12).keys()].map((i) => (
                <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={filter.nam}
              onChange={(e) => setFilter({ ...filter, nam: Number(e.target.value) })}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="filter-bar-right">
            <button
              className="depre-run-btn"
              onClick={handleRunMonthly}
              disabled={runLoading}
            >
              <i className="ti ti-calculator" />
              {runLoading ? "Đang chạy..." : "Chạy khấu hao tháng"}
            </button>
          </div>
        </div>

        {/* Run message */}
        {runMsg.text && (
          <div
            style={{ maxWidth: 1320, margin: "0 auto 14px" }}
            className={
              runMsg.type === "success"
                ? "status-badge active"
                : runMsg.type === "warning"
                ? "status-badge"
                : "form-error"
            }
            role="alert"
          >
            {runMsg.text}
          </div>
        )}

        {/* ─── Table ─── */}
        <table className="device-table" style={{ maxWidth: 1320, margin: "0 auto" }}>
          <thead>
            <tr>
              <th>MÃ TS</th>
              <th>TÊN TÀI SẢN</th>
              <th style={{ textAlign: "right" }}>NGUYÊN GIÁ</th>
              <th style={{ textAlign: "right" }}>KH THÁNG</th>
              <th style={{ textAlign: "right" }}>LŨY KẾ</th>
              <th style={{ textAlign: "right" }}>CÒN LẠI</th>
              <th>% KHẤU HAO</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: 40, color: "var(--ink-muted)" }}>
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan="7">
                  {search
                    ? `Không tìm thấy kết quả cho "${search}"`
                    : `Chưa có dữ liệu khấu hao tháng ${filter.thang}/${filter.nam}`}
                </td>
              </tr>
            ) : (
              pageData.map((item) => {
                const pct = calcPercent(item);
                return (
                  <tr
                    key={item.MaTB}
                    onClick={() => handleRowClick(item)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {item.MaTB}
                    </td>
                    <td style={{ fontWeight: 600 }}>{item.TenThietBi}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(item.NguyenGia || item.GiaTriBanDau)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--warning)" }}>
                      {formatMoney(item.GiaTriKhauHaoThang)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(item.GiaTriLuyKe)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                      {formatMoney(item.GiaTriConLai)}
                    </td>
                    <td>
                      <div className="depre-progress-wrap">
                        <div className="depre-progress">
                          <div
                            className="depre-progress-fill"
                            style={{
                              width: `${pct}%`,
                              background: pct >= 90 ? "var(--danger)" : pct >= 60 ? "var(--warning)" : "var(--accent)",
                            }}
                          />
                        </div>
                        <span className="depre-progress-text">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}

        {/* ═══════════════ DETAIL MODAL ═══════════════ */}
        {modalOpen && selectedDevice && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="device-modal wide-modal" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon" style={{ background: "#dce8e7", color: "#244745" }}>
                    <i className="ti ti-calculator" />
                  </div>
                  <div>
                    <h2>{selectedDevice.TenThietBi}</h2>
                    <p>Mã TS: {selectedDevice.MaTB} · Nguyên giá: {formatMoney(selectedDevice.NguyenGia || selectedDevice.GiaTriBanDau)}</p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={closeModal}>×</button>
              </div>

              {/* Body */}
              <div className="device-modal-body">
                {configLoading ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#9a948a" }}>
                    Đang tải cấu hình...
                  </div>
                ) : (
                  <>
                    {/* Current Config Summary */}
                    <div className="depre-config-card">
                      <div>
                        <span className="config-label">Phương pháp</span>
                        <span className="config-value">
                          {formData.method === "straight-line" ? "Đường thẳng" : "Số dư giảm dần"}
                        </span>
                      </div>
                      <div>
                        <span className="config-label">Thời gian sử dụng</span>
                        <span className="config-value">{formData.usefulLife} năm</span>
                      </div>
                      <div>
                        <span className="config-label">Giá trị thu hồi</span>
                        <span className="config-value">{formatMoney(formData.residualValue)}</span>
                      </div>
                    </div>

                    {/* Config Form */}
                    <div className="depre-section-title">
                      <i className="ti ti-settings" />
                      <span>Cập nhật cấu hình</span>
                    </div>
                    <div className="depre-config-grid">
                      <div className="form-group">
                        <label>Phương pháp tính</label>
                        <select
                          value={formData.method}
                          onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                        >
                          <option value="straight-line">Đường thẳng</option>
                          <option value="declining-balance">Số dư giảm dần</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Thời gian sử dụng (năm)</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={formData.usefulLife}
                          onChange={(e) => setFormData({ ...formData, usefulLife: Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Giá trị thu hồi (VND)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.residualValue}
                          onChange={(e) => setFormData({ ...formData, residualValue: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    {saveMsg.text && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 650,
                          background: saveMsg.type === "success" ? "rgba(47,118,84,0.18)" : "rgba(180,67,59,0.18)",
                          color: saveMsg.type === "success" ? "#7be0a8" : "#ffd7d0",
                          border: `1px solid ${saveMsg.type === "success" ? "rgba(47,118,84,0.3)" : "rgba(180,67,59,0.3)"}`,
                        }}
                      >
                        {saveMsg.text}
                      </div>
                    )}

                    {/* Chart */}
                    <div className="depre-section-title">
                      <i className="ti ti-chart-line" />
                      <span>Xu hướng giá trị còn lại</span>
                    </div>
                    <div className="depre-chart-wrap">
                      <DepreciationChart data={chartData} />
                    </div>

                    {/* History Table */}
                    <div className="depre-section-title">
                      <i className="ti ti-history" />
                      <span>Lịch sử khấu hao</span>
                    </div>
                    {deviceHistory.length === 0 ? (
                      <div className="depre-empty-chart">
                        <span>Chưa có lịch sử khấu hao</span>
                      </div>
                    ) : (
                      <table className="depre-history-table">
                        <thead>
                          <tr>
                            <th>Tháng/Năm</th>
                            <th>KH tháng</th>
                            <th>Giá trị còn lại</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deviceHistory.map((h, i) => (
                            <tr key={i}>
                              <td>{h.Thang}/{h.Nam}</td>
                              <td>{formatMoney(h.GiaTriKhauHaoThang)}</td>
                              <td>{formatMoney(h.GiaTriConLai)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="device-modal-footer">
                <div />
                <div className="footer-actions">
                  <button className="btn-cancel" onClick={closeModal}>Đóng</button>
                  <button
                    className="btn-save"
                    onClick={handleSaveConfig}
                    disabled={saveLoading}
                  >
                    {saveLoading ? "Đang lưu..." : "Lưu cấu hình"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}