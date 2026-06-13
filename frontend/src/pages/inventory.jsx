import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import Sidebar from "../components/sidebar";
import "../index.css";
import "../App.css";
import "../styles/inventory.css";

const DEVICE_API_URL = "http://127.0.0.1:5000/api/device";
const CATEGORY_API_URL = "http://127.0.0.1:5000/api/product-category";
const INVENTORY_API_URL = "http://127.0.0.1:5000/api/inventory";

const EMPTY_DEVICE_ROW = {
  TenThietBi: "",
  LoaiThietBi: "",
  SeriNumber: "",
  NgayMua: "",
  GiaTri: "",
  TrangThai: "SAN_SANG",
  SoLuong: 1,
};

const generateBatchId = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${date}_${time}_${rand}`;
};

const formatDateInput = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(value).trim();
};

const normalizeMoney = (value) => {
  if (value === null || value === undefined || value === "") return "";
  let text = String(value).trim();
  if (text.includes(".") && text.includes(",")) {
    text = text.replace(/\./g, "").replace(/,/g, ".");
  } else if (text.includes(",")) {
    text = text.replace(/,/g, "");
  }
  const parsed = Number.parseFloat(text);
  return Number.isNaN(parsed) ? "" : Math.round(parsed);
};

export default function Inventory() {
  const navigate = useNavigate();
  const excelInputRef = useRef(null);

  // States
  const [activeTab, setActiveTab] = useState("overview"); // overview, batches, history
  const [loading, setLoading] = useState(false);

  // Data
  const [stats, setStats] = useState({ categories: [], models: [] });
  const [batches, setBatches] = useState([]);
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [availableDevices, setAvailableDevices] = useState([]);

  // Modals
  const [openImportModal, setOpenImportModal] = useState(false);
  const [importBatchId, setImportBatchId] = useState("");
  const [importRows, setImportRows] = useState([{ ...EMPTY_DEVICE_ROW }]);
  const [importError, setImportError] = useState("");

  const [openDisposeModal, setOpenDisposeModal] = useState(false);
  const [disposeTargetId, setDisposeTargetId] = useState("");
  const [disposeError, setDisposeError] = useState("");

  // Batch Detail Modal
  const [openBatchDetailModal, setOpenBatchDetailModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [batchDevices, setBatchDevices] = useState([]);
  const [loadingBatchDevices, setLoadingBatchDevices] = useState(false);

  // Auth
  const authHeader = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  // Loaders
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${INVENTORY_API_URL}/stats`, { headers: authHeader() });
      setStats(res.data.stats || { categories: [], models: [] });
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  }, [authHeader, handleAuthError]);

  const loadBatches = useCallback(async () => {
    try {
      const res = await axios.get(`${INVENTORY_API_URL}/batches`, { headers: authHeader() });
      setBatches(res.data.batches || []);
    } catch (err) {
      handleAuthError(err);
    }
  }, [authHeader, handleAuthError]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${INVENTORY_API_URL}/transactions?limit=100`, { headers: authHeader() });
      setHistory(res.data.transactions || []);
    } catch (err) {
      handleAuthError(err);
    }
  }, [authHeader, handleAuthError]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${CATEGORY_API_URL}/list?limit=100`, { headers: authHeader() });
      setCategories(res.data.data || []);
    } catch (err) {
      handleAuthError(err);
    }
  }, [authHeader, handleAuthError]);

  const loadAvailableDevices = useCallback(async () => {
    try {
      const res = await axios.get(`${DEVICE_API_URL}/list?limit=1000`, { headers: authHeader() });
      // Lọc các thiết bị có trạng thái Sẵn sàng để thanh lý
      const list = (res.data.data || []).filter((d) => d.TrangThai === "SAN_SANG");
      setAvailableDevices(list);
    } catch (err) {
      handleAuthError(err);
    }
  }, [authHeader, handleAuthError]);

  // Initial Load
  useEffect(() => {
    loadStats();
    loadBatches();
    loadHistory();
    loadCategories();
  }, [loadStats, loadBatches, loadHistory, loadCategories]);

  // Tab switcher refresh
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    if (tabName === "overview") loadStats();
    else if (tabName === "batches") loadBatches();
    else if (tabName === "history") loadHistory();
  };

  // ── Nhập kho Modal (Batch Input / Excel) ──────────────────────────
  const openImport = () => {
    setImportBatchId(generateBatchId());
    setImportRows([{ ...EMPTY_DEVICE_ROW }]);
    setImportError("");
    setOpenImportModal(true);
  };

  const addImportRow = () => setImportRows((prev) => [...prev, { ...EMPTY_DEVICE_ROW }]);

  const removeImportRow = (index) => {
    setImportRows((prev) => prev.filter((_, i) => i !== index));
  };

  const setImportRowField = (index, key, value) => {
    setImportRows((prev) => prev.map((row, i) => i === index ? { ...row, [key]: value } : row));
  };

  const handleManualImport = async () => {
    const validRows = importRows.filter((r) => r.TenThietBi.trim() && r.LoaiThietBi.trim());
    if (validRows.length === 0) {
      setImportError("Cần điền tên và loại thiết bị cho ít nhất 1 dòng.");
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let totalToImport = 0;

      validRows.forEach((r) => {
        totalToImport += parseInt(r.SoLuong) || 1;
      });

      for (const row of validRows) {
        const qty = parseInt(row.SoLuong) || 1;
        for (let i = 0; i < qty; i++) {
          let seri = row.SeriNumber ? row.SeriNumber.trim() : "";
          if (qty > 1 && seri) {
            seri = `${seri}-${i + 1}`;
          }
          try {
            await axios.post(
              `${DEVICE_API_URL}/create`,
              {
                TenThietBi: row.TenThietBi,
                LoaiThietBi: row.LoaiThietBi,
                SeriNumber: seri || null,
                NgayMua: row.NgayMua || null,
                GiaTri: row.GiaTri || null,
                TrangThai: "SAN_SANG",
                MaDot: importBatchId,
              },
              { headers: authHeader() },
            );
            successCount += 1;
          } catch (rowErr) {
            console.error("Lỗi thêm thiết bị:", rowErr?.response?.data || rowErr.message);
          }
        }
      }
      alert(`Đã nhập kho thành công ${successCount}/${totalToImport} thiết bị (Mã đợt: ${importBatchId}).`);
      setOpenImportModal(false);
      handleTabChange("batches");
    } catch (err) {
      handleAuthError(err);
      setImportError(err?.response?.data?.message || "Nhập kho thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleChooseExcelFile = () => excelInputRef.current?.click();

  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        alert("File Excel không có dữ liệu.");
        return;
      }

      const excelBatchId = generateBatchId();
      let successCount = 0;
      let totalToImport = 0;

      for (const row of rows) {
        if (!row.TenThietBi || !row.LoaiThietBi) continue;

        const rawQty = row.SoLuong ?? row["Số lượng"] ?? row.soluong ?? 1;
        const qty = parseInt(rawQty) || 1;
        totalToImport += qty;

        for (let i = 0; i < qty; i++) {
          let seri = row.SeriNumber ? String(row.SeriNumber).trim() : "";
          if (qty > 1 && seri) {
            seri = `${seri}-${i + 1}`;
          }
          try {
            await axios.post(
              `${DEVICE_API_URL}/create`,
              {
                TenThietBi: String(row.TenThietBi).trim(),
                LoaiThietBi: String(row.LoaiThietBi).trim(),
                SeriNumber: seri || null,
                NgayMua: formatDateInput(row.NgayMua),
                GiaTri: normalizeMoney(row.GiaTri),
                TrangThai: "SAN_SANG",
                MaDot: excelBatchId,
              },
              { headers: authHeader() },
            );
            successCount += 1;
          } catch (rowErr) {
            console.error("Lỗi dòng Excel:", rowErr?.response?.data || rowErr.message);
          }
        }
      }
      alert(`Import thành công ${successCount}/${totalToImport} thiết bị từ file Excel (Mã đợt: ${excelBatchId}).`);
      setOpenImportModal(false);
      handleTabChange("batches");
    } catch (err) {
      console.error(err);
      alert("Đọc và import file Excel thất bại.");
    } finally {
      event.target.value = "";
      setLoading(false);
    }
  };

  // ── Thanh lý kho Modal (Disposal) ──────────────────────────────────
  const openDispose = async () => {
    setLoading(true);
    await loadAvailableDevices();
    setDisposeTargetId("");
    setDisposeError("");
    setOpenDisposeModal(true);
    setLoading(false);
  };

  const handleDispose = async () => {
    if (!disposeTargetId) {
      setDisposeError("Vui lòng chọn một thiết bị cần thanh lý.");
      return;
    }
    const devObj = availableDevices.find((d) => String(d.MaTB) === String(disposeTargetId));
    const label = devObj ? `"${devObj.TenThietBi}"` : `#${disposeTargetId}`;
    if (!window.confirm(`Bạn có chắc chắn muốn thanh lý thiết bị ${label} trực tiếp từ kho không?`)) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${DEVICE_API_URL}/delete/${disposeTargetId}`, { headers: authHeader() });
      alert("Thanh lý thiết bị thành công.");
      setOpenDisposeModal(false);
      handleTabChange("overview");
    } catch (err) {
      handleAuthError(err);
      setDisposeError(err?.response?.data?.message || "Thanh lý thiết bị thất bại.");
    } finally {
      setLoading(false);
    }
  };

  // ── Xem chi tiết thiết bị đợt nhập ───────────────────────────────
  const openBatchDetail = async (batchId) => {
    setSelectedBatchId(batchId);
    setOpenBatchDetailModal(true);
    setLoadingBatchDevices(true);
    try {
      const res = await axios.get(`${DEVICE_API_URL}/list?batch_id=${batchId}&limit=100`, {
        headers: authHeader(),
      });
      setBatchDevices(res.data.data || []);
    } catch (err) {
      console.error(err);
      alert("Không tải được chi tiết đợt nhập.");
    } finally {
      setLoadingBatchDevices(false);
    }
  };

  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content">
        <div className="inventory-sticky-header">
          <div className="page-header module-header" style={{ marginBottom: "20px" }}>
            <div>
              <p className="module-kicker">Quản trị kho vận</p>
              <h1>Quản lý kho thiết bị</h1>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button className="btn-primary" onClick={openImport} style={{ background: "var(--success, #2f7654)" }}>
                + Nhập kho thiết bị (Inbound)
              </button>
              <button className="btn-primary" onClick={openDispose} style={{ background: "var(--danger, #b4433b)" }}>
                ✕ Thanh lý thiết bị (Outbound)
              </button>
            </div>
          </div>

          {/* Tabs switcher */}
          <div className="inventory-tabs">
            <button
              className={`inventory-tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => handleTabChange("overview")}
            >
              Tổng quan kho
            </button>
            <button
              className={`inventory-tab-btn ${activeTab === "batches" ? "active" : ""}`}
              onClick={() => handleTabChange("batches")}
            >
              Lịch sử đợt nhập
            </button>
            <button
              className={`inventory-tab-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => handleTabChange("history")}
            >
              Nhật ký kho chi tiết
            </button>
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {loading ? (
              <p>Đang tải dữ liệu báo cáo...</p>
            ) : (
              <>
                {/* 1. Category stats table */}
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: "760", color: "var(--accent)", marginBottom: "12px" }}>
                    Tổng quan theo Loại thiết bị
                  </h2>
                  <table className="device-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Loại thiết bị</th>
                        <th>Tổng tồn kho</th>
                        <th>Sẵn sàng cấp</th>
                        <th>Đang cấp phát</th>
                        <th>Đã thanh lý</th>
                        <th>Tổng trị giá phân khu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!stats.categories || stats.categories.length === 0) ? (
                        <tr>
                          <td colSpan="6">Không có dữ liệu</td>
                        </tr>
                      ) : (
                        stats.categories.map((item) => (
                          <tr key={item.category}>
                            <td><strong>{item.category}</strong></td>
                            <td>{item.total} chiếc</td>
                            <td><span className="status-badge status-SAN_SANG">{item.available}</span></td>
                            <td><span className="status-badge status-DA_CAP_PHAT">{item.assigned}</span></td>
                            <td><span className="status-badge status-THANH_LY">{item.disposed}</span></td>
                            <td><strong>{item.value.toLocaleString("vi-VN")} ₫</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. Model stats table */}
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: "760", color: "var(--accent)", marginBottom: "12px" }}>
                    Thống kê chi tiết theo Dòng thiết bị (Model)
                  </h2>
                  <table className="device-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Tên dòng máy (Model)</th>
                        <th>Loại thiết bị</th>
                        <th>Tổng số lượng</th>
                        <th>Sẵn sàng cấp</th>
                        <th>Đang cấp phát</th>
                        <th>Đã thanh lý</th>
                        <th>Tổng giá trị</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!stats.models || stats.models.length === 0) ? (
                        <tr>
                          <td colSpan="7">Không có dữ liệu</td>
                        </tr>
                      ) : (
                        stats.models.map((item, idx) => (
                          <tr key={idx}>
                            <td><strong>{item.modelName}</strong></td>
                            <td>{item.category}</td>
                            <td>{item.total} chiếc</td>
                            <td><span className="status-badge status-SAN_SANG">{item.available}</span></td>
                            <td><span className="status-badge status-DA_CAP_PHAT">{item.assigned}</span></td>
                            <td><span className="status-badge status-THANH_LY">{item.disposed}</span></td>
                            <td><strong>{item.value.toLocaleString("vi-VN")} ₫</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Batches */}
        {activeTab === "batches" && (
          <div className="table-container">
            <table className="device-table">
              <thead>
                <tr>
                  <th>Mã đợt nhập</th>
                  <th>Ngày nhập</th>
                  <th>Tổng thiết bị</th>
                  <th>Sẵn có (ở kho)</th>
                  <th>Đã thanh lý</th>
                  <th>Tổng nguyên giá trị đợt</th>
                  <th style={{ textAlign: "center" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7">Đang tải danh sách đợt nhập...</td>
                  </tr>
                ) : batches.length === 0 ? (
                  <tr>
                    <td colSpan="7">Chưa có đợt nhập kho nào được đăng ký.</td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.batchId}>
                      <td>
                        <strong>{b.batchId}</strong>
                      </td>
                      <td>{b.date ? new Date(b.date).toLocaleDateString("vi-VN") : "-"}</td>
                      <td>{b.total} thiết bị</td>
                      <td>
                        <span className="status-badge status-SAN_SANG">{b.available}</span>
                      </td>
                      <td>
                        <span className="status-badge status-THANH_LY">{b.disposed}</span>
                      </td>
                      <td>
                        <strong>{b.value.toLocaleString("vi-VN")} ₫</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button className="btn-edit" onClick={() => openBatchDetail(b.batchId)}>
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Detailed History timeline */}
        {activeTab === "history" && (
          <div className="timeline-list">
            {loading ? (
              <p>Đang tải nhật ký kho...</p>
            ) : history.length === 0 ? (
              <p>Chưa ghi nhận hoạt động kho nào.</p>
            ) : (
              history.map((tx, idx) => (
                <div key={idx} className="timeline-item">
                  <div className={`timeline-icon ${tx.type}`}>
                    {tx.type === "IMPORT" ? "NHẬP" : tx.type === "ALLOCATE" ? "XUẤT" : tx.type === "RETURN" ? "THU" : "TLÝ"}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-title">
                        {tx.type === "IMPORT"
                          ? "Nhập kho thiết bị mới"
                          : tx.type === "ALLOCATE"
                          ? "Xuất kho cấp phát"
                          : tx.type === "RETURN"
                          ? "Thu hồi nhập lại kho"
                          : "Thanh lý thiết bị trực tiếp"}
                      </span>
                      <span className="timeline-date">{tx.date ? new Date(tx.date).toLocaleString("vi-VN") : "-"}</span>
                    </div>
                    <div className="timeline-body">{tx.description}</div>
                    <div className="timeline-meta">
                      <span>Thiết bị: <strong>{tx.name}</strong></span>
                      <span>Mã: <strong>#{tx.deviceId}</strong></span>
                      {tx.seri && (
                        <span>Số Seri: <code style={{ color: "var(--ink)", fontWeight: "bold" }}>{tx.seri}</code></span>
                      )}
                      <span>Giá trị: <strong>{tx.value.toLocaleString("vi-VN")} ₫</strong></span>
                      {tx.batchId && (
                        <span>Đợt: <strong>{tx.batchId}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Modal Nhập kho ──────────────────────────────────────── */}
        {openImportModal && (
          <div className="modal-overlay" onClick={() => setOpenImportModal(false)}>
            <div className="device-modal batch-modal wide-modal" onClick={(e) => e.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon" style={{ background: "var(--success)" }}>NK</div>
                  <div>
                    <h2>Nhập kho thiết bị mới</h2>
                    <p style={{ fontSize: "0.78rem" }}>
                      Mã đợt nhập: <strong>{importBatchId}</strong>
                    </p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setOpenImportModal(false)}>×</button>
              </div>

              <div className="device-modal-body">
                {importError && <div className="form-error modal-error">{importError}</div>}

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <button className="btn-primary" onClick={handleChooseExcelFile} style={{ background: "var(--accent)" }}>
                    Nhập từ File Excel (.xlsx)
                  </button>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    ref={excelInputRef}
                    style={{ display: "none" }}
                    onChange={handleImportExcel}
                  />
                  <span style={{ fontSize: "13px", color: "var(--ink-soft)", display: "flex", alignItems: "center" }}>
                    Hoặc nhập thủ công bảng bên dưới:
                  </span>
                </div>

                <div style={{ overflowX: "auto", maxHeight: "350px" }}>
                  <table className="device-table batch-input-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 30 }}>#</th>
                        <th style={{ minWidth: 200 }}>Tên thiết bị <span>*</span></th>
                        <th style={{ minWidth: 100 }}>Số lượng <span>*</span></th>
                        <th style={{ minWidth: 150 }}>Số Seri</th>
                        <th style={{ minWidth: 150 }}>Loại thiết bị <span>*</span></th>
                        <th style={{ minWidth: 130 }}>Ngày mua</th>
                        <th style={{ minWidth: 130 }}>Nguyên giá (₫)</th>
                        <th style={{ minWidth: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{idx + 1}</td>
                          <td>
                            <input
                              type="text"
                              style={{ width: "100%" }}
                              placeholder="VD: Laptop Dell XPS 13"
                              value={row.TenThietBi}
                              onChange={(e) => setImportRowField(idx, "TenThietBi", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              style={{ width: "100%" }}
                              value={row.SoLuong || 1}
                              onChange={(e) => setImportRowField(idx, "SoLuong", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              style={{ width: "100%" }}
                              placeholder="VD: SN-DELLXPS"
                              value={row.SeriNumber}
                              onChange={(e) => setImportRowField(idx, "SeriNumber", e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              style={{ width: "100%" }}
                              value={row.LoaiThietBi}
                              onChange={(e) => setImportRowField(idx, "LoaiThietBi", e.target.value)}
                            >
                              <option value="">Chọn loại</option>
                              {categories.map((item) => (
                                <option key={item.ID_DM} value={item.TenDanhMuc}>{item.TenDanhMuc}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="date"
                              style={{ width: "100%" }}
                              value={row.NgayMua}
                              onChange={(e) => setImportRowField(idx, "NgayMua", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              style={{ width: "100%" }}
                              placeholder="0"
                              value={row.GiaTri}
                              onChange={(e) => setImportRowField(idx, "GiaTri", e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {importRows.length > 1 && (
                              <button
                                type="button"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
                                onClick={() => removeImportRow(idx)}
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: "12px" }}
                  onClick={addImportRow}
                >
                  + Thêm dòng nhập tay
                </button>
              </div>

              <div className="device-modal-footer">
                <button className="btn-cancel" onClick={() => setOpenImportModal(false)} disabled={loading}>Hủy</button>
                <button className="btn-save" onClick={handleManualImport} disabled={loading} style={{ background: "var(--success)" }}>
                  {loading ? "Đang lưu..." : `Xác nhận nhập kho`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Thanh lý ──────────────────────────────────────── */}
        {openDisposeModal && (
          <div className="modal-overlay" onClick={() => setOpenDisposeModal(false)}>
            <div className="device-modal" onClick={(e) => e.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon" style={{ background: "var(--danger)" }}>TL</div>
                  <div>
                    <h2>Thanh lý thiết bị trực tiếp</h2>
                    <p>Chọn thiết bị đang sẵn sàng trong kho để thanh lý trực tiếp.</p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setOpenDisposeModal(false)}>×</button>
              </div>

              <div className="device-modal-body modal-form">
                {disposeError && <div className="form-error modal-error">{disposeError}</div>}

                <div className="form-group">
                  <label>Chọn thiết bị cần thanh lý <span>*</span></label>
                  <select
                    value={disposeTargetId}
                    onChange={(e) => setDisposeTargetId(e.target.value)}
                  >
                    <option value="">-- Chọn thiết bị trong kho --</option>
                    {availableDevices.map((dev) => (
                      <option key={dev.MaTB} value={dev.MaTB}>
                        {dev.TenThietBi} ({dev.LoaiThietBi}) {dev.SeriNumber ? `- S/N: ${dev.SeriNumber}` : ""} (#{dev.MaThietBi})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="device-modal-footer">
                <button className="btn-cancel" onClick={() => setOpenDisposeModal(false)} disabled={loading}>Hủy</button>
                <button className="btn-save" onClick={handleDispose} disabled={loading} style={{ background: "var(--danger)" }}>
                  {loading ? "Đang xử lý..." : "Xác nhận thanh lý"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Chi tiết đợt nhập ─────────────────────────────────── */}
        {openBatchDetailModal && (
          <div className="modal-overlay" onClick={() => setOpenBatchDetailModal(false)}>
            <div className="device-modal wide-modal" onClick={(e) => e.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon">CT</div>
                  <div>
                    <h2>Chi tiết đợt nhập kho</h2>
                    <p>
                      Mã đợt nhập: <strong>{selectedBatchId}</strong>
                    </p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setOpenBatchDetailModal(false)}>×</button>
              </div>

              <div className="device-modal-body">
                {loadingBatchDevices ? (
                  <p>Đang tải danh sách thiết bị...</p>
                ) : batchDevices.length === 0 ? (
                  <p>Không tìm thấy thiết bị nào thuộc đợt nhập này.</p>
                ) : (
                  <div className="batch-detail-list">
                    <table className="device-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Mã thiết bị</th>
                          <th>Tên thiết bị</th>
                          <th>Số Seri</th>
                          <th>Loại</th>
                          <th>Nguyên giá</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchDevices.map((dev) => (
                          <tr key={dev.MaTB}>
                            <td>{dev.MaThietBi}</td>
                            <td><strong>{dev.TenThietBi}</strong></td>
                            <td><code>{dev.SeriNumber || "-"}</code></td>
                            <td>{dev.LoaiThietBi}</td>
                            <td>{dev.GiaTri ? `${dev.GiaTri.toLocaleString("vi-VN")} ₫` : "-"}</td>
                            <td>
                              <span className={`status-badge status-${dev.TrangThai}`}>
                                {dev.TrangThai === "SAN_SANG" ? "Sẵn sàng" : dev.TrangThai === "DA_CAP_PHAT" ? "Đã cấp phát" : "Thanh lý"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="device-modal-footer">
                <button className="btn-cancel" onClick={() => setOpenBatchDetailModal(false)}>Đóng</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}