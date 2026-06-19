import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";
import Sidebar from "../components/sidebar";
import SortableHeader from "../components/SortableHeader";
import Pagination from "../components/Pagination";
import { getNextSort, sortRows } from "../utils/tableSort";
import { useConfirm } from "../components/confirmContext";
import { toast } from "react-toastify";

const API_URL = "http://127.0.0.1:5000/api/product-category";

const EMPTY_ROW = {
  MaDanhMuc: "",
  TenDanhMuc: "",
  MoTa: "",
  TrangThai: "HoatDong",
};

const EMPTY_EDIT_FORM = {
  MaDanhMuc: "",
  TenDanhMuc: "",
  MoTa: "",
  TrangThai: "HoatDong",
};

const STATUS_LABEL = {
  HoatDong: "Hoạt động",
  TamDung: "Tạm dừng",
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
};

const generateBatchId = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${date}_${time}_${rand}`;
};

export default function ProductCategories() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const canManageCategories = localStorage.getItem("role")?.toUpperCase() === "ADMIN";

  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "MaDanhMuc", direction: "asc" });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  
  const [batches, setBatches] = useState([]);
  const [batchFilter, setBatchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  
  const [openBatchModal, setOpenBatchModal] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [batchRows, setBatchRows] = useState([{ ...EMPTY_ROW }]);
  const [batchError, setBatchError] = useState("");

  
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

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: "10000",
        search,
      });
      if (batchFilter) params.set("batch_id", batchFilter);
      const res = await axios.get(`${API_URL}/list?${params.toString()}`, {
        headers: authHeader(),
      });
      setCategories(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      handleAuthError(err);
      toast.error(err?.response?.data?.message || "Không tải được danh sách danh mục.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, handleAuthError, search, batchFilter]);

  const loadBatches = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/batches`, { headers: authHeader() });
      setBatches(res.data.batches || []);
    } catch {
      
    }
  }, [authHeader]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setCurrentPage(1); }, [search, batchFilter]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const tableRows = useMemo(() => {
    let result = categories.map((category) => ({
      ...category,
      TrangThaiText: STATUS_LABEL[category.TrangThai] || category.TrangThai,
    }));
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(c => 
        (c.TenDanhMuc || "").toLowerCase().includes(lowerSearch) ||
        (c.MaDanhMuc || "").toLowerCase().includes(lowerSearch)
      );
    }
    if (statusFilter) {
      result = result.filter(c => c.TrangThai === statusFilter);
    }
    return result;
  }, [categories, search, statusFilter]);

  const sortedCategories = useMemo(
    () => sortRows(tableRows, sortConfig),
    [tableRows, sortConfig],
  );

  const totalPages = Math.ceil(sortedCategories.length / itemsPerPage) || 1;
  const currentCategories = sortedCategories.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  
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
    const validRows = batchRows.filter((r) => r.MaDanhMuc.trim() && r.TenDanhMuc.trim());
    if (validRows.length === 0) {
      setBatchError("Cần ít nhất 1 dòng có mã và tên danh mục.");
      return;
    }
    try {
      setLoading(true);
      let successCount = 0;
      const errors = [];
      for (const row of validRows) {
        try {
          await axios.post(
            `${API_URL}/create`,
            { ...row, MaDanhMuc: row.MaDanhMuc.toUpperCase(), MaDot: batchId },
            { headers: authHeader() },
          );
          successCount += 1;
        } catch (rowErr) {
          const msg = rowErr?.response?.data?.message || rowErr.message;
          errors.push(`[${row.MaDanhMuc}] ${msg}`);
          console.error("Lỗi dòng:", msg);
        }
      }
      if (errors.length > 0) {
        toast.warning(`Thêm ${successCount}/${validRows.length} danh mục. Có ${errors.length} dòng lỗi.`);
      } else {
        toast.success(`Thêm thành công ${successCount}/${validRows.length} danh mục (đợt ${batchId}).`);
      }
      setOpenBatchModal(false);
      await Promise.all([loadCategories(), loadBatches()]);
    } catch (err) {
      handleAuthError(err);
      setBatchError(err?.response?.data?.message || "Thêm danh mục thất bại.");
    } finally {
      setLoading(false);
    }
  };

  
  const handleOpenEditModal = (category) => {
    setEditingId(category.ID_DM);
    setEditForm({
      MaDanhMuc: category.MaDanhMuc || "",
      TenDanhMuc: category.TenDanhMuc || "",
      MoTa: category.MoTa || "",
      TrangThai: category.TrangThai || "HoatDong",
    });
    setEditError("");
    setOpenEditModal(true);
  };

  const validateEditForm = () => {
    if (!editForm.MaDanhMuc.trim()) { setEditError("Mã danh mục không được để trống."); return false; }
    if (!editForm.TenDanhMuc.trim()) { setEditError("Tên danh mục không được để trống."); return false; }
    if (editForm.MaDanhMuc.trim().length > 30) { setEditError("Mã danh mục không được vượt quá 30 ký tự."); return false; }
    if (editForm.TenDanhMuc.trim().length > 100) { setEditError("Tên danh mục không được vượt quá 100 ký tự."); return false; }
    if (editForm.MoTa.trim().length > 255) { setEditError("Mô tả không được vượt quá 255 ký tự."); return false; }
    setEditError("");
    return true;
  };

  const handleUpdate = async () => {
    if (!validateEditForm()) return;
    try {
      setLoading(true);
      await axios.put(`${API_URL}/update/${editingId}`, editForm, { headers: authHeader() });
      toast.success("Cập nhật danh mục thành công.");
      setOpenEditModal(false);
      await loadCategories();
    } catch (err) {
      handleAuthError(err);
      setEditError(err?.response?.data?.message || "Cập nhật danh mục thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (category) => {
    const nextLabel = category.TrangThai === "HoatDong" ? "tạm dừng" : "kích hoạt";
    const accepted = await confirm({
      tone: category.TrangThai === "HoatDong" ? "warning" : "default",
      eyebrow: "Danh mục",
      title: "Cập nhật trạng thái danh mục",
      message: `Bạn muốn ${nextLabel} danh mục "${category.TenDanhMuc}"?`,
      confirmText: nextLabel === "tạm dừng" ? "Tạm dừng" : "Kích hoạt",
      cancelText: "Hủy",
    });
    if (!accepted) return;
    try {
      setLoading(true);
      await axios.put(`${API_URL}/toggle-status/${category.ID_DM}`, {}, { headers: authHeader() });
      toast.success("Cập nhật trạng thái danh mục thành công.");
      await loadCategories();
    } catch (err) {
      handleAuthError(err);
      toast.error(err?.response?.data?.message || "Cập nhật trạng thái thất bại.");
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
            <p className="module-kicker">Danh mục sản phẩm</p>
            <h1>Quản lý danh mục sản phẩm</h1>
          </div>
          <span className="module-count">{total.toLocaleString("vi-VN")} danh mục</span>
        </div>

        <div className="search-container">
          <input
            type="text"
            placeholder="Tìm theo mã, tên hoặc mô tả danh mục..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          {batches.length > 0 && (
            <select
              className="filter-select"
              value={batchFilter}
              onChange={(event) => { setBatchFilter(event.target.value); }}
            >
              <option value="">Tất cả đợt nhập</option>
              {batches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="HoatDong">Hoạt động</option>
            <option value="TamDung">Tạm dừng</option>
          </select>
          {search && (
            <span className="search-result-hint">
              Kết quả cho &quot;{search}&quot;: {total} danh mục
            </span>
          )}
        </div>

        {canManageCategories ? (
          <div className="table-toolbar">
            <button className="btn-primary" onClick={openBatchCreateModal}>
              + Thêm danh mục
            </button>
          </div>
        ) : (
          <div className="readonly-note">Bạn đang xem danh mục ở chế độ chỉ đọc.</div>
        )}

        <table className="device-table">
          <thead>
            <tr>
              <th>
                <SortableHeader label="Mã" sortKey="MaDanhMuc" sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))} />
              </th>
              <th>
                <SortableHeader label="Tên danh mục" sortKey="TenDanhMuc" sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))} />
              </th>
              <th>
                <SortableHeader label="Mô tả" sortKey="MoTa" sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))} />
              </th>
              <th>
                <SortableHeader label="Trạng thái" sortKey="TrangThaiText" sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))} />
              </th>
              <th>
                <SortableHeader label="Cập nhật" sortKey="NgayCapNhat" sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))} />
              </th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6">Đang tải dữ liệu...</td></tr>
            ) : currentCategories.length === 0 ? (
              <tr><td colSpan="6">Không có dữ liệu</td></tr>
            ) : (
              currentCategories.map((category) => (
                <tr key={category.ID_DM}>
                  <td>{category.MaDanhMuc}</td>
                  <td>{category.TenDanhMuc}</td>
                  <td>{category.MoTa || "-"}</td>
                  <td>
                    <span className={`status-badge category-status-${category.TrangThai}`}>
                      {STATUS_LABEL[category.TrangThai] || category.TrangThai}
                    </span>
                  </td>
                  <td>{formatDate(category.NgayCapNhat)}</td>
                  <td>
                    {canManageCategories ? (
                      <div className="table-actions">
                        <button className="btn-edit" onClick={() => handleOpenEditModal(category)} disabled={loading}>Sửa</button>
                        <button
                          className="btn-secondary btn-toggle"
                          onClick={() => handleToggleStatus(category)}
                          disabled={loading}
                        >
                          {category.TrangThai === "HoatDong" ? "Tạm dừng" : "Kích hoạt"}
                        </button>
                      </div>
                    ) : (
                      <span className="table-muted">Chỉ xem</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination 
          currentPage={currentPage} 
          totalPages={totalPages} 
          onPageChange={setCurrentPage} 
        />

        {}
        {openBatchModal && (
          <div className="modal-overlay" onClick={() => setOpenBatchModal(false)}>
            <div className="device-modal batch-modal" onClick={(event) => event.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon">DM</div>
                  <div>
                    <h2>Thêm danh mục mới</h2>
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
                        <th style={{ minWidth: 130 }}>Mã danh mục <span>*</span></th>
                        <th style={{ minWidth: 200 }}>Tên danh mục <span>*</span></th>
                        <th style={{ minWidth: 250 }}>Mô tả</th>
                        <th style={{ minWidth: 120 }}>Trạng thái</th>
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
                              placeholder="VD: LAPTOP"
                              value={row.MaDanhMuc}
                              onChange={(e) => setBatchRowField(idx, "MaDanhMuc", e.target.value.toUpperCase())}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              style={{ width: "100%" }}
                              placeholder="VD: Máy tính xách tay"
                              value={row.TenDanhMuc}
                              onChange={(e) => setBatchRowField(idx, "TenDanhMuc", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              style={{ width: "100%" }}
                              placeholder="Mô tả ngắn..."
                              value={row.MoTa}
                              onChange={(e) => setBatchRowField(idx, "MoTa", e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              style={{ width: "100%" }}
                              value={row.TrangThai}
                              onChange={(e) => setBatchRowField(idx, "TrangThai", e.target.value)}
                            >
                              <option value="HoatDong">Hoạt động</option>
                              <option value="TamDung">Tạm dừng</option>
                            </select>
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
                  {loading ? "Đang lưu..." : `Lưu ${batchRows.length} danh mục`}
                </button>
              </div>
            </div>
          </div>
        )}

        {}
        {openEditModal && (
          <div className="modal-overlay" onClick={() => setOpenEditModal(false)}>
            <div className="device-modal" onClick={(event) => event.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon">DM</div>
                  <div>
                    <h2>Cập nhật danh mục</h2>
                    <p>Chỉnh sửa thông tin danh mục thiết bị.</p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setOpenEditModal(false)}>×</button>
              </div>

              <div className="device-modal-body modal-form">
                {editError && <div className="form-error modal-error">{editError}</div>}

                <div className="form-row">
                  <div className="form-group">
                    <label>Mã danh mục <span>*</span></label>
                    <input
                      type="text"
                      value={editForm.MaDanhMuc}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, MaDanhMuc: e.target.value.toUpperCase() }))}
                      placeholder="VD: LAPTOP"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tên danh mục <span>*</span></label>
                    <input
                      type="text"
                      value={editForm.TenDanhMuc}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, TenDanhMuc: e.target.value }))}
                      placeholder="VD: Máy tính xách tay"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Trạng thái</label>
                  <select
                    value={editForm.TrangThai}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, TrangThai: e.target.value }))}
                    disabled
                    style={{ backgroundColor: "var(--bg-light)", cursor: "not-allowed", opacity: 0.8 }}
                    title="Trạng thái chỉ có thể thay đổi bằng nút Tạm dừng/Kích hoạt ở bảng danh sách."
                  >
                    <option value="HoatDong">Hoạt động</option>
                    <option value="TamDung">Tạm dừng</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Mô tả</label>
                  <textarea
                    value={editForm.MoTa}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, MoTa: e.target.value }))}
                    placeholder="Ghi chú ngắn về nhóm thiết bị này..."
                    rows={4}
                  />
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
