import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import Sidebar from "../components/sidebar";
import TotalDepreChart from "../components/TotalDepreChart";
import DeviceDepreChart from "../components/DeviceDepreChart";
import SortableHeader from "../components/SortableHeader";
import Pagination from "../components/Pagination";
import { getNextSort, sortRows } from "../utils/tableSort";
import "../styles/depre.css";
import { toast } from "react-toastify";

const API = "https://devicems-hd3z.onrender.com/api/depreciation";
const fmtVND = (v) => Number(v || 0).toLocaleString("vi-VN") + " đ";

function getHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}


function MonthlyTab() {
  const now = new Date();
  const [filter, setFilter] = useState({ thang: now.getMonth() + 1, nam: now.getFullYear() });
  const [report, setReport]       = useState([]);
  const [chartData, setChartData] = useState([]);
  const [running, setRunning]     = useState(false);
  const [savingId, setSavingId]   = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [sortCfg, setSortCfg]   = useState({ key: "MaTB", direction: "asc" });
  const [page, setPage]         = useState(1);
  const PER_PAGE = 10;

  const filteredChart = useMemo(() => {
    const now = new Date();
    const thangHT = now.getMonth() + 1;
    const namHT = now.getFullYear();

    return chartData.filter(item =>
      item.Nam < namHT ||
      (item.Nam === namHT && item.Thang <= thangHT)
    );
  }, [chartData]);
  // Fetch
  const loadReport = async (t, n) => {
    try {
      const r = await axios.get(`${API}/report-by-month?thang=${t}&nam=${n}`, { headers: getHeaders() });
      setReport(r.data || []);
    } catch { /* lỗi im lặng */ }
  };

  const loadChart = async () => {
    try {
      const r = await axios.get(`${API}/chart-data`, { headers: getHeaders() });
      setChartData(r.data || []);
    } catch { /* lỗi im lặng */ }
  };

  useEffect(() => { loadReport(filter.thang, filter.nam); }, [filter]);
  useEffect(() => { loadChart(); }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Chạy khấu hao
  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await axios.post(`${API}/run-monthly`, { thang: filter.thang, nam: filter.nam }, { headers: getHeaders() });
      toast.success(res.data.message);
      await loadReport(filter.thang, filter.nam);
      await loadChart();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi chạy khấu hao");
    } finally {
      setRunning(false);
    }
  };

  // Cập nhật thời gian sử dụng
  const updateLife = async (maTB, curVal, newVal) => {
    if (Number(newVal) === Number(curVal) || !newVal || newVal <= 0) return;

    
    const resetHistory = window.confirm(
      `Bạn có muốn XÓA lịch sử khấu hao cũ của thiết bị #${maTB} và tính lại từ đầu?\n` +
      `• Chọn OK  → Xóa lịch sử cũ, tính lại từ tháng đầu tiên.\n` +
      `• Chọn Hủy → Giữ lịch sử cũ, áp dụng thời gian mới từ tháng tiếp theo.`
    );

    setSavingId(maTB);
    try {
      const res = await axios.put(
        `https://devicems-hd3z.onrender.com/api/device/update-life/${maTB}`,
        { ThoiGianSuDung: Number(newVal), reset_history: resetHistory },
        { headers: getHeaders() }
      );
      toast.success(res.data?.message || "Đã cập nhật thời gian sử dụng!");
      await loadReport(filter.thang, filter.nam);
    } catch (err) {
      toast.error("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingId(null);
    }
  };


  // Excel
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(report.map((r) => ({
      "Mã TS": "TB" + String(r.MaTB).padStart(3, "0"),
      "Tên tài sản": r.TenThietBi,
      "Ngày nhập": r.NgayMua ? new Date(r.NgayMua).toLocaleDateString("vi-VN") : "",
      "Ngày cấp phát": r.NgayCapDauTien ? new Date(r.NgayCapDauTien).toLocaleDateString("vi-VN") : "",
      "Nguyên giá": r.NguyenGia,
      "TG sử dụng (năm)": r.ThoiGianSuDung,
      "KH tháng": r.GiaTriKhauHaoThang,
      "Lũy kế": r.GiaTriLuyKe,
      "Còn lại": r.GiaTriConLai,
      "Trạng thái": r.TrangThai,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KhauHao");
    XLSX.writeFile(wb, `KhauHao_T${filter.thang}_${filter.nam}.xlsx`);
  };

  // Summary
  const summary = report.reduce(
    (a, c) => ({
      nguyen: a.nguyen + Number(c.NguyenGia || 0),
      khauHao: a.khauHao + Number(c.GiaTriKhauHaoThang || 0),
      luyKe: a.luyKe + Number(c.GiaTriLuyKe || 0),
      conLai: a.conLai + Number(c.GiaTriConLai || 0),
    }),
    { nguyen: 0, khauHao: 0, luyKe: 0, conLai: 0 }
  );

  // Filter & sort
  const filtered = useMemo(() => {
    if (!search) return report;
    const q = search.toLowerCase();
    return report.filter(
      (d) =>
        String(d.MaTB).includes(q) ||
        (d.TenThietBi || "").toLowerCase().includes(q)
    );
  }, [report, search]);

  const sorted = useMemo(() => sortRows(filtered, sortCfg), [filtered, sortCfg]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const rows = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      {/* Filter bar */}
      <div className="filter-bar">
        <label>Tháng:</label>
        <select value={filter.thang} onChange={(e) => setFilter((f) => ({ ...f, thang: +e.target.value }))}>
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
          ))}
        </select>

        <label>Năm:</label>
        <select value={filter.nam} onChange={(e) => setFilter((f) => ({ ...f, nam: +e.target.value }))}>
          {[2023, 2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button className="btn-primary" onClick={handleRun} disabled={running}>
          {running ? <>Đang chạy… <span className="spinner" /></> : `Chạy khấu hao T${filter.thang}/${filter.nam}`}
        </button>
      </div>

      {/* Summary */}
      <div className="summary-grid">
        <div className="summary-card" style={{ borderLeftColor: "#3b82f6" }}>
          <div className="card-label">Tổng Nguyên giá</div>
          <div className="card-value" style={{ color: "#1d4ed8" }}>{fmtVND(summary.nguyen)}</div>
        </div>
        <div className="summary-card" style={{ borderLeftColor: "#f59e0b" }}>
          <div className="card-label">KH Tháng {filter.thang}/{filter.nam}</div>
          <div className="card-value" style={{ color: "#b45309" }}>{fmtVND(summary.khauHao)}</div>
        </div>
        <div className="summary-card" style={{ borderLeftColor: "#10b981" }}>
          <div className="card-label">Tổng Lũy kế</div>
          <div className="card-value" style={{ color: "#047857" }}>{fmtVND(summary.luyKe)}</div>
        </div>
        <div className="summary-card" style={{ borderLeftColor: "#ef4444" }}>
          <div className="card-label">Tổng Còn lại</div>
          <div className="card-value" style={{ color: "#b91c1c" }}>{fmtVND(summary.conLai)}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-card">
        <h3>Tổng khấu hao theo tháng (12 tháng gần nhất)</h3>
        <TotalDepreChart data={filteredChart} />
      </div>

      {/* Toolbar */}
      <div className="table-toolbar">
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn-secondary" onClick={exportExcel}>⬇ Xuất Excel</button>
        </div>
        <input
          className="search-input"
          placeholder="Tìm theo mã hoặc tên tài sản…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="depre-table-wrap">
        <table className="depre-table">
          <thead>
            <tr>
              <th><SortableHeader label="Mã TS" sortKey="MaTB" sortConfig={sortCfg} onSort={(k) => setSortCfg((c) => getNextSort(c, k))} /></th>
              <th><SortableHeader label="Tên tài sản" sortKey="TenThietBi" sortConfig={sortCfg} onSort={(k) => setSortCfg((c) => getNextSort(c, k))} /></th>
              <th><SortableHeader label="Ngày nhập" sortKey="NgayMua" sortConfig={sortCfg} onSort={(k) => setSortCfg((c) => getNextSort(c, k))} /></th>
              <th><SortableHeader label="Ngày cấp" sortKey="NgayCapDauTien" sortConfig={sortCfg} onSort={(k) => setSortCfg((c) => getNextSort(c, k))} /></th>
              <th><SortableHeader label="Nguyên giá" sortKey="NguyenGia" sortConfig={sortCfg} onSort={(k) => setSortCfg((c) => getNextSort(c, k))} /></th>
              <th>TG sử dụng</th>
              <th><SortableHeader label="KH Tháng" sortKey="GiaTriKhauHaoThang" sortConfig={sortCfg} onSort={(k) => setSortCfg((c) => getNextSort(c, k))} /></th>
              <th><SortableHeader label="Lũy kế" sortKey="GiaTriLuyKe" sortConfig={sortCfg} onSort={(k) => setSortCfg((c) => getNextSort(c, k))} /></th>
              <th><SortableHeader label="Còn lại" sortKey="GiaTriConLai" sortConfig={sortCfg} onSort={(k) => setSortCfg((c) => getNextSort(c, k))} /></th>
              <th><SortableHeader label="Trạng thái" sortKey="TrangThai" sortConfig={sortCfg} onSort={(k) => setSortCfg((c) => getNextSort(c, k))} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={10}>Không có dữ liệu cho tháng {filter.thang}/{filter.nam}</td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.MaTB}>
                  <td style={{ fontWeight: 600 }}>TB{String(item.MaTB).padStart(3, "0")}</td>
                  <td>{item.TenThietBi}</td>
                  <td>{item.NgayMua ? new Date(item.NgayMua).toLocaleDateString("vi-VN") : "-"}</td>
                  <td>{item.NgayCapDauTien ? new Date(item.NgayCapDauTien).toLocaleDateString("vi-VN") : "-"}</td>
                  <td className="num">{fmtVND(item.NguyenGia)}</td>
                  <td>
                    <div className="life-input-wrap">
                      <input
                        type="number" min={1}
                        defaultValue={item.ThoiGianSuDung || ""}
                        disabled={savingId === item.MaTB}
                        onBlur={(e) => updateLife(item.MaTB, item.ThoiGianSuDung, e.target.value)}
                      />
                      {savingId === item.MaTB && <span className="spinner" />}
                      <span className="year-label">năm</span>
                    </div>
                  </td>
                  <td className="num">{fmtVND(item.GiaTriKhauHaoThang)}</td>
                  <td className="num">{fmtVND(item.GiaTriLuyKe)}</td>
                  <td className="num" style={{ color: Number(item.GiaTriConLai) <= 0 ? "#ef4444" : "#047857" }}>
                    {fmtVND(item.GiaTriConLai)}
                  </td>
                  <td>
                    <span className={`status-badge status-${item.TrangThai}`}>
                      {item.TrangThai || "Chưa xác định"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}


function DeviceTab() {
  const [devices, setDevices]   = useState([]);
  const [selected, setSelected] = useState("");
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(false);

  // Filter cho list thiết bị
  const [searchDev, setSearchDev] = useState("");
  const [statusDev, setStatusDev] = useState("");

  useEffect(() => {
    axios
      .get(`${API}/devices`, { headers: getHeaders() })
      .then((r) => setDevices(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setHistory([]); return; }
    setLoading(true);
    axios
      .get(`${API}/history/${selected}`, { headers: getHeaders() })
      .then((r) => setHistory(r.data || []))
      .catch(() => toast.error("Không thể tải lịch sử thiết bị"))
      .finally(() => setLoading(false));
  }, [selected]);

  const selectedInfo = devices.find((d) => String(d.MaTB) === String(selected)) || null;



  const filteredDevices = useMemo(() => {
    let res = devices;
    if (searchDev) {
      const q = searchDev.toLowerCase();
      res = res.filter((d) =>
        String(d.MaTB).includes(q) ||
        (d.TenThietBi || "").toLowerCase().includes(q)
      );
    }
    if (statusDev) {
      res = res.filter((d) => {
        if (statusDev === "DangSuDung") return d.TrangThai === "DangSuDung" || d.TrangThai === "DA_CAP_PHAT";
        if (statusDev === "SanSang") return d.TrangThai === "SanSang" || d.TrangThai === "SAN_SANG";
        return d.TrangThai === statusDev;
      });
    }
    return res;
  }, [devices, searchDev, statusDev]);

  // Tổng lũy kế gần
  const latestRow = history.length > 0 ? history[history.length - 1] : null;

  return (
    <>

      <div className="filter-bar" style={{ flexDirection: "column", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", width: "100%", alignItems: "center" }}>
          <label>Tìm kiếm thiết bị:</label>
          <input
            className="search-input"
            placeholder="Tìm theo mã, tên..."
            value={searchDev}
            onChange={(e) => setSearchDev(e.target.value)}
          />

          <label>Trạng thái:</label>
          <select value={statusDev} onChange={(e) => setStatusDev(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="SanSang">Sẵn sàng</option>
            <option value="DangSuDung">Đang sử dụng / Cấp phát</option>
            <option value="BaoTri">Bảo trì</option>
            <option value="ThanhLy">Thanh lý</option>
          </select>
        </div>

        <div className="device-select-wrap" style={{ width: "100%" }}>
          <label>Chọn thiết bị ({filteredDevices.length}):</label>
          <select
            className="device-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            size={filteredDevices.length > 0 ? Math.min(6, filteredDevices.length + 1) : 2}
            style={{ width: "100%", padding: "4px", minHeight: "120px" }}
          >
            <option value="" disabled>-- Vui lòng click chọn một thiết bị bên dưới --</option>
            {filteredDevices.map((d) => (
              <option key={d.MaTB} value={d.MaTB} style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                TB{String(d.MaTB).padStart(3, "0")} – {d.TenThietBi} 
                {" "} | Giá trị: {fmtVND(d.NguyenGia)} 
                {" "} | Trạng thái: {d.TrangThai}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selected ? (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div>Hãy chọn một thiết bị để xem lịch sử khấu hao</div>
        </div>
      ) : (
        <>
          
          {selectedInfo && (
            <div className="device-info-bar">
              <div className="device-info-item">
                <div className="info-label">Nguyên giá</div>
                <div className="info-value">{fmtVND(selectedInfo.NguyenGia)}</div>
              </div>
              {latestRow && (
                <>
                  <div className="device-info-item">
                    <div className="info-label">Lũy kế đến nay</div>
                    <div className="info-value" style={{ color: "#10b981" }}>{fmtVND(latestRow.GiaTriLuyKe)}</div>
                  </div>
                  <div className="device-info-item">
                    <div className="info-label">Còn lại</div>
                    <div className="info-value" style={{ color: "#ef4444" }}>{fmtVND(latestRow.GiaTriConLai)}</div>
                  </div>
                  <div className="device-info-item">
                    <div className="info-label">Số tháng đã khấu hao</div>
                    <div className="info-value">{history.length} tháng</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Biểu đồ */}
          <div className="chart-card" style={{ marginTop: "16px" }}>
            <h3>Biểu đồ hao mòn — {selectedInfo?.TenThietBi}</h3>
            {loading ? (
              <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="spinner" style={{ width: 32, height: 32 }} />
              </div>
            ) : (
              <DeviceDepreChart data={history} />
            )}
          </div>

          {/* Bảng lịch sử */}
          <div className="depre-table-wrap" style={{ marginTop: "16px" }}>
            <table className="depre-table">
              <thead>
                <tr>
                  <th>Tháng / Năm</th>
                  <th>KH trong tháng</th>
                  <th>Lũy kế</th>
                  <th>Giá trị còn lại</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan={4}>Chưa có lịch sử tính khấu hao cho thiết bị này</td>
                  </tr>
                ) : (
                  // Hiển thị từ mới nhất xuống cũ nhất
                  [...history].reverse().map((h, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>
                        Tháng {h.Thang}/{h.Nam}
                      </td>
                      <td className="num">{fmtVND(h.GiaTriKhauHaoThang)}</td>
                      <td className="num" style={{ color: "#10b981" }}>{fmtVND(h.GiaTriLuyKe)}</td>
                      <td className="num" style={{ color: Number(h.GiaTriConLai) <= 0 ? "#ef4444" : "#374151", fontWeight: 600 }}>
                        {fmtVND(h.GiaTriConLai)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
export default function Depreciation() {
  const [tab, setTab] = useState("monthly");

  return (
    <div className="depre-page">
      <Sidebar />
      <main className="depre-main">
        {/* Header */}
        <div className="depre-header">
          <h1>Quản lý Khấu hao</h1>
          <div className="tab-group">
            <button
              className={`tab-btn ${tab === "monthly" ? "active" : ""}`}
              onClick={() => setTab("monthly")}
            >
              Theo Tháng
            </button>
            <button
              className={`tab-btn ${tab === "device" ? "active" : ""}`}
              onClick={() => setTab("device")}
            >
              Theo Thiết bị
            </button>
          </div>
        </div>

        {tab === "monthly" ? <MonthlyTab /> : <DeviceTab />}
      </main>
    </div>
  );
}
