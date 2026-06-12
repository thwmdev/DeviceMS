import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
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
  const fileInputRef = useRef(null);

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
  const [openModal, setOpenModal] = useState(false);
  

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

  const handleChooseFile = () => {
    console.log("Import clicked");
    console.log(fileInputRef.current);
    fileInputRef.current.click();
  };

  const handleImportExcel = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setLoading(false); // Đặt tạm hoặc bật loading tùy bạn

      const data = await file.arrayBuffer();
      // 1. QUAN TRỌNG: cellDates: true để ép excel parse ngày tháng thành Object Date của JS
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        alert("File Excel không có dữ liệu!");
        return;
      }

      let successCount = 0;

      // 2. Chuyển sang vòng lặp tuần tự để không bị crash nghẽn hệ thống
      for (const row of rows) {
        if (!row.TenThietBi || !row.LoaiThietBi) continue;

        // ── XỬ LÝ CHUẨN HÓA NGÀY MUA (Đưa về YYYY-MM-DD giống form nhập tay) ──
        let ngayMuaChuan = "";
        if (row.NgayMua) {
          if (row.NgayMua instanceof Date && !isNaN(row.NgayMua)) {
            const yyyy = row.NgayMua.getFullYear();
            const mm = String(row.NgayMua.getMonth() + 1).padStart(2, '0');
            const dd = String(row.NgayMua.getDate()).padStart(2, '0');
            ngayMuaChuan = `${yyyy}-${mm}-${dd}`; // Kết quả chuẩn: "2026-08-26"
          } else {
            // Nếu vẫn là chuỗi thô thì giữ nguyên hoặc xử lý chuỗi cắt ra
            ngayMuaChuan = row.NgayMua.toString().trim();
          }
        }

        // ── XỬ LÝ NGUYÊN GIÁ (Bỏ dấu phân cách thập phân kiểu Mỹ/Việt) ──
        let giaTriChuan = 0;
        if (row.GiaTri != null && row.GiaTri !== "") {
          let giaTriStr = row.GiaTri.toString().trim();
          if (giaTriStr.includes(",") && giaTriStr.includes(".")) {
            giaTriStr = giaTriStr.replace(/,/g, ""); // Xóa dấu phẩy hàng nghìn, giữ dấu chấm .00
          } else if (giaTriStr.includes(".") && giaTriStr.includes(",")) {
            giaTriStr = giaTriStr.replace(/\./g, "").replace(/,/g, "."); // Kiểu VN
          } else if (giaTriStr.includes(",") && !giaTriStr.includes(".")) {
            giaTriStr = giaTriStr.replace(/,/g, "");
          }
          const parsedValue = parseFloat(giaTriStr);
          giaTriChuan = !isNaN(parsedValue) ? Math.round(parsedValue) : 0;
        }

        // 3. Tiến hành gửi lên API giống cấu trúc form của bạn
        try {
          await axios.post(
            `${API_URL}/create`,
            {
              TenThietBi: row.TenThietBi.trim(),
              LoaiThietBi: row.LoaiThietBi.trim(),
              NgayMua: ngayMuaChuan, // Gửi chuỗi YYYY-MM-DD
              GiaTri: giaTriChuan,   // Gửi số nguyên chuẩn
              TrangThai: "SAN_SANG", // Đồng bộ text viết hoa
            },
            {
              headers: authHeader(),
            }
          );
          successCount++;
        } catch (rowErr) {
          console.error("Lỗi dòng Excel:", rowErr?.response?.data || rowErr.message);
        }
      }

      alert(`Import thành công ${successCount}/${rows.length} thiết bị!`);
      
      // ── ĐỒNG BỘ UI (Tự động load lại data không cần F5) ──
      setPage(1);
      await loadDevices();
      
      e.target.value = ""; // Reset input file
    } catch (err) {
      console.error(err);
      alert("Import thất bại!");
    }
  };


  // ── Debounce search: chờ 400ms sau lần gõ cuối rồi mới gọi API ─────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  
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

  // -- Load Category --------------------------------------------------  
  const loadCategories = async () => {
    try {
      const res = await axios.get(
        "http://127.0.0.1:5000/api/product-category/list?limit=100",
        {
          headers: authHeader()
        }
      );

      setCategories(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadCategories();}, []);
  useEffect(() => { loadDevices(); }, [loadDevices]);


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
    if (!window.confirm(`Thanh lý thiết bị "${tenThietBi}"?`)) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/delete/${matb}`, { headers: authHeader() });
      alert("Thanh lý thành công!");
      // Nếu trang hiện tại không còn dữ liệu sau khi xóa, lùi về trang trước
      if (devices.length === 1 && page > 1) setPage((p) => p - 1);
      else loadDevices();
    } catch (err) {
      handleAuthError(err);
      alert(err?.response?.data?.message || "Thanh lý thất bại.");
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

        <div className="add-device-action">
          <button className="btn-primary" onClick={() => {
            resetForm();
            setIsEditing(false);
            setOpenModal(true);
          }}
          >
            + Thêm thiết bị
          </button>

          <button
            className="btn-primary"
            onClick={handleChooseFile}
          >
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

        {openModal && (
          <div
            className="modal-overlay"
            onClick={() => setOpenModal(false)}
          >
            <div
              className="device-modal"
              onClick={(e) => e.stopPropagation()}
            >

              <div className="device-modal-header">
                <h2>
                  {isEditing
                    ? "Cập nhật thiết bị"
                    : "Thêm thiết bị mới"}
                </h2>

                <button
                  onClick={() => setOpenModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="device-modal-body">

                <div className="form-group">
                  <label>Tên thiết bị <span>*</span></label>
                  <input
                    type="text"
                    placeholder="VD: Laptop Dell Latitude 7440"
                    value={formData.TenThietBi}
                    onChange={(e) =>
                      setField("TenThietBi", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Loại thiết bị <span>*</span></label>

                  <select
                    value={formData.LoaiThietBi}
                    onChange={(e) => setField("LoaiThietBi", e.target.value)}
                  >
                    <option value="">Chọn loại thiết bị</option>

                    {categories.map((item) => (
                      <option
                        key={item.ID_DM}
                        value={item.TenDanhMuc}
                      >
                        {item.TenDanhMuc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">

                  <div className="form-group">
                    <label>Ngày mua</label>
                    <input 
                      type="date" 
                      value={formData.NgayMua}
                      onChange={(e) =>
                      setField("NgayMua", e.target.value)
                    } />
                  </div>

                  <div className="form-group">
                    <label>Nguyên giá (₫)</label>
                    <input
                      type="number"
                      placeholder="VD: 22000000"
                      value={formData.GiaTri}
                      onChange={(e) =>
                        setField("GiaTri", e.target.value)
                      }
                    />
                  </div>

                </div>

              </div>

              <div className="device-modal-footer">

                <button
                  className="btn-cancel"
                  onClick={() => setOpenModal(false)}
                >
                  Hủy
                </button>

                <button
                  className="btn-save"
                  onClick={async () => {
                    if (isEditing) {
                      await handleUpdate();
                    } else {
                      await handleCreate();
                    }

                    setOpenModal(false);
                  }}
                >
                  {isEditing
                    ? "Cập nhật"
                    : "Lưu thiết bị"}
                </button>

              </div>

            </div>
          </div>
        )}



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
              <th>Người dùng</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8">⏳ Đang tải dữ liệu...</td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan="8">Không có dữ liệu</td>
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
                    <span></span>
                  </td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => { handleEdit(device);; setOpenModal(true); }}
                      disabled={loading}
                    >
                      ✏️
                    </button>

                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(device.MaTB, device.TenThietBi)}
                      disabled={loading || device.TrangThai === "DA_CAP_PHAT" || device.TrangThai === "THANH_LY"}
                      title={
                        device.TrangThai === "DA_CAP_PHAT"
                          ? "Không thể xóa thiết bị đang cấp phát"
                          : "Thanh lý thiết bị",
                        device.TrangThai === "THANH_LY"
                          ? "Thiết bị đã được thanh lý!"
                          : "Thanh lý thiết bị."
                      }
                    >
                      🗑️
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
