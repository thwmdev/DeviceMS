import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../index.css"
import "../App.css";
import Sidebar from "../components/sidebar";

const API_URL = "http://127.0.0.1:5000/api/device";
const CATEGORY_API_URL = "http://127.0.0.1:5000/api/product-category";

const EMPTY_FORM = {
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

const Devices = () => {
  const navigate = useNavigate();

  const [devices, setDevices] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");  // giá trị ô input
  const [search, setSearch] = useState("");  // giá trị thực gọi API (debounced)
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [categories, setCategories] = useState([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // ── Token helper ────────────────────────────────────────────────────────
  const getToken = () => localStorage.getItem("token");

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${getToken()}` }), []);

  // Khi token hết hạn / không hợp lệ → về login
  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  // ── Debounce search: chờ 400ms sau lần gõ cuối rồi mới gọi API ─────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${CATEGORY_API_URL}/list?page=1&limit=100`, {
        headers: authHeader(),
      });
      setCategories((res.data.data || []).filter((category) => category.TrangThai === "HoatDong"));
    } catch (err) {
      handleAuthError(err);
    }
  }, [authHeader, handleAuthError]);

  // ── Load danh sách ───────────────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_URL}/list?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
        { headers: authHeader() }
      );
      setDevices(res.data.data || []);
      setTotalPages(res.data.total_pages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      handleAuthError(err);
      alert(err?.response?.data?.message || "Không tải được danh sách thiết bị.");
    } finally {
      setLoading(false);
    }
  }, [page, search, authHeader, handleAuthError]);

  useEffect(() => { loadDevices(); }, [loadDevices]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  // ── Form helpers ─────────────────────────────────────────────────────────
  const setField = (key, value) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setIsEditing(false);
    setEditingId(null);
    setFormError("");
  };

  const validateForm = () => {
    if (isEditing && !formData.MaThietBi.trim()) { setFormError("Mã thiết bị không được để trống."); return false; }
    if (!formData.TenThietBi.trim()) { setFormError("Tên thiết bị không được để trống."); return false; }
    if (!formData.LoaiThietBi.trim()) { setFormError("Loại thiết bị không được để trống."); return false; }
    if (formData.GiaTri !== "" && Number(formData.GiaTri) < 0) {
      setFormError("Giá trị không hợp lệ.");
      return false;
    }
    setFormError("");
    return true;
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/create`, formData, { headers: authHeader() });
      alert(`Thêm thiết bị thành công! Mã thiết bị: ${res.data.MaThietBi}`);
      resetForm();
      loadDevices();
    } catch (err) {
      handleAuthError(err);
      setFormError(err?.response?.data?.message || "Thêm thiết bị thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      await axios.put(
        `${API_URL}/update/${editingId}`,
        formData,
        { headers: authHeader() }
      );
      alert("Cập nhật thành công!");
      resetForm();
      loadDevices();
    } catch (err) {
      handleAuthError(err);
      setFormError(err?.response?.data?.message || "Cập nhật thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (matb, tenThietBi) => {
    if (!window.confirm(`Xóa thiết bị "${tenThietBi}"?`)) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/delete/${matb}`, { headers: authHeader() });
      alert("Xóa thành công!");
      // Nếu trang hiện tại không còn dữ liệu sau khi xóa, lùi về trang trước
      if (devices.length === 1 && page > 1) setPage((p) => p - 1);
      else loadDevices();
    } catch (err) {
      handleAuthError(err);
      alert(err?.response?.data?.message || "Xóa thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (device) => {
    setIsEditing(true);
    setEditingId(device.MaTB);
    setFormData({
      MaThietBi: device.MaThietBi || "",
      TenThietBi: device.TenThietBi || "",
      LoaiThietBi: device.LoaiThietBi || "",
      NgayMua: device.NgayMua ? device.NgayMua.substring(0, 10) : "",
      GiaTri: device.GiaTri ?? "",
      TrangThai: device.TrangThai || "SAN_SANG",
    });
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <Sidebar />

      <div className="main-content">
        <div className="page-header module-header">
          <div>
            <p className="module-kicker">Kho thiết bị</p>
            <h1>Quản lý thiết bị</h1>
          </div>
          <span className="module-count">{total.toLocaleString("vi-VN")} thiết bị</span>
        </div>

        {/* ── Search ── */}
        <div className="search-container">
          <input
            type="text"
            placeholder="Tìm kiếm theo mã hoặc tên thiết bị..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {search && (
            <span className="search-result-hint">
              Kết quả tìm kiếm cho "{search}": {total} thiết bị
            </span>
          )}
        </div>

        {/* ── Form thêm / sửa ── */}
        <div className="device-form">
          <h2>{isEditing ? "Cập nhật thiết bị" : "Thêm thiết bị mới"}</h2>

          {formError && (
            <div className="form-error" style={{ gridColumn: "1 / -1" }}>
              ⚠️ {formError}
            </div>
          )}

          <input
            type="text"
            placeholder={isEditing ? "Mã thiết bị *" : "Mã thiết bị tự sinh khi lưu"}
            value={isEditing ? formData.MaThietBi : ""}
            onChange={(e) => setField("MaThietBi", e.target.value)}
            disabled={!isEditing}
          />
          <input
            type="text"
            placeholder="Tên thiết bị *"
            value={formData.TenThietBi}
            onChange={(e) => setField("TenThietBi", e.target.value)}
          />
          <input
            type="text"
            placeholder="Loại thiết bị *"
            list="device-category-options"
            value={formData.LoaiThietBi}
            onChange={(e) => setField("LoaiThietBi", e.target.value)}
          />
          <datalist id="device-category-options">
            {categories.map((category) => (
              <option key={category.ID_DM} value={category.TenDanhMuc}>
                {category.MaDanhMuc}
              </option>
            ))}
          </datalist>
          <input
            type="date"
            title="Ngày mua"
            value={formData.NgayMua}
            onChange={(e) => setField("NgayMua", e.target.value)}
          />
          <input
            type="number"
            placeholder="Giá trị (VNĐ)"
            min="0"
            value={formData.GiaTri}
            onChange={(e) => setField("GiaTri", e.target.value)}
          />
          <select
            value={formData.TrangThai}
            onChange={(e) => setField("TrangThai", e.target.value)}
          >
            <option value="SAN_SANG">Sẵn sàng</option>
            <option value="DA_CAP_PHAT">Đã cấp phát</option>
            <option value="THANH_LY">Thanh lý</option>
          </select>

          {/* Buttons – luôn nằm ở hàng cuối, full width */}
          <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
            {isEditing ? (
              <>
                <button onClick={handleUpdate} disabled={loading} className="btn-primary">
                  {loading ? "Đang lưu..." : "💾 Cập nhật"}
                </button>
                <button onClick={resetForm} disabled={loading} className="btn-secondary">
                  ✕ Hủy
                </button>
              </>
            ) : (
              <button onClick={handleCreate} disabled={loading} className="btn-primary">
                {loading ? "Đang lưu..." : "+ Thêm thiết bị"}
              </button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <table className="device-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên thiết bị</th>
              <th>Loại</th>
              <th>Ngày mua</th>
              <th>Giá trị</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7">⏳ Đang tải dữ liệu...</td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan="7">Không có dữ liệu</td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr key={device.MaTB}>
                  <td>{device.MaThietBi}</td>
                  <td>{device.TenThietBi}</td>
                  <td>{device.LoaiThietBi}</td>
                  <td>
                    {device.NgayMua
                      ? new Date(device.NgayMua).toLocaleDateString("vi-VN")
                      : "—"}
                  </td>
                  <td>
                    {device.GiaTri != null && device.GiaTri !== ""
                      ? Number(device.GiaTri).toLocaleString("vi-VN") + " ₫"
                      : "—"}
                  </td>
                  <td>
                    <span className={`status-badge status-${device.TrangThai}`}>
                      {STATUS_LABEL[device.TrangThai] || device.TrangThai}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => handleEdit(device)}
                      disabled={loading}
                    >
                      ✏️ Sửa
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(device.MaTB, device.TenThietBi)}
                      disabled={loading || device.TrangThai === "DA_CAP_PHAT"}
                      title={
                        device.TrangThai === "DA_CAP_PHAT"
                          ? "Không thể xóa thiết bị đang cấp phát"
                          : "Xóa thiết bị"
                      }
                    >
                      🗑️ Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* ── Pagination ── */}
        <div className="pagination">
          <button disabled={page === 1 || loading} onClick={() => setPage(1)}>
            «
          </button>
          <button disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}>
            ‹ Trước
          </button>
          <span>Trang {page} / {totalPages}</span>
          <button
            disabled={page === totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau ›
          </button>
          <button
            disabled={page === totalPages || loading}
            onClick={() => setPage(totalPages)}
          >
            »
          </button>
        </div>

      </div>
    </div>
  );
};

export default Devices;
