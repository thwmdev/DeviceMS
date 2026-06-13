import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import "../index.css";
import "../App.css";
import Sidebar from "../components/sidebar";
import SortableHeader from "../components/SortableHeader";
import { getNextSort, sortRows } from "../utils/tableSort";

const API_URL = "http://127.0.0.1:5000/api/device";
const CATEGORY_API_URL = "http://127.0.0.1:5000/api/product-category";

const EMPTY_ROW = {
  TenThietBi: "",
  LoaiThietBi: "",
  NgayMua: "",
  GiaTri: "",
  TrangThai: "SAN_SANG",
};

const EMPTY_EDIT_FORM = {
  MaThietBi: "",
  TenThietBi: "",
  LoaiThietBi: "",
  NgayMua: "",
  GiaTri: "",
  TrangThai: "SAN_SANG",
};

const STATUS_LABEL = {
  SAN_SANG: "Sẵn sàng",
  DA_CAP_PHAT: "Đã cấp phát",
  THANH_LY: "Thanh lý",
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

export default function Devices() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Role
  const role = (localStorage.getItem("role") || "").toUpperCase();
  const isUser = role === "USER";

  // List state
  const [devices, setDevices] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "MaTB", direction: "asc" });

  // Batch filter
  const [batches, setBatches] = useState([]);
  const [batchFilter, setBatchFilter] = useState("");

  // Categories
  const [categories, setCategories] = useState([]);

  // Edit modal state (single device edit)
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_EDIT_FORM });
  const [editError, setEditError] = useState("");

  // Batch create modal state
  const [openBatchModal, setOpenBatchModal] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [batchRows, setBatchRows] = useState([{ ...EMPTY_ROW }]);
  const [batchError, setBatchError] = useState("");

  const authHeader = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        search,
      });
      if (batchFilter) params.set("batch_id", batchFilter);
      const res = await axios.get(`${API_URL}/list?${params.toString()}`, {
        headers: authHeader(),
      });
      setDevices(res.data.data || []);
      setTotalPages(res.data.total_pages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      handleAuthError(err);
      alert(err?.response?.data?.message || "Không tải được danh sách thiết bị.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, handleAuthError, page, search, batchFilter]);

  const loadBatches = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/batches`, { headers: authHeader() });
      setBatches(res.data.batches || []);
    } catch {
      // không cần alert
    }
  }, [authHeader]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${CATEGORY_API_URL}/list?limit=100`, {
        headers: authHeader(),
      });
      setCategories(res.data.data || []);
    } catch (err) {
      handleAuthError(err);
    }
  }, [authHeader, handleAuthError]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  useEffect(() => {
    if (!isUser) loadBatches();
  }, [loadBatches, isUser]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const tableRows = useMemo(() => devices.map((device) => ({
    ...device,
    TrangThaiText: STATUS_LABEL[device.TrangThai] || device.TrangThai,
  })), [devices]);

  const sortedDevices = useMemo(
    () => sortRows(tableRows, sortConfig),
    [tableRows, sortConfig],
  );

  // ── Batch create modal ──────────────────────────────────────────
  const openBatchCreateModal = () => {
    setBatchId(generateBatchId());
    setBatchRows([{ ...EMPTY_ROW }]);
    setBatchError("");
    setOpenBatchModal(true);
  };

  const setBatchRowField = (index, key, value) => {
    setBatchRows((prev) => prev.map((row, i) => i === index ? { ...row, [key]: value } : row));
  };

  const addBatchRow = () => setBatchRows((prev) => [...prev, { ...EMPTY_ROW }]);

  const removeBatchRow = (index) => {
    setBatchRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBatchCreate = async () => {
    const validRows = batchRows.filter((r) => r.TenThietBi.trim() && r.LoaiThietBi.trim());
    if (validRows.length === 0) {
      setBatchError("Cần ít nhất 1 dòng có tên và loại thiết bị.");
      return;
    }
    try {
      setLoading(true);
      let successCount = 0;
      for (const row of validRows) {
        try {
          await axios.post(
            `${API_URL}/create`,
            { ...row, MaDot: batchId },
            { headers: authHeader() },
          );
          successCount += 1;
        } catch (rowErr) {
          console.error("Lỗi dòng:", rowErr?.response?.data || rowErr.message);
        }
      }
      alert(`Thêm thành công ${successCount}/${validRows.length} thiết bị (đợt ${batchId}).`);
      setOpenBatchModal(false);
      await Promise.all([loadDevices(), loadBatches()]);
    } catch (err) {
      handleAuthError(err);
      setBatchError(err?.response?.data?.message || "Thêm thiết bị thất bại.");
    } finally {
      setLoading(false);
    }
  };

  // ── Single edit modal ───────────────────────────────────────────
  const handleOpenEditModal = (device) => {
    setEditingId(device.MaTB);
    setEditForm({
      MaThietBi: device.MaThietBi || "",
      TenThietBi: device.TenThietBi || "",
      LoaiThietBi: device.LoaiThietBi || "",
      NgayMua: device.NgayMua ? device.NgayMua.substring(0, 10) : "",
      GiaTri: device.GiaTri ?? "",
      TrangThai: device.TrangThai || "SAN_SANG",
    });
    setEditError("");
    setOpenEditModal(true);
  };

  const validateEditForm = () => {
    if (!String(editForm.MaThietBi).trim()) {
      setEditError("Mã thiết bị không được để trống.");
      return false;
    }
    if (!editForm.TenThietBi.trim()) {
      setEditError("Tên thiết bị không được để trống.");
      return false;
    }
    if (!editForm.LoaiThietBi.trim()) {
      setEditError("Loại thiết bị không được để trống.");
      return false;
    }
    if (editForm.GiaTri !== "" && Number(editForm.GiaTri) < 0) {
      setEditError("Giá trị không hợp lệ.");
      return false;
    }
    setEditError("");
    return true;
  };

  const handleUpdate = async () => {
    if (!validateEditForm()) return;
    try {
      setLoading(true);
      await axios.put(`${API_URL}/update/${editingId}`, editForm, { headers: authHeader() });
      alert("Cập nhật thiết bị thành công.");
      setOpenEditModal(false);
      await loadDevices();
    } catch (err) {
      handleAuthError(err);
      setEditError(err?.response?.data?.message || "Cập nhật thiết bị thất bại.");
    } finally {
      setLoading(false);
    }
  };

  // ── Delete (thanh lý) ───────────────────────────────────────────
  const handleDelete = async (matb, tenThietBi) => {
    if (!window.confirm(`Thanh lý thiết bị "${tenThietBi}"?`)) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/delete/${matb}`, { headers: authHeader() });
      alert("Thanh lý thành công.");
      if (devices.length === 1 && page > 1) setPage((current) => current - 1);
      else await loadDevices();
    } catch (err) {
      handleAuthError(err);
      alert(err?.response?.data?.message || "Thanh lý thất bại.");
    } finally {
      setLoading(false);
    }
  };

  // ── Excel import ────────────────────────────────────────────────
  const handleChooseFile = () => fileInputRef.current?.click();

  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) { alert("File Excel không có dữ liệu."); return; }

      const importBatchId = generateBatchId();
      let successCount = 0;
      for (const row of rows) {
        if (!row.TenThietBi || !row.LoaiThietBi) continue;
        try {
          await axios.post(
            `${API_URL}/create`,
            {
              TenThietBi: String(row.TenThietBi).trim(),
              LoaiThietBi: String(row.LoaiThietBi).trim(),
              NgayMua: formatDateInput(row.NgayMua),
              GiaTri: normalizeMoney(row.GiaTri),
              TrangThai: "SAN_SANG",
              MaDot: importBatchId,
            },
            { headers: authHeader() },
          );
          successCount += 1;
        } catch (rowErr) {
          console.error("Lỗi dòng Excel:", rowErr?.response?.data || rowErr.message);
        }
      }
      alert(`Import thành công ${successCount}/${rows.length} thiết bị (đợt ${importBatchId}).`);
      setPage(1);
      await Promise.all([loadDevices(), loadBatches()]);
    } catch (err) {
      console.error(err);
      alert("Import thất bại.");
    } finally {
      event.target.value = "";
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Sidebar />

      <main className="main-content">
        <div className="page-header module-header">
          <div>
            <p className="module-kicker">Kho thiết bị</p>
            <h1>{isUser ? "Thiết bị của công ty" : "Quản lý thiết bị"}</h1>
          </div>
          <span className="module-count">{total.toLocaleString("vi-VN")} thiết bị</span>
        </div>

        <div className="search-container">
          <input
            type="text"
            placeholder="Tìm kiếm theo mã hoặc tên thiết bị..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          {!isUser && batches.length > 0 && (
            <select
              className="filter-select"
              value={batchFilter}
              onChange={(event) => { setBatchFilter(event.target.value); setPage(1); }}
            >
              <option value="">Tất cả đợt nhập</option>
              {batches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
          {search && (
            <span className="search-result-hint">
              Kết quả cho &quot;{search}&quot;: {total} thiết bị
            </span>
          )}
        </div>

        {!isUser && (
          <div className="table-toolbar">
            <button className="btn-primary" onClick={openBatchCreateModal}>
              + Thêm thiết bị
            </button>
            <button className="btn-primary" onClick={handleChooseFile}>
              Import Excel
            </button>
            <input
              type="file"
              accept=".xlsx,.xls"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleImportExcel}
            />
          </div>
        )}

        <table className="device-table">
          <thead>
            <tr>
              <th>
                <SortableHeader
                  label="Mã"
                  sortKey="MaTB"
                  sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))}
                />
              </th>
              <th>
                <SortableHeader
                  label="Tên thiết bị"
                  sortKey="TenThietBi"
                  sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))}
                />
              </th>
              <th>
                <SortableHeader
                  label="Loại"
                  sortKey="LoaiThietBi"
                  sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))}
                />
              </th>
              <th>
                <SortableHeader
                  label="Ngày mua"
                  sortKey="NgayMua"
                  sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))}
                />
              </th>
              <th>
                <SortableHeader
                  label="Giá trị"
                  sortKey="GiaTri"
                  sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))}
                />
              </th>
              <th>
                <SortableHeader
                  label="Trạng thái"
                  sortKey="TrangThaiText"
                  sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))}
                />
              </th>
              {!isUser && <th>Hành động</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isUser ? 6 : 7}>Đang tải dữ liệu...</td>
              </tr>
            ) : sortedDevices.length === 0 ? (
              <tr>
                <td colSpan={isUser ? 6 : 7}>Không có dữ liệu</td>
              </tr>
            ) : (
              sortedDevices.map((device) => (
                <tr key={device.MaTB}>
                  <td>{device.MaThietBi}</td>
                  <td>{device.TenThietBi}</td>
                  <td>{device.LoaiThietBi}</td>
                  <td>{device.NgayMua ? new Date(device.NgayMua).toLocaleDateString("vi-VN") : "-"}</td>
                  <td>
                    {device.GiaTri !== null && device.GiaTri !== ""
                      ? `${Number(device.GiaTri).toLocaleString("vi-VN")} ₫`
                      : "-"}
                  </td>
                  <td>
                    <span className={`status-badge status-${device.TrangThai}`}>
                      {STATUS_LABEL[device.TrangThai] || device.TrangThai}
                    </span>
                  </td>
                  {!isUser && (
                    <td>
                      <div className="table-actions">
                        <button className="btn-edit" onClick={() => handleOpenEditModal(device)} disabled={loading}>
                          Sửa
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDelete(device.MaTB, device.TenThietBi)}
                          disabled={loading || device.TrangThai === "DA_CAP_PHAT" || device.TrangThai === "THANH_LY"}
                          title={
                            device.TrangThai === "DA_CAP_PHAT"
                              ? "Không thể thanh lý thiết bị đang cấp phát"
                              : "Thanh lý thiết bị"
                          }
                        >
                          Thanh lý
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="pagination">
          <button disabled={page === 1 || loading} onClick={() => setPage(1)}>«</button>
          <button disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)}>‹ Trước</button>
          <span>Trang {page} / {totalPages}</span>
          <button disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)}>Sau ›</button>
          <button disabled={page === totalPages || loading} onClick={() => setPage(totalPages)}>»</button>
        </div>

        {/* ── Batch create modal ─────────────────────────────────── */}
        {openBatchModal && (
          <div className="modal-overlay" onClick={() => setOpenBatchModal(false)}>
            <div className="device-modal batch-modal" onClick={(event) => event.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon">TB</div>
                  <div>
                    <h2>Thêm thiết bị mới</h2>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted, #888)" }}>
                      Mã đợt: <strong>{batchId}</strong>
                    </p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setOpenBatchModal(false)}>×</button>
              </div>

              <div className="device-modal-body">
                {batchError && <div className="form-error modal-error">{batchError}</div>}

                <div style={{ overflowX: "auto" }}>
                  <table className="device-table batch-input-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 30 }}>#</th>
                        <th style={{ minWidth: 200 }}>Tên thiết bị <span>*</span></th>
                        <th style={{ minWidth: 160 }}>Loại thiết bị <span>*</span></th>
                        <th style={{ minWidth: 140 }}>Ngày mua</th>
                        <th style={{ minWidth: 130 }}>Nguyên giá (₫)</th>
                        <th style={{ minWidth: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: "center", color: "var(--text-muted, #888)" }}>{idx + 1}</td>
                          <td>
                            <input
                              type="text"
                              style={{ width: "100%" }}
                              placeholder="VD: Laptop Dell Latitude"
                              value={row.TenThietBi}
                              onChange={(e) => setBatchRowField(idx, "TenThietBi", e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              style={{ width: "100%" }}
                              value={row.LoaiThietBi}
                              onChange={(e) => setBatchRowField(idx, "LoaiThietBi", e.target.value)}
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
                              onChange={(e) => setBatchRowField(idx, "NgayMua", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              style={{ width: "100%" }}
                              placeholder="0"
                              value={row.GiaTri}
                              onChange={(e) => setBatchRowField(idx, "GiaTri", e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {batchRows.length > 1 && (
                              <button
                                type="button"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", fontSize: "1rem" }}
                                onClick={() => removeBatchRow(idx)}
                                title="Xóa dòng này"
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
                  style={{ marginTop: "0.75rem" }}
                  onClick={addBatchRow}
                >
                  + Thêm dòng
                </button>
              </div>

              <div className="device-modal-footer">
                <button className="btn-cancel" onClick={() => setOpenBatchModal(false)} disabled={loading}>Hủy</button>
                <button className="btn-save" onClick={handleBatchCreate} disabled={loading}>
                  {loading ? "Đang lưu..." : `Lưu ${batchRows.length} thiết bị`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Single edit modal ──────────────────────────────────── */}
        {openEditModal && (
          <div className="modal-overlay" onClick={() => setOpenEditModal(false)}>
            <div className="device-modal" onClick={(event) => event.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon">TB</div>
                  <div>
                    <h2>Cập nhật thiết bị</h2>
                    <p>Chỉnh sửa thông tin thiết bị trong kho.</p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setOpenEditModal(false)}>×</button>
              </div>

              <div className="device-modal-body modal-form">
                {editError && <div className="form-error modal-error">{editError}</div>}

                <div className="form-group">
                  <label>Mã thiết bị <span>*</span></label>
                  <input
                    type="number"
                    value={editForm.MaThietBi}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, MaThietBi: e.target.value }))}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tên thiết bị <span>*</span></label>
                    <input
                      type="text"
                      value={editForm.TenThietBi}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, TenThietBi: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Loại thiết bị <span>*</span></label>
                    <select
                      value={editForm.LoaiThietBi}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, LoaiThietBi: e.target.value }))}
                    >
                      <option value="">Chọn loại thiết bị</option>
                      {categories.map((item) => (
                        <option key={item.ID_DM} value={item.TenDanhMuc}>{item.TenDanhMuc}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày mua</label>
                    <input
                      type="date"
                      value={editForm.NgayMua}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, NgayMua: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nguyên giá (₫)</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.GiaTri}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, GiaTri: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Trạng thái</label>
                  <select
                    value={editForm.TrangThai}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, TrangThai: e.target.value }))}
                  >
                    <option value="SAN_SANG">Sẵn sàng</option>
                    <option value="DA_CAP_PHAT">Đã cấp phát</option>
                    <option value="THANH_LY">Thanh lý</option>
                  </select>
                </div>
              </div>

              <div className="device-modal-footer">
                <button className="btn-cancel" onClick={() => setOpenEditModal(false)} disabled={loading}>Hủy</button>
                <button className="btn-save" onClick={handleUpdate} disabled={loading}>
                  {loading ? "Đang lưu..." : "Cập nhật"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
