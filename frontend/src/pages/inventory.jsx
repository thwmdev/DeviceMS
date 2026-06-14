import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import Sidebar from "../components/sidebar";
import Pagination from "../components/Pagination";
import SortableHeader from "../components/SortableHeader";
import { getNextSort, sortRows } from "../utils/tableSort";
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
  const [currentPageBatches, setCurrentPageBatches] = useState(1);
  const [currentPageDisposeBatches, setCurrentPageDisposeBatches] = useState(1);
  const [currentPageHistory, setCurrentPageHistory] = useState(1);
  const [currentPageCategories, setCurrentPageCategories] = useState(1);
  const [currentPageModels, setCurrentPageModels] = useState(1);
  const itemsPerPage = 10;

  // Sorting states
  const [sortCategories, setSortCategories] = useState({ key: "category", direction: "asc" });
  const [sortModels, setSortModels] = useState({ key: "modelName", direction: "asc" });
  const [sortBatches, setSortBatches] = useState({ key: "date", direction: "desc" });
  const [sortDisposeBatches, setSortDisposeBatches] = useState({ key: "date", direction: "desc" });
  const [sortHistory, setSortHistory] = useState({ key: "NgayThucHien", direction: "desc" });

  // Search states
  const [searchCategory, setSearchCategory] = useState("");
  const [searchModel, setSearchModel] = useState("");
  const [searchBatch, setSearchBatch] = useState("");
  const [searchDisposeBatch, setSearchDisposeBatch] = useState("");
  const [searchHistory, setSearchHistory] = useState("");
  const [searchDisposeModal, setSearchDisposeModal] = useState("");

  // New states for missing table features
  const [currentPageBatchDetail, setCurrentPageBatchDetail] = useState(1);
  const [sortBatchDetail, setSortBatchDetail] = useState({ key: "MaThietBi", direction: "asc" });
  const [searchBatchDetail, setSearchBatchDetail] = useState("");
  const [modelsCategoryFilter, setModelsCategoryFilter] = useState("");
  const [batchDetailCategoryFilter, setBatchDetailCategoryFilter] = useState("");
  const [batchDetailStatusFilter, setBatchDetailStatusFilter] = useState("");

  // Data
  const [stats, setStats] = useState({ categories: [], models: [] });
  const [batches, setBatches] = useState([]);
  const [disposeBatches, setDisposeBatches] = useState([]);
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [availableDevices, setAvailableDevices] = useState([]);

  // Modals
  const [openImportModal, setOpenImportModal] = useState(false);
  const [importBatchId, setImportBatchId] = useState("");
  const [importRows, setImportRows] = useState([{ ...EMPTY_DEVICE_ROW }]);
  const [importError, setImportError] = useState("");

  const [openDisposeModal, setOpenDisposeModal] = useState(false);
  const [disposeBatchId, setDisposeBatchId] = useState("");
  const [disposeQuantities, setDisposeQuantities] = useState({});
  const [disposeError, setDisposeError] = useState("");

  // Batch Detail Modal
  const [openBatchDetailModal, setOpenBatchDetailModal] = useState(false);
  const [batchDetailType, setBatchDetailType] = useState("import"); // "import" or "dispose"
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

  const loadDisposeBatches = useCallback(async () => {
    try {
      const res = await axios.get(`${INVENTORY_API_URL}/disposal-batches`, { headers: authHeader() });
      setDisposeBatches(res.data.batches || []);
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
    loadDisposeBatches();
    loadHistory();
    loadCategories();
  }, [loadStats, loadBatches, loadDisposeBatches, loadHistory, loadCategories]);

  // Tab switcher refresh
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    if (tabName === "batches") { setCurrentPageBatches(1); loadBatches(); }
    else if (tabName === "dispose_batches") { setCurrentPageDisposeBatches(1); loadDisposeBatches(); }
    else if (tabName === "history") { setCurrentPageHistory(1); loadHistory(); }
    else if (tabName === "overview") { 
      setCurrentPageCategories(1);
      setCurrentPageModels(1);
      loadStats();
    }
  };

  // Sắp xếp & phân trang Tồn kho danh mục
  const filteredCategories = useMemo(() => {
    if (!stats.categories) return [];
    let list = stats.categories.filter((item) => 
      item.category.toLowerCase().includes(searchCategory.toLowerCase())
    );
    return sortRows(list, sortCategories);
  }, [stats.categories, searchCategory, sortCategories]);

  const totalCategoryPages = Math.ceil(filteredCategories.length / itemsPerPage) || 1;
  const currentCategories = filteredCategories.slice((currentPageCategories - 1) * itemsPerPage, currentPageCategories * itemsPerPage);

  // Sắp xếp & phân trang Tồn kho theo dòng máy
  const filteredModels = useMemo(() => {
    if (!stats.models) return [];
    let list = stats.models.filter((item) => 
      item.modelName.toLowerCase().includes(searchModel.toLowerCase()) ||
      item.category.toLowerCase().includes(searchModel.toLowerCase())
    );
    if (modelsCategoryFilter) {
      list = list.filter(item => item.category === modelsCategoryFilter);
    }
    return sortRows(list, sortModels);
  }, [stats.models, searchModel, modelsCategoryFilter, sortModels]);

  const totalModelPages = Math.ceil(filteredModels.length / itemsPerPage) || 1;
  const currentModels = filteredModels.slice((currentPageModels - 1) * itemsPerPage, currentPageModels * itemsPerPage);

  // Lịch sử nhập
  const filteredBatches = useMemo(() => {
    let list = batches.filter((b) => 
      b.batchId.toLowerCase().includes(searchBatch.toLowerCase()) ||
      (b.date && new Date(b.date).toLocaleDateString("vi-VN").includes(searchBatch))
    );
    return sortRows(list, sortBatches);
  }, [batches, searchBatch, sortBatches]);

  const totalBatchPages = Math.ceil(filteredBatches.length / itemsPerPage) || 1;
  const currentBatches = filteredBatches.slice((currentPageBatches - 1) * itemsPerPage, currentPageBatches * itemsPerPage);

  // Lịch sử thanh lý
  const filteredDisposeBatches = useMemo(() => {
    let list = disposeBatches.filter((b) => 
      b.batchId.toLowerCase().includes(searchDisposeBatch.toLowerCase()) ||
      (b.date && new Date(b.date).toLocaleDateString("vi-VN").includes(searchDisposeBatch))
    );
    return sortRows(list, sortDisposeBatches);
  }, [disposeBatches, searchDisposeBatch, sortDisposeBatches]);

  const totalDisposeBatchPages = Math.ceil(filteredDisposeBatches.length / itemsPerPage) || 1;
  const currentDisposeBatches = filteredDisposeBatches.slice((currentPageDisposeBatches - 1) * itemsPerPage, currentPageDisposeBatches * itemsPerPage);

  // Lịch sử hoạt động kho
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    let list = history;
    if (searchHistory) {
      const lowerSearch = searchHistory.toLowerCase();
      list = list.filter(h => 
        (h.action || "").toLowerCase().includes(lowerSearch) ||
        (h.performer || "").toLowerCase().includes(lowerSearch) ||
        (h.details || "").toLowerCase().includes(lowerSearch)
      );
    }
    return sortRows(list, sortHistory);
  }, [history, searchHistory, sortHistory]);
  
  const totalHistoryPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const currentHistory = filteredHistory.slice((currentPageHistory - 1) * itemsPerPage, currentPageHistory * itemsPerPage);

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
    setDisposeBatchId(`TL_${generateBatchId()}`);
    setDisposeQuantities({});
    setDisposeError("");
    setSearchDisposeModal("");
    setOpenDisposeModal(true);
    setLoading(false);
  };

  const groupedDevices = useMemo(() => {
    const map = {};
    availableDevices.forEach(dev => {
      const key = `${dev.TenThietBi}|${dev.LoaiThietBi}`;
      if (!map[key]) {
        map[key] = {
          key,
          TenThietBi: dev.TenThietBi,
          LoaiThietBi: dev.LoaiThietBi,
          GiaTri: dev.GiaTri,
          availableCount: 0,
          devices: []
        };
      }
      map[key].availableCount++;
      map[key].devices.push(dev);
    });
    return Object.values(map);
  }, [availableDevices]);

  // Filtered grouped devices in disposal modal
  const filteredGroupedDevices = useMemo(() => {
    return groupedDevices.filter(g => 
      g.TenThietBi.toLowerCase().includes(searchDisposeModal.toLowerCase()) ||
      g.LoaiThietBi.toLowerCase().includes(searchDisposeModal.toLowerCase())
    );
  }, [groupedDevices, searchDisposeModal]);

  const handleQuantityChange = (key, val, max) => {
    let num = parseInt(val) || 0;
    if (num < 0) num = 0;
    if (num > max) num = max;
    setDisposeQuantities(prev => ({ ...prev, [key]: num }));
  };

  const handleDispose = async () => {
    let targetIds = [];
    for (const [key, qty] of Object.entries(disposeQuantities)) {
      if (qty > 0) {
        const group = groupedDevices.find(g => g.key === key);
        if (group) {
          targetIds.push(...group.devices.slice(0, qty).map(d => d.MaTB));
        }
      }
    }

    if (targetIds.length === 0) {
      setDisposeError("Vui lòng nhập số lượng thanh lý lớn hơn 0 cho ít nhất một loại thiết bị.");
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn thanh lý tổng cộng ${targetIds.length} thiết bị trực tiếp từ kho không?`)) {
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${DEVICE_API_URL}/dispose-batch`, {
        deviceIds: targetIds,
        batchId: disposeBatchId
      }, { headers: authHeader() });
      alert(`Thanh lý thành công ${targetIds.length} thiết bị.`);
      setOpenDisposeModal(false);
      handleTabChange("dispose_batches");
    } catch (err) {
      handleAuthError(err);
      setDisposeError(err?.response?.data?.message || "Thanh lý thiết bị thất bại.");
    } finally {
      setLoading(false);
    }
  };

  // ── Xem chi tiết thiết bị đợt ───────────────────────────────
  const openBatchDetail = async (batchId, type = "import") => {
    setSelectedBatchId(batchId);
    setBatchDetailType(type);
    setOpenBatchDetailModal(true);
    setLoadingBatchDevices(true);
    try {
      const url = type === "dispose"
        ? `${DEVICE_API_URL}/list?dispose_batch_id=${batchId}&limit=100`
        : `${DEVICE_API_URL}/list?batch_id=${batchId}&limit=100`;
      const res = await axios.get(url, { headers: authHeader() });
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
              className={`inventory-tab-btn ${activeTab === "dispose_batches" ? "active" : ""}`}
              onClick={() => handleTabChange("dispose_batches")}
            >
              Lịch sử đợt thanh lý
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h2 style={{ fontSize: "16px", fontWeight: "760", color: "var(--accent)" }}>
                      Tổng quan theo Loại thiết bị
                    </h2>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Tìm kiếm loại thiết bị..."
                      value={searchCategory}
                      onChange={(e) => setSearchCategory(e.target.value)}
                      style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", width: "250px" }}
                    />
                  </div>
                  <table className="device-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>
                          <SortableHeader label="Loại thiết bị" sortKey="category" sortConfig={sortCategories}
                            onSort={(key) => setSortCategories((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Tổng tồn kho" sortKey="total" sortConfig={sortCategories}
                            onSort={(key) => setSortCategories((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Sẵn sàng cấp" sortKey="available" sortConfig={sortCategories}
                            onSort={(key) => setSortCategories((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Đang cấp phát" sortKey="assigned" sortConfig={sortCategories}
                            onSort={(key) => setSortCategories((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Đã thanh lý" sortKey="disposed" sortConfig={sortCategories}
                            onSort={(key) => setSortCategories((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Tổng trị giá phân khu" sortKey="value" sortConfig={sortCategories}
                            onSort={(key) => setSortCategories((curr) => getNextSort(curr, key))} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCategories.length === 0 ? (
                        <tr>
                          <td colSpan="6">Không có dữ liệu</td>
                        </tr>
                      ) : (
                        currentCategories.map((item) => (
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
                  <Pagination 
                    currentPage={currentPageCategories} 
                    totalPages={totalCategoryPages} 
                    onPageChange={setCurrentPageCategories} 
                  />
                </div>

                {/* 2. Model stats table */}
                <div style={{ marginTop: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h2 style={{ fontSize: "16px", fontWeight: "760", color: "var(--accent)" }}>
                      Thống kê chi tiết theo Dòng thiết bị (Model)
                    </h2>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Tìm kiếm dòng máy hoặc loại..."
                      value={searchModel}
                      onChange={(e) => setSearchModel(e.target.value)}
                      style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", width: "250px" }}
                    />
                  </div>
                  <table className="device-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>
                          <SortableHeader label="Tên dòng máy" sortKey="modelName" sortConfig={sortModels}
                            onSort={(key) => setSortModels((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Loại thiết bị" sortKey="category" sortConfig={sortModels}
                            onSort={(key) => setSortModels((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Tổng số lượng" sortKey="total" sortConfig={sortModels}
                            onSort={(key) => setSortModels((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Sẵn sàng cấp" sortKey="available" sortConfig={sortModels}
                            onSort={(key) => setSortModels((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Đang cấp phát" sortKey="assigned" sortConfig={sortModels}
                            onSort={(key) => setSortModels((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Đã thanh lý" sortKey="disposed" sortConfig={sortModels}
                            onSort={(key) => setSortModels((curr) => getNextSort(curr, key))} />
                        </th>
                        <th>
                          <SortableHeader label="Tổng giá trị" sortKey="value" sortConfig={sortModels}
                            onSort={(key) => setSortModels((curr) => getNextSort(curr, key))} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentModels.length === 0 ? (
                        <tr>
                          <td colSpan="7">Không có dữ liệu</td>
                        </tr>
                      ) : (
                        currentModels.map((item, idx) => (
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
                  <Pagination 
                    currentPage={currentPageModels} 
                    totalPages={totalModelPages} 
                    onPageChange={setCurrentPageModels} 
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Batches */}
        {activeTab === "batches" && (
          <div className="table-container">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <input
                type="text"
                className="search-input"
                placeholder="Tìm kiếm mã đợt hoặc ngày nhập..."
                value={searchBatch}
                onChange={(e) => {
                  setSearchBatch(e.target.value);
                  setCurrentPageBatches(1);
                }}
                style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", width: "300px" }}
              />
            </div>
            <table className="device-table">
              <thead>
                <tr>
                  <th>
                    <SortableHeader label="Mã đợt nhập" sortKey="batchId" sortConfig={sortBatches}
                      onSort={(key) => setSortBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th>
                    <SortableHeader label="Ngày nhập" sortKey="date" sortConfig={sortBatches}
                      onSort={(key) => setSortBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th>
                    <SortableHeader label="Tổng thiết bị" sortKey="totalDevices" sortConfig={sortBatches}
                      onSort={(key) => setSortBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th>
                    <SortableHeader label="Sẵn có (ở kho)" sortKey="availableDevices" sortConfig={sortBatches}
                      onSort={(key) => setSortBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th>
                    <SortableHeader label="Đã thanh lý" sortKey="disposedDevices" sortConfig={sortBatches}
                      onSort={(key) => setSortBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th>
                    <SortableHeader label="Tổng nguyên giá trị đợt" sortKey="totalValue" sortConfig={sortBatches}
                      onSort={(key) => setSortBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th style={{ textAlign: "center" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7">Đang tải danh sách đợt nhập...</td>
                  </tr>
                ) : currentBatches.length === 0 ? (
                  <tr>
                    <td colSpan="7">Chưa có đợt nhập kho nào được đăng ký.</td>
                  </tr>
                ) : (
                  currentBatches.map((b) => (
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
                        <button className="btn-edit" onClick={() => openBatchDetail(b.batchId, "import")}>
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pagination 
              currentPage={currentPageBatches} 
              totalPages={totalBatchPages} 
              onPageChange={setCurrentPageBatches} 
            />
          </div>
        )}

        {/* Tab: Dispose Batches */}
        {activeTab === "dispose_batches" && (
          <div className="table-container">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <input
                type="text"
                className="search-input"
                placeholder="Tìm kiếm mã đợt hoặc ngày thanh lý..."
                value={searchDisposeBatch}
                onChange={(e) => {
                  setSearchDisposeBatch(e.target.value);
                  setCurrentPageDisposeBatches(1);
                }}
                style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", width: "300px" }}
              />
            </div>
            <table className="device-table">
              <thead>
                <tr>
                  <th>
                    <SortableHeader label="Mã đợt thanh lý" sortKey="batchId" sortConfig={sortDisposeBatches}
                      onSort={(key) => setSortDisposeBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th>
                    <SortableHeader label="Ngày thanh lý" sortKey="date" sortConfig={sortDisposeBatches}
                      onSort={(key) => setSortDisposeBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th>
                    <SortableHeader label="Tổng thiết bị" sortKey="total" sortConfig={sortDisposeBatches}
                      onSort={(key) => setSortDisposeBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th>
                    <SortableHeader label="Tổng nguyên giá trị đợt" sortKey="value" sortConfig={sortDisposeBatches}
                      onSort={(key) => setSortDisposeBatches((curr) => getNextSort(curr, key))} />
                  </th>
                  <th style={{ textAlign: "center" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4">Đang tải danh sách đợt thanh lý...</td>
                  </tr>
                ) : currentDisposeBatches.length === 0 ? (
                  <tr>
                    <td colSpan="4">Chưa có đợt thanh lý nào.</td>
                  </tr>
                ) : (
                  currentDisposeBatches.map((b) => (
                    <tr key={b.batchId}>
                      <td>
                        <strong>{b.batchId}</strong>
                      </td>
                      <td>{b.date ? new Date(b.date).toLocaleDateString("vi-VN") : "-"}</td>
                      <td>{b.total} thiết bị</td>
                      <td>
                        <strong>{b.value.toLocaleString("vi-VN")} ₫</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button className="btn-edit" onClick={() => openBatchDetail(b.batchId, "dispose")}>
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pagination 
              currentPage={currentPageDisposeBatches} 
              totalPages={totalDisposeBatchPages} 
              onPageChange={setCurrentPageDisposeBatches} 
            />
          </div>
        )}

        {/* Tab 3: Detailed History timeline */}
        {activeTab === "history" && (
          <div className="timeline-list">
            {loading ? (
              <p>Đang tải nhật ký kho...</p>
            ) : currentHistory.length === 0 ? (
              <p>Chưa ghi nhận hoạt động kho nào.</p>
            ) : (
              currentHistory.map((tx, idx) => (
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
            {history.length > 0 && (
              <Pagination 
                currentPage={currentPageHistory} 
                totalPages={totalHistoryPages} 
                onPageChange={setCurrentPageHistory} 
              />
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
                  <datalist id="category-datalist">
                    {categories.filter(item => item.TrangThai === "HoatDong").map((item) => (
                      <option key={item.ID_DM} value={item.TenDanhMuc} />
                    ))}
                  </datalist>
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
                            <input
                              type="text"
                              list="category-datalist"
                              style={{ width: "100%" }}
                              placeholder="Chọn hoặc nhập mới"
                              value={row.LoaiThietBi}
                              onChange={(e) => setImportRowField(idx, "LoaiThietBi", e.target.value)}
                            />
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

        {/* ── Modal Thanh lý (Batch) ──────────────────────────────────────── */}
        {openDisposeModal && (
          <div className="modal-overlay" onClick={() => setOpenDisposeModal(false)}>
            <div className="device-modal batch-modal wide-modal" onClick={(e) => e.stopPropagation()}>
              <div className="device-modal-header">
                <div className="device-modal-title">
                  <div className="device-modal-icon" style={{ background: "var(--danger)" }}>TL</div>
                  <div>
                    <h2>Thanh lý thiết bị trực tiếp</h2>
                    <p style={{ fontSize: "0.78rem" }}>
                      Mã đợt thanh lý: <strong>{disposeBatchId}</strong>
                    </p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setOpenDisposeModal(false)}>×</button>
              </div>

              <div className="device-modal-body">
                {disposeError && <div className="form-error modal-error">{disposeError}</div>}
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "14px" }}>
                    Chọn các thiết bị đang sẵn sàng trong kho bên dưới để thanh lý.
                  </p>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Tìm thiết bị cần thanh lý..."
                    value={searchDisposeModal}
                    onChange={(e) => setSearchDisposeModal(e.target.value)}
                    style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", width: "250px" }}
                  />
                </div>

                <div style={{ overflowX: "auto", maxHeight: "400px" }}>
                  <table className="device-table batch-input-table">
                    <thead>
                      <tr>
                        <th>Tên thiết bị</th>
                        <th>Loại</th>
                        <th>Nguyên giá (₫)</th>
                        <th style={{ textAlign: "center" }}>Sẵn sàng trong kho</th>
                        <th style={{ width: "120px", textAlign: "center" }}>SL Thanh lý</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroupedDevices.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: "center" }}>Không tìm thấy thiết bị nào.</td>
                        </tr>
                      ) : (
                        filteredGroupedDevices.map((group) => (
                          <tr key={group.key}>
                            <td><strong>{group.TenThietBi}</strong></td>
                            <td>{group.LoaiThietBi}</td>
                            <td>{group.GiaTri !== null ? group.GiaTri.toLocaleString("vi-VN") : "-"}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className="status-badge status-SAN_SANG">{group.availableCount}</span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <input 
                                type="number" 
                                min="0" 
                                max={group.availableCount}
                                style={{ width: "80px", textAlign: "center", padding: "4px" }}
                                value={disposeQuantities[group.key] || ""}
                                onChange={(e) => handleQuantityChange(group.key, e.target.value, group.availableCount)}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: "12px", fontSize: "14px" }}>
                  Tổng cộng: <strong>
                    {Object.values(disposeQuantities).reduce((a, b) => a + (parseInt(b) || 0), 0)}
                  </strong> thiết bị sẽ được thanh lý.
                </div>
              </div>

              <div className="device-modal-footer">
                <button className="btn-cancel" onClick={() => setOpenDisposeModal(false)} disabled={loading}>Hủy</button>
                <button 
                  className="btn-save" 
                  onClick={handleDispose} 
                  disabled={loading || Object.values(disposeQuantities).reduce((a, b) => a + (parseInt(b) || 0), 0) === 0} 
                  style={{ background: "var(--danger)" }}
                >
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
                  <div className="device-modal-icon" style={{ background: batchDetailType === "dispose" ? "var(--danger)" : "var(--primary)" }}>
                    CT
                  </div>
                  <div>
                    <h2>Chi tiết đợt {batchDetailType === "dispose" ? "thanh lý" : "nhập kho"}</h2>
                    <p>
                      Mã đợt {batchDetailType === "dispose" ? "thanh lý" : "nhập"}: <strong>{selectedBatchId}</strong>
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
                    <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Tìm theo mã, tên thiết bị, số seri..."
                        value={searchBatchDetail}
                        onChange={(event) => setSearchBatchDetail(event.target.value)}
                        style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", flex: 1 }}
                      />
                      <select
                        className="filter-select"
                        value={batchDetailCategoryFilter}
                        onChange={(e) => setBatchDetailCategoryFilter(e.target.value)}
                        style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      >
                        <option value="">Tất cả danh mục</option>
                        {categories.map((c) => (
                          <option key={c.ID_DM} value={c.TenDanhMuc}>{c.TenDanhMuc}</option>
                        ))}
                      </select>
                      <select
                        className="filter-select"
                        value={batchDetailStatusFilter}
                        onChange={(e) => setBatchDetailStatusFilter(e.target.value)}
                        style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="SAN_SANG">Sẵn sàng</option>
                        <option value="DA_CAP_PHAT">Đã cấp phát</option>
                        <option value="THANH_LY">Thanh lý</option>
                      </select>
                    </div>

                    <table className="device-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>
                            <SortableHeader label="Mã thiết bị" sortKey="MaThietBi" sortConfig={sortBatchDetail} onSort={(key) => setSortBatchDetail((curr) => getNextSort(curr, key))} />
                          </th>
                          <th>
                            <SortableHeader label="Tên thiết bị" sortKey="TenThietBi" sortConfig={sortBatchDetail} onSort={(key) => setSortBatchDetail((curr) => getNextSort(curr, key))} />
                          </th>
                          <th>
                            <SortableHeader label="Số Seri" sortKey="SeriNumber" sortConfig={sortBatchDetail} onSort={(key) => setSortBatchDetail((curr) => getNextSort(curr, key))} />
                          </th>
                          <th>
                            <SortableHeader label="Loại" sortKey="LoaiThietBi" sortConfig={sortBatchDetail} onSort={(key) => setSortBatchDetail((curr) => getNextSort(curr, key))} />
                          </th>
                          <th>
                            <SortableHeader label="Nguyên giá" sortKey="GiaTri" sortConfig={sortBatchDetail} onSort={(key) => setSortBatchDetail((curr) => getNextSort(curr, key))} />
                          </th>
                          <th>
                            <SortableHeader label="Trạng thái" sortKey="TrangThai" sortConfig={sortBatchDetail} onSort={(key) => setSortBatchDetail((curr) => getNextSort(curr, key))} />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentBatchDetail.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: "center", padding: "16px" }}>Không tìm thấy kết quả phù hợp.</td>
                          </tr>
                        ) : (
                          currentBatchDetail.map((dev) => (
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
                          ))
                        )}
                      </tbody>
                    </table>
                    
                    {totalBatchDetailPages > 1 && (
                      <div style={{ marginTop: "16px" }}>
                        <Pagination 
                          currentPage={currentPageBatchDetail} 
                          totalPages={totalBatchDetailPages} 
                          onPageChange={setCurrentPageBatchDetail} 
                        />
                      </div>
                    )}
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