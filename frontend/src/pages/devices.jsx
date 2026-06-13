import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../index.css";
import "../App.css";
import Sidebar from "../components/sidebar";
import SortableHeader from "../components/SortableHeader";
import { getNextSort, sortRows } from "../utils/tableSort";

const API_URL = "http://127.0.0.1:5000/api/device";
const CATEGORY_API_URL = "http://127.0.0.1:5000/api/product-category";

const EMPTY_EDIT_FORM = {
  MaThietBi: "",
  TenThietBi: "",
  LoaiThietBi: "",
  SeriNumber: "",
  NgayMua: "",
  GiaTri: "",
  TrangThai: "SAN_SANG",
};

const STATUS_LABEL = {
  SAN_SANG: "Sẵn sàng",
  DA_CAP_PHAT: "Đã cấp phát",
  THANH_LY: "Thanh lý",
};

export default function Devices() {
  const navigate = useNavigate();

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

  // Metrics state
  const [metrics, setMetrics] = useState({ total: 0, available: 0, assigned: 0, disposed: 0 });

  // Edit modal state (single device edit)
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_EDIT_FORM });
  const [editError, setEditError] = useState("");

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
      // ignore
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

  const loadMetrics = useCallback(async () => {
    if (isUser) return;
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/inventory/stats", {
        headers: authHeader(),
      });
      const data = res.data.stats?.categories || [];
      let totalCount = 0, availableCount = 0, assignedCount = 0, disposedCount = 0;
      data.forEach((item) => {
        totalCount += item.total;
        availableCount += item.available;
        assignedCount += item.assigned;
        disposedCount += item.disposed;
      });
      setMetrics({
        total: totalCount,
        available: availableCount,
        assigned: assignedCount,
        disposed: disposedCount,
      });
    } catch {
      // ignore
    }
  }, [authHeader, isUser]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  useEffect(() => {
    if (!isUser) {
      loadBatches();
      loadMetrics();
    }
  }, [loadBatches, loadMetrics, isUser]);

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

  // ── Single edit modal ───────────────────────────────────────────
  const handleOpenEditModal = (device) => {
    setEditingId(device.MaTB);
    setEditForm({
      MaThietBi: device.MaThietBi || "",
      TenThietBi: device.TenThietBi || "",
      LoaiThietBi: device.LoaiThietBi || "",
      SeriNumber: device.SeriNumber || "",
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
      await Promise.all([loadDevices(), loadMetrics()]);
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
      else await Promise.all([loadDevices(), loadMetrics()]);
    } catch (err) {
      handleAuthError(err);
      alert(err?.response?.data?.message || "Thanh lý thất bại.");
    } finally {
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

        {/* Metrics Overview Panels */}
        {!isUser && (
          <div className="dashboard-metrics" style={{ marginBottom: "28px" }}>
            <div className="metric-panel metric-panel-strong">
              <span className="metric-label">Tổng số thiết bị</span>
              <strong>{metrics.total.toLocaleString("vi-VN")}</strong>
              <small>Có trong hệ thống</small>
            </div>
            <div className="metric-panel">
              <span className="metric-label" style={{ color: "var(--success, #2f7654)", fontWeight: "bold" }}>Sẵn sàng</span>
              <strong>{metrics.available.toLocaleString("vi-VN")}</strong>
              <small>Có thể cấp phát ngay</small>
            </div>
            <div className="metric-panel">
              <span className="metric-label" style={{ color: "var(--accent, #315a58)", fontWeight: "bold" }}>Đã cấp phát</span>
              <strong>{metrics.assigned.toLocaleString("vi-VN")}</strong>
              <small>Đang sử dụng</small>
            </div>
            <div className="metric-panel">
              <span className="metric-label" style={{ color: "var(--danger, #b4433b)", fontWeight: "bold" }}>Thanh lý</span>
              <strong>{metrics.disposed.toLocaleString("vi-VN")}</strong>
              <small>Đã ngừng sử dụng</small>
            </div>
          </div>
        )}

        <div className="search-container">
          <input
            type="text"
            placeholder="Tìm theo mã, tên thiết bị hoặc số seri..."
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
                  label="Số Seri"
                  sortKey="SeriNumber"
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
                <td colSpan={isUser ? 7 : 8}>Đang tải dữ liệu...</td>
              </tr>
            ) : sortedDevices.length === 0 ? (
              <tr>
                <td colSpan={isUser ? 7 : 8}>Không có dữ liệu</td>
              </tr>
            ) : (
              sortedDevices.map((device) => (
                <tr key={device.MaTB}>
                  <td>{device.MaThietBi}</td>
                  <td>{device.TenThietBi}</td>
                  <td><code style={{ fontStyle: "normal", color: "var(--ink-soft)" }}>{device.SeriNumber || "-"}</code></td>
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

                <div className="form-row">
                  <div className="form-group">
                    <label>Mã thiết bị <span>*</span></label>
                    <input
                      type="number"
                      value={editForm.MaThietBi}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, MaThietBi: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Số Seri</label>
                    <input
                      type="text"
                      placeholder="VD: SN-123456"
                      value={editForm.SeriNumber}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, SeriNumber: e.target.value }))}
                    />
                  </div>
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
