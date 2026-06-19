import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";
import Sidebar from "../components/sidebar";
import SortableHeader from "../components/SortableHeader";
import Pagination from "../components/Pagination";
import { getNextSort, sortRows } from "../utils/tableSort";
import { toast } from "react-toastify";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:5000/api" : "/api");
const API_URL = `${API_BASE_URL}/allocation-request`;

const REQUEST_TYPE_LABEL = {
  CAP_PHAT: "Cấp phát",
  THU_HOI: "Thu hồi",
};

const STATUS_LABEL = {
  ChoDuyet: "Chờ duyệt",
  DaDuyet: "Đã duyệt",
  TuChoi: "Từ chối",
};

const STATUS_CLASS = {
  ChoDuyet: "status-PENDING",
  DaDuyet: "status-APPROVED",
  TuChoi: "status-REJECTED",
};

const EMPTY_REQUEST_ROW = {
  LoaiYeuCau: "CAP_PHAT",
  ID_NV: "",
  ID_TB: "",
  ID_CP: "",
  NgayTraDuKien: "",
  LyDo: "",
};

const EMPTY_REVIEW_FORM = {
  GhiChuDuyet: "",
  TinhTrang: "Tốt, đủ điều kiện nhập kho",
  TrangThaiSauThuHoi: "SAN_SANG",
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
};

const getRole = () => localStorage.getItem("role")?.toUpperCase() || "NHANVIEN";

const generateBatchId = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${date}_${time}_${rand}`;
};


const getEmployeeIdFromToken = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    const raw = payload.id_nv ?? payload.employee_id ?? null;
    return raw !== null && raw !== undefined ? String(raw) : null;
  } catch {
    return null;
  }
};

export default function AllocationRequests() {
  const navigate = useNavigate();
  const role = getRole();
  const canApprove = role === "ADMIN";
  const isUser = role === "NHANVIEN";

  const [requests, setRequests] = useState([]);
  const [options, setOptions] = useState({
    employees: [],
    availableDevices: [],
    activeAssignments: [],
  });
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewForm, setReviewForm] = useState({ ...EMPTY_REVIEW_FORM });
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewAction, setReviewAction] = useState("approve");
  const [sortConfig, setSortConfig] = useState({ key: "ID_YC", direction: "desc" });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [batchRows, setBatchRows] = useState([{ ...EMPTY_REQUEST_ROW }]);
  const [batchError, setBatchError] = useState("");

  
  const [batches, setBatches] = useState([]);
  const [batchFilter, setBatchFilter] = useState("");

  const authHeader = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  const loadOptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/options`, { headers: authHeader() });
      setOptions({
        employees: res.data.employees || [],
        availableDevices: res.data.availableDevices || [],
        activeAssignments: res.data.activeAssignments || [],
      });
    } catch (err) {
      handleAuthError(err);
    }
  }, [authHeader, handleAuthError]);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "10000", search });
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (batchFilter) params.set("batch_id", batchFilter);
      const res = await axios.get(`${API_URL}/list?${params.toString()}`, { headers: authHeader() });
      setRequests(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      handleAuthError(err);
      toast.error(err?.response?.data?.message || "Không tải được danh sách yêu cầu.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, handleAuthError, search, statusFilter, typeFilter, batchFilter]);

  const loadBatches = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/batches`, { headers: authHeader() });
      setBatches(res.data.batches || []);
    } catch {
      
    }
  }, [authHeader]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { loadBatches(); }, [loadBatches]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setCurrentPage(1); }, [search, typeFilter, statusFilter, batchFilter]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const tableRows = useMemo(() => {
    let result = requests.map((item) => ({
      ...item,
      NhanVienText: item.HoTen ? `${item.HoTen} (#${item.ID_NV})` : `#${item.ID_NV}`,
      ThietBiText: item.TenThietBi ? `${item.TenThietBi} (#${item.ID_TB})` : `#${item.ID_TB || "-"}`,
      LoaiText: REQUEST_TYPE_LABEL[item.LoaiYeuCau] || item.LoaiYeuCau,
      TrangThaiText: STATUS_LABEL[item.TrangThaiDuyet] || item.TrangThaiDuyet,
    }));
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(r => 
        (r.HoTen || "").toLowerCase().includes(lowerSearch) ||
        (r.TenThietBi || "").toLowerCase().includes(lowerSearch) ||
        (r.LyDo || "").toLowerCase().includes(lowerSearch) ||
        String(r.ID_YC).includes(lowerSearch)
      );
    }
    if (typeFilter) {
      result = result.filter(r => r.LoaiYeuCau === typeFilter);
    }
    if (statusFilter) {
      result = result.filter(r => r.TrangThaiDuyet === statusFilter);
    }
    return result;
  }, [requests, search, typeFilter, statusFilter]);

  const sortedRequests = useMemo(() => sortRows(tableRows, sortConfig), [tableRows, sortConfig]);

  const totalPages = Math.ceil(sortedRequests.length / itemsPerPage) || 1;
  const currentRequests = sortedRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  
  const openNewRequest = () => {
    const newBatchId = generateBatchId();
    setBatchId(newBatchId);

    
    const firstRow = { ...EMPTY_REQUEST_ROW };
    if (isUser) {
      const empId = getEmployeeIdFromToken();
      if (empId) firstRow.ID_NV = empId;
    }
    setBatchRows([firstRow]);
    setBatchError("");
    setOpenCreateModal(true);
  };

  const setBatchRowField = (index, key, value) => {
    setBatchRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [key]: value };
      
      if (key === "LoaiYeuCau") {
        updated.ID_TB = "";
        updated.ID_CP = "";
        updated.NgayTraDuKien = "";
      }
      return updated;
    }));
  };

  const addBatchRow = () => {
    const newRow = { ...EMPTY_REQUEST_ROW };
    if (isUser) {
      const empId = getEmployeeIdFromToken();
      if (empId) newRow.ID_NV = empId;
    }
    setBatchRows((prev) => [...prev, newRow]);
  };

  const removeBatchRow = (index) => {
    setBatchRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBatchCreate = async () => {
    const validRows = batchRows.filter((r) => {
      if (r.LoaiYeuCau === "CAP_PHAT") return r.ID_NV && r.ID_TB;
      return r.ID_CP;
    });
    if (validRows.length === 0) {
      setBatchError("Cần ít nhất 1 yêu cầu hợp lệ (đủ nhân viên & thiết bị / lịch sử cấp phát).");
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
            { ...row, MaDot: batchId },
            { headers: authHeader() },
          );
          successCount += 1;
        } catch (rowErr) {
          const msg = rowErr?.response?.data?.message || rowErr.message;
          errors.push(msg);
          console.error("Lỗi dòng:", msg);
        }
      }
      if (errors.length > 0) {
        toast.warning(`Gửi ${successCount}/${validRows.length} yêu cầu. Có ${errors.length} dòng lỗi.`);
      } else {
        toast.success(`Gửi thành công ${successCount}/${validRows.length} yêu cầu (đợt ${batchId}).`);
      }
      setOpenCreateModal(false);
      await Promise.all([loadRequests(), loadOptions(), loadBatches()]);
    } catch (err) {
      handleAuthError(err);
      setBatchError(err?.response?.data?.message || "Tạo yêu cầu thất bại.");
    } finally {
      setLoading(false);
    }
  };

  
  const openReview = (requestItem, action) => {
    setReviewTarget(requestItem);
    setReviewAction(action);
    setReviewForm({ ...EMPTY_REVIEW_FORM });
    setReviewError("");
  };

  const closeReview = () => { setReviewTarget(null); setReviewError(""); };

  const setReviewField = (key, value) => setReviewForm((prev) => ({ ...prev, [key]: value }));

  const handleReview = async () => {
    if (!reviewTarget) return;
    try {
      setLoading(true);
      const endpoint = reviewAction === "approve" ? "approve" : "reject";
      await axios.put(`${API_URL}/${endpoint}/${reviewTarget.ID_YC}`, reviewForm, { headers: authHeader() });
      closeReview();
      await Promise.all([loadRequests(), loadOptions()]);
    } catch (err) {
      handleAuthError(err);
      setReviewError(err?.response?.data?.message || "Cập nhật yêu cầu thất bại.");
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
            <p className="module-kicker">Luồng cấp phát</p>
            <h1>Yêu cầu cấp phát / thu hồi</h1>
          </div>
          <span className="module-count">{total.toLocaleString("vi-VN")} yêu cầu</span>
        </div>

        <div className="filter-bar">
          <div className="filter-bar-left">
            <div className="search-input-wrap">
              <svg className="search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                className="filter-search-input"
                placeholder="Tìm mã, nhân viên, thiết bị, lý do..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {search && (
                <span className="search-result-badge">{total}</span>
              )}
            </div>

            <select
              className="filter-select"
              value={typeFilter}
              onChange={(event) => { setTypeFilter(event.target.value); }}
            >
              <option value="">Tất cả loại</option>
              <option value="CAP_PHAT">Cấp phát</option>
              <option value="THU_HOI">Thu hồi</option>
            </select>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ChoDuyet">Chờ duyệt</option>
              <option value="DaDuyet">Đã duyệt</option>
              <option value="TuChoi">Từ chối</option>
            </select>

            {batches.length > 0 && (
              <select
                className="filter-select"
                value={batchFilter}
                onChange={(event) => { setBatchFilter(event.target.value); }}
              >
                <option value="">Tất cả đợt</option>
                {batches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>

          <div className="filter-bar-right">
            <button className="btn-primary" onClick={openNewRequest}>
              + Tạo yêu cầu
            </button>
          </div>
        </div>

        <table className="device-table allocation-table">
          <thead>
            <tr>
              <th><SortableHeader label="Mã" sortKey="ID_YC" sortConfig={sortConfig} onSort={(key) => setSortConfig((c) => getNextSort(c, key))} /></th>
              <th><SortableHeader label="Loại" sortKey="LoaiText" sortConfig={sortConfig} onSort={(key) => setSortConfig((c) => getNextSort(c, key))} /></th>
              <th><SortableHeader label="Nhân viên" sortKey="NhanVienText" sortConfig={sortConfig} onSort={(key) => setSortConfig((c) => getNextSort(c, key))} /></th>
              <th><SortableHeader label="Thiết bị" sortKey="ThietBiText" sortConfig={sortConfig} onSort={(key) => setSortConfig((c) => getNextSort(c, key))} /></th>
              <th><SortableHeader label="Ngày gửi" sortKey="NgayGui" sortConfig={sortConfig} onSort={(key) => setSortConfig((c) => getNextSort(c, key))} /></th>
              <th><SortableHeader label="Trạng thái" sortKey="TrangThaiText" sortConfig={sortConfig} onSort={(key) => setSortConfig((c) => getNextSort(c, key))} /></th>
              <th>Lý do / ghi chú</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8">Đang tải dữ liệu...</td></tr>
            ) : currentRequests.length === 0 ? (
              <tr><td colSpan="8">Chưa có yêu cầu nào.</td></tr>
            ) : (
              currentRequests.map((item) => (
                <tr key={item.ID_YC}>
                  <td>#{item.ID_YC}</td>
                  <td>
                    <span className={`request-type-badge type-${item.LoaiYeuCau}`}>
                      {REQUEST_TYPE_LABEL[item.LoaiYeuCau] || item.LoaiYeuCau}
                    </span>
                  </td>
                  <td>
                    <strong>{item.HoTen || `NV #${item.ID_NV}`}</strong>
                    {item.PhongBan && <small className="table-muted block-text">{item.PhongBan}</small>}
                  </td>
                  <td>
                    <strong>{item.TenThietBi || `TB #${item.ID_TB || "-"}`}</strong>
                    {item.LoaiThietBi && <small className="table-muted block-text">{item.LoaiThietBi}</small>}
                  </td>
                  <td>{formatDate(item.NgayGui)}</td>
                  <td>
                    <span className={`status-badge ${STATUS_CLASS[item.TrangThaiDuyet] || ""}`}>
                      {STATUS_LABEL[item.TrangThaiDuyet] || item.TrangThaiDuyet}
                    </span>
                    {item.NgayDuyet && (
                      <small className="table-muted block-text">
                        {formatDate(item.NgayDuyet)} bởi {item.NguoiDuyet || "system"}
                      </small>
                    )}
                  </td>
                  <td>
                    <span>{item.LyDo || "-"}</span>
                    {item.GhiChuDuyet && (
                      <small className="table-muted block-text">Duyệt: {item.GhiChuDuyet}</small>
                    )}
                  </td>
                  <td>
                    {canApprove && item.TrangThaiDuyet === "ChoDuyet" ? (
                      <div className="table-actions">
                        <button className="btn-edit" onClick={() => openReview(item, "approve")} disabled={loading}>Chấp nhận</button>
                        <button className="btn-delete" onClick={() => openReview(item, "reject")} disabled={loading}>Từ chối</button>
                      </div>
                    ) : (
                      <span className="table-muted">Không cần xử lý</span>
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
        {openCreateModal && (
          <div className="modal-overlay" onClick={() => setOpenCreateModal(false)}>
            <div className="device-modal batch-modal wide-modal" onClick={(event) => event.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon">YC</div>
                  <div>
                    <h2>Tạo yêu cầu</h2>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted, #888)" }}>
                      Mã đợt: <strong>{batchId}</strong>
                    </p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setOpenCreateModal(false)}>×</button>
              </div>

              <div className="device-modal-body">
                {batchError && <div className="form-error modal-error">{batchError}</div>}

                <div style={{ overflowX: "auto" }}>
                  <table className="device-table batch-input-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 30 }}>#</th>
                        <th style={{ minWidth: 130 }}>Loại yêu cầu</th>
                        <th style={{ minWidth: 180 }}>Nhân viên nhận</th>
                        <th style={{ minWidth: 180 }}>Thiết bị / Cấp phát</th>
                        <th style={{ minWidth: 140 }}>Ngày trả dự kiến</th>
                        <th style={{ minWidth: 200 }}>Lý do</th>
                        <th style={{ minWidth: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: "center", color: "var(--text-muted, #888)" }}>{idx + 1}</td>

                          {}
                          <td>
                            <select
                              style={{ width: "100%" }}
                              value={row.LoaiYeuCau}
                              onChange={(e) => setBatchRowField(idx, "LoaiYeuCau", e.target.value)}
                            >
                              <option value="CAP_PHAT">Cấp phát</option>
                              <option value="THU_HOI">Thu hồi</option>
                            </select>
                          </td>

                          {}
                          <td>
                            {row.LoaiYeuCau === "CAP_PHAT" ? (
                              <select
                                style={{ width: "100%" }}
                                value={row.ID_NV}
                                disabled={isUser}
                                onChange={(e) => setBatchRowField(idx, "ID_NV", e.target.value)}
                              >
                                <option value="">Chọn nhân viên</option>
                                {options.employees.map((emp) => (
                                  <option key={emp.ID_NV} value={emp.ID_NV}>
                                    {emp.HoTen} - {emp.PhongBan || `NV #${emp.ID_NV}`}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #888)" }}>
                                (lấy từ cấp phát)
                              </span>
                            )}
                          </td>

                          {}
                          <td>
                            {row.LoaiYeuCau === "CAP_PHAT" ? (
                              <select
                                style={{ width: "100%" }}
                                value={row.ID_TB}
                                onChange={(e) => setBatchRowField(idx, "ID_TB", e.target.value)}
                              >
                                <option value="">Chọn thiết bị sẵn sàng</option>
                                {options.availableDevices.map((device) => (
                                  <option key={device.ID_TB} value={device.ID_TB}>
                                    {device.TenThietBi} - {device.LoaiThietBi || `TB #${device.ID_TB}`}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                style={{ width: "100%" }}
                                value={row.ID_CP}
                                onChange={(e) => setBatchRowField(idx, "ID_CP", e.target.value)}
                              >
                                <option value="">Chọn thiết bị đang cấp phát</option>
                                {options.activeAssignments.map((assignment) => (
                                  <option key={assignment.ID_CP} value={assignment.ID_CP}>
                                    #{assignment.ID_CP} - {assignment.TenThietBi} / {assignment.HoTen}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          {}
                          <td>
                            {row.LoaiYeuCau === "CAP_PHAT" ? (
                              <input
                                type="date"
                                style={{ width: "100%" }}
                                value={row.NgayTraDuKien}
                                onChange={(e) => setBatchRowField(idx, "NgayTraDuKien", e.target.value)}
                              />
                            ) : (
                              <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #888)" }}>-</span>
                            )}
                          </td>

                          {}
                          <td>
                            <input
                              type="text"
                              style={{ width: "100%" }}
                              placeholder="Lý do yêu cầu..."
                              value={row.LyDo}
                              onChange={(e) => setBatchRowField(idx, "LyDo", e.target.value)}
                            />
                          </td>

                          {}
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
                <button className="btn-cancel" onClick={() => setOpenCreateModal(false)} disabled={loading}>Hủy</button>
                <button className="btn-save" onClick={handleBatchCreate} disabled={loading}>
                  {loading ? "Đang gửi..." : `Gửi ${batchRows.length} yêu cầu`}
                </button>
              </div>
            </div>
          </div>
        )}

        {}
        {reviewTarget && (
          <div className="modal-overlay" onClick={closeReview}>
            <div className="device-modal wide-modal" onClick={(event) => event.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon">{reviewAction === "approve" ? "OK" : "NO"}</div>
                  <div>
                    <h2>{reviewAction === "approve" ? "Chấp nhận yêu cầu" : "Từ chối yêu cầu"}</h2>
                    <p>#{reviewTarget.ID_YC} - {REQUEST_TYPE_LABEL[reviewTarget.LoaiYeuCau]}</p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={closeReview}>×</button>
              </div>

              <div className="device-modal-body modal-form">
                {reviewError && <div className="form-error modal-error">{reviewError}</div>}

                <div className="review-summary">
                  <span>Nhân viên</span>
                  <strong>{reviewTarget.HoTen || `NV #${reviewTarget.ID_NV}`}</strong>
                  <span>Thiết bị</span>
                  <strong>{reviewTarget.TenThietBi || `TB #${reviewTarget.ID_TB}`}</strong>
                </div>

                {reviewAction === "approve" && reviewTarget.LoaiYeuCau === "THU_HOI" && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Tình trạng thu hồi</label>
                      <input
                        type="text"
                        value={reviewForm.TinhTrang}
                        onChange={(event) => setReviewField("TinhTrang", event.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Trạng thái thiết bị sau thu hồi</label>
                      <select
                        value={reviewForm.TrangThaiSauThuHoi}
                        onChange={(event) => setReviewField("TrangThaiSauThuHoi", event.target.value)}
                      >
                        <option value="SAN_SANG">Sẵn sàng cấp lại</option>
                        <option value="THANH_LY">Thanh lý</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Ghi chú xử lý</label>
                  <textarea
                    value={reviewForm.GhiChuDuyet}
                    onChange={(event) => setReviewField("GhiChuDuyet", event.target.value)}
                    placeholder={reviewAction === "approve" ? "Ghi chú khi chấp nhận..." : "Lý do từ chối..."}
                    rows={4}
                  />
                </div>
              </div>

              <div className="device-modal-footer">
                <button className="btn-cancel" onClick={closeReview} disabled={loading}>Hủy</button>
                <button
                  className={reviewAction === "approve" ? "btn-save" : "btn-danger-solid"}
                  onClick={handleReview}
                  disabled={loading}
                >
                  {loading ? "Đang xử lý..." : reviewAction === "approve" ? "Chấp nhận" : "Từ chối"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
