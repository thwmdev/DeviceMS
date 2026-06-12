import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";
import Sidebar from "../components/sidebar";

const API_URL = "http://127.0.0.1:5000/api/product-category";

const EMPTY_FORM = {
  MaDanhMuc: "",
  TenDanhMuc: "",
  MoTa: "",
  TrangThai: "HoatDong",
};

const STATUS_LABEL = {
  HoatDong: "Hoạt động",
  TamDung: "Tạm dừng",
};

export default function ProductCategories() {
  const navigate = useNavigate();
  const canManageCategories = localStorage.getItem("role")?.toUpperCase() === "ADMIN";
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

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
      const res = await axios.get(
        `${API_URL}/list?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
        { headers: authHeader() }
      );
      setCategories(res.data.data || []);
      setTotalPages(res.data.total_pages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      handleAuthError(err);
      alert(err?.response?.data?.message || "Không tải được danh sách danh mục.");
    } finally {
      setLoading(false);
    }
  }, [page, search, authHeader, handleAuthError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setIsEditing(false);
    setEditingId(null);
    setFormError("");
  };

  const validateForm = () => {
    if (!formData.MaDanhMuc.trim()) {
      setFormError("Mã danh mục không được để trống.");
      return false;
    }
    if (!formData.TenDanhMuc.trim()) {
      setFormError("Tên danh mục không được để trống.");
      return false;
    }
    if (formData.MaDanhMuc.trim().length > 30) {
      setFormError("Mã danh mục không được vượt quá 30 ký tự.");
      return false;
    }
    if (formData.TenDanhMuc.trim().length > 100) {
      setFormError("Tên danh mục không được vượt quá 100 ký tự.");
      return false;
    }
    if (formData.MoTa.trim().length > 255) {
      setFormError("Mô tả không được vượt quá 255 ký tự.");
      return false;
    }
    setFormError("");
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      await axios.post(`${API_URL}/create`, formData, { headers: authHeader() });
      alert("Thêm danh mục thành công!");
      resetForm();
      loadCategories();
    } catch (err) {
      handleAuthError(err);
      setFormError(err?.response?.data?.message || "Thêm danh mục thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      await axios.put(`${API_URL}/update/${editingId}`, formData, { headers: authHeader() });
      alert("Cập nhật danh mục thành công!");
      resetForm();
      loadCategories();
    } catch (err) {
      handleAuthError(err);
      setFormError(err?.response?.data?.message || "Cập nhật danh mục thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category) => {
    setIsEditing(true);
    setEditingId(category.ID_DM);
    setFormData({
      MaDanhMuc: category.MaDanhMuc || "",
      TenDanhMuc: category.TenDanhMuc || "",
      MoTa: category.MoTa || "",
      TrangThai: category.TrangThai || "HoatDong",
    });
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleStatus = async (category) => {
    const nextLabel = category.TrangThai === "HoatDong" ? "tạm dừng" : "kích hoạt";
    if (!window.confirm(`Bạn muốn ${nextLabel} danh mục "${category.TenDanhMuc}"?`)) return;

    try {
      setLoading(true);
      await axios.put(`${API_URL}/toggle-status/${category.ID_DM}`, {}, { headers: authHeader() });
      loadCategories();
    } catch (err) {
      handleAuthError(err);
      alert(err?.response?.data?.message || "Cập nhật trạng thái thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Xóa danh mục "${category.TenDanhMuc}"?`)) return;

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/delete/${category.ID_DM}`, { headers: authHeader() });
      alert("Xóa danh mục thành công!");
      if (categories.length === 1 && page > 1) setPage((p) => p - 1);
      else loadCategories();
    } catch (err) {
      handleAuthError(err);
      alert(err?.response?.data?.message || "Xóa danh mục thất bại.");
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
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {search && (
            <span className="search-result-hint">
              Kết quả cho "{search}": {total} danh mục
            </span>
          )}
        </div>

        {canManageCategories ? (
          <div className="device-form category-form">
            <h2>{isEditing ? "Cập nhật danh mục" : "Thêm danh mục mới"}</h2>

            {formError && (
              <div className="form-error" style={{ gridColumn: "1 / -1" }}>
                {formError}
              </div>
            )}

            <input
              type="text"
              placeholder="Mã danh mục *"
              value={formData.MaDanhMuc}
              onChange={(e) => setField("MaDanhMuc", e.target.value.toUpperCase())}
            />
            <input
              type="text"
              placeholder="Tên danh mục *"
              value={formData.TenDanhMuc}
              onChange={(e) => setField("TenDanhMuc", e.target.value)}
            />
            <select
              value={formData.TrangThai}
              onChange={(e) => setField("TrangThai", e.target.value)}
            >
              <option value="HoatDong">Hoạt động</option>
              <option value="TamDung">Tạm dừng</option>
            </select>
            <textarea
              placeholder="Mô tả"
              value={formData.MoTa}
              onChange={(e) => setField("MoTa", e.target.value)}
            />

            <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
              {isEditing ? (
                <>
                  <button onClick={handleUpdate} disabled={loading} className="btn-primary">
                    {loading ? "Đang lưu..." : "Cập nhật"}
                  </button>
                  <button onClick={resetForm} disabled={loading} className="btn-secondary">
                    Hủy
                  </button>
                </>
              ) : (
                <button onClick={handleCreate} disabled={loading} className="btn-primary">
                  {loading ? "Đang lưu..." : "+ Thêm danh mục"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="readonly-note">Bạn đang xem danh mục ở chế độ chỉ đọc.</div>
        )}

        <table className="device-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên danh mục</th>
              <th>Mô tả</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6">Đang tải dữ liệu...</td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan="6">Không có dữ liệu</td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.ID_DM}>
                  <td>{category.MaDanhMuc}</td>
                  <td>{category.TenDanhMuc}</td>
                  <td>{category.MoTa || "-"}</td>
                  <td>
                    <span className={`status-badge category-status-${category.TrangThai}`}>
                      {STATUS_LABEL[category.TrangThai] || category.TrangThai}
                    </span>
                  </td>
                  <td>
                    {category.NgayCapNhat
                      ? new Date(category.NgayCapNhat).toLocaleDateString("vi-VN")
                      : "-"}
                  </td>
                  <td>
                    {canManageCategories ? (
                      <>
                        <button className="btn-edit" onClick={() => handleEdit(category)} disabled={loading}>
                          Sửa
                        </button>
                        <button
                          className="btn-secondary btn-toggle"
                          onClick={() => handleToggleStatus(category)}
                          disabled={loading}
                        >
                          {category.TrangThai === "HoatDong" ? "Tạm dừng" : "Kích hoạt"}
                        </button>
                        <button className="btn-delete" onClick={() => handleDelete(category)} disabled={loading}>
                          Xóa
                        </button>
                      </>
                    ) : (
                      <span className="table-muted">Chỉ xem</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="pagination">
          <button disabled={page === 1 || loading} onClick={() => setPage(1)}>
            «
          </button>
          <button disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}>
            ‹ Trước
          </button>
          <span>Trang {page} / {totalPages}</span>
          <button disabled={page === totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            Sau ›
          </button>
          <button disabled={page === totalPages || loading} onClick={() => setPage(totalPages)}>
            »
          </button>
        </div>
      </main>
    </div>
  );
}
