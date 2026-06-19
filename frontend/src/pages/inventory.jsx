import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { toast } from "react-toastify";
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:5000/api" : "/api");
const DEVICE_API_URL = `${API_BASE_URL}/device`;
const CATEGORY_API_URL = `${API_BASE_URL}/product-category`;
const INVENTORY_API_URL = `${API_BASE_URL}/inventory`;

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
  if (typeof value === "number") {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      const yyyy = excelDate.y;
      const mm = String(excelDate.m).padStart(2, "0");
      const dd = String(excelDate.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const strVal = String(value).trim();
  const vnDate = strVal.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (vnDate) {
    const [, day, month, year] = vnDate;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsedDate = new Date(strVal);
  if (!Number.isNaN(parsedDate.getTime())) {
    const yyyy = parsedDate.getFullYear();
    const mm = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(parsedDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return strVal;
};

const normalizeMoney = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Math.round(value);

  let text = String(value).trim().replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replace(/\./g, "").replace(/,/g, ".");
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replace(/,/g, "");
  } else if (text.includes(",") && !text.includes(".")) {
    text = text.replace(/,/g, ".");
  }
  const parsed = Number.parseFloat(text);
  return Number.isNaN(parsed) ? "" : Math.round(parsed);
};

const normalizeExcelHeader = (value) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const EXCEL_HEADERS = {
<<<<<<< HEAD
  TenThietBi: ["tenthietbi"],
  LoaiThietBi: ["loaithietbi"],
  SoLuong: ["soluong"],
  SeriNumber: ["soseri", "serinumber", "serialnumber"],
  NgayMua: ["ngaymua"],
  GiaTri: ["giatri", "nguyengia"],
=======
  TenThietBi: ["Tên thiết bị", "tenthietbi"],
  LoaiThietBi: ["Loại thiết bị", "loaithietbi"],
  SoLuong: ["Số lượng", "soluong"],
  SeriNumber: ["Số Seri", "serinumber"],
  NgayMua: ["Ngày mua", "ngaymua"],
  GiaTri: ["Giá trị", "giatri", "nguyengia"],
>>>>>>> a174f2bec1b8a85ef122769fec29db05e97eb0cd
};

const normalizeExcelRow = (row) => {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeExcelHeader(key);
    if (normalizedKey) {
      normalized[normalizedKey] = value;
    }
  });
  return normalized;
};

const getExcelValue = (row, aliases, fallback = "") => {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== "") {
      return row[alias];
    }
  }
  return fallback;
};

const parseImportQuantity = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export default function Inventory() {
  const navigate = useNavigate();
  const excelInputRef = useRef(null);

  
  const [activeTab, setActiveTab] = useState("overview"); 
  const [loading, setLoading] = useState(false);
  const [currentPageBatches, setCurrentPageBatches] = useState(1);
  const [currentPageDisposeBatches, setCurrentPageDisposeBatches] = useState(1);
  const [currentPageHistory, setCurrentPageHistory] = useState(1);
  const [currentPageCategories, setCurrentPageCategories] = useState(1);
  const [currentPageModels, setCurrentPageModels] = useState(1);
  const itemsPerPage = 10;

  
  const [sortCategories, setSortCategories] = useState({ key: "category", direction: "asc" });
  const [sortModels, setSortModels] = useState({ key: "modelName", direction: "asc" });
  const [sortBatches, setSortBatches] = useState({ key: "date", direction: "desc" });
  const [sortDisposeBatches, setSortDisposeBatches] = useState({ key: "date", direction: "desc" });
  const [sortHistory, setSortHistory] = useState({ key: "NgayThucHien", direction: "desc" });

  
  const [searchCategory, setSearchCategory] = useState("");
  const [searchModel, setSearchModel] = useState("");
  const [searchBatch, setSearchBatch] = useState("");
  const [searchDisposeBatch, setSearchDisposeBatch] = useState("");
  const [searchHistory, setSearchHistory] = useState("");
  const [searchDisposeModal, setSearchDisposeModal] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("");

  
  const [currentPageBatchDetail, setCurrentPageBatchDetail] = useState(1);
  const [sortBatchDetail, setSortBatchDetail] = useState({ key: "MaThietBi", direction: "asc" });
  const [searchBatchDetail, setSearchBatchDetail] = useState("");
  const [modelsCategoryFilter, setModelsCategoryFilter] = useState("");
  const [batchDetailCategoryFilter, setBatchDetailCategoryFilter] = useState("");
  const [batchDetailStatusFilter, setBatchDetailStatusFilter] = useState("");

  
  const [stats, setStats] = useState({ categories: [], models: [] });
  const [batches, setBatches] = useState([]);
  const [disposeBatches, setDisposeBatches] = useState([]);
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [availableDevices, setAvailableDevices] = useState([]);

  
  const [openImportModal, setOpenImportModal] = useState(false);
  const [importBatchId, setImportBatchId] = useState("");
  const [importRows, setImportRows] = useState([{ ...EMPTY_DEVICE_ROW }]);
  const [importError, setImportError] = useState("");

  const [openDisposeModal, setOpenDisposeModal] = useState(false);
  const [disposeBatchId, setDisposeBatchId] = useState("");
  const [selectedDisposeIds, setSelectedDisposeIds] = useState(new Set());
  const [disposeError, setDisposeError] = useState("");

  
  const [openBatchDetailModal, setOpenBatchDetailModal] = useState(false);
  const [batchDetailType, setBatchDetailType] = useState("import"); 
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [batchDevices, setBatchDevices] = useState([]);
  const [loadingBatchDevices, setLoadingBatchDevices] = useState(false);

  
  const authHeader = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  const handleAuthError = useCallback((err) => {
    if (err?.response?.status === 401) {
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  
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
      
      const list = (res.data.data || []).filter((d) => d.TrangThai === "SAN_SANG");
      setAvailableDevices(list);
    } catch (err) {
      handleAuthError(err);
    }
  }, [authHeader, handleAuthError]);

  
  useEffect(() => {
    loadStats();
    loadBatches();
    loadDisposeBatches();
    loadHistory();
    loadCategories();
  }, [loadStats, loadBatches, loadDisposeBatches, loadHistory, loadCategories]);

  
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

  
  const filteredCategories = useMemo(() => {
    if (!stats.categories) return [];
    let list = stats.categories.filter((item) => 
      item.category.toLowerCase().includes(searchCategory.toLowerCase())
    );
    return sortRows(list, sortCategories);
  }, [stats.categories, searchCategory, sortCategories]);

  const totalCategoryPages = Math.ceil(filteredCategories.length / itemsPerPage) || 1;
  const currentCategories = filteredCategories.slice((currentPageCategories - 1) * itemsPerPage, currentPageCategories * itemsPerPage);

  
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

  
  const filteredBatches = useMemo(() => {
    let list = batches.filter((b) => 
      b.batchId.toLowerCase().includes(searchBatch.toLowerCase()) ||
      (b.date && new Date(b.date).toLocaleDateString("vi-VN").includes(searchBatch))
    );
    return sortRows(list, sortBatches);
  }, [batches, searchBatch, sortBatches]);

  const totalBatchPages = Math.ceil(filteredBatches.length / itemsPerPage) || 1;
  const currentBatches = filteredBatches.slice((currentPageBatches - 1) * itemsPerPage, currentPageBatches * itemsPerPage);

  
  const filteredDisposeBatches = useMemo(() => {
    let list = disposeBatches.filter((b) => 
      b.batchId.toLowerCase().includes(searchDisposeBatch.toLowerCase()) ||
      (b.date && new Date(b.date).toLocaleDateString("vi-VN").includes(searchDisposeBatch))
    );
    return sortRows(list, sortDisposeBatches);
  }, [disposeBatches, searchDisposeBatch, sortDisposeBatches]);

  const totalDisposeBatchPages = Math.ceil(filteredDisposeBatches.length / itemsPerPage) || 1;
  const currentDisposeBatches = filteredDisposeBatches.slice((currentPageDisposeBatches - 1) * itemsPerPage, currentPageDisposeBatches * itemsPerPage);

  
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    let list = history;
    if (historyTypeFilter) {
      list = list.filter(h => h.type === historyTypeFilter);
    }
    if (searchHistory) {
      const lowerSearch = searchHistory.toLowerCase();
      list = list.filter(h => 
        (h.description || "").toLowerCase().includes(lowerSearch) ||
        (h.name || "").toLowerCase().includes(lowerSearch) ||
        (String(h.deviceId || "")).toLowerCase().includes(lowerSearch) ||
        (h.seri || "").toLowerCase().includes(lowerSearch) ||
        (String(h.batchId || "")).toLowerCase().includes(lowerSearch)
      );
    }
    return sortRows(list, sortHistory);
  }, [history, searchHistory, historyTypeFilter, sortHistory]);
  
  const totalHistoryPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const currentHistory = filteredHistory.slice((currentPageHistory - 1) * itemsPerPage, currentPageHistory * itemsPerPage);

  const filteredBatchDetail = useMemo(() => {
    let list = batchDevices;
    if (searchBatchDetail) {
      const lowerSearch = searchBatchDetail.toLowerCase();
      list = list.filter(d => 
        (d.TenThietBi || "").toLowerCase().includes(lowerSearch) ||
        (d.MaThietBi || "").toLowerCase().includes(lowerSearch) ||
        (d.SeriNumber || "").toLowerCase().includes(lowerSearch)
      );
    }
    if (batchDetailCategoryFilter) {
      list = list.filter(d => d.TenDanhMuc === batchDetailCategoryFilter || d.LoaiThietBi === batchDetailCategoryFilter);
    }
    if (batchDetailStatusFilter) {
      list = list.filter(d => d.TrangThai === batchDetailStatusFilter);
    }
    return sortRows(list, sortBatchDetail);
  }, [batchDevices, searchBatchDetail, batchDetailCategoryFilter, batchDetailStatusFilter, sortBatchDetail]);

  const totalBatchDetailPages = Math.ceil(filteredBatchDetail.length / itemsPerPage) || 1;
  const currentBatchDetail = filteredBatchDetail.slice((currentPageBatchDetail - 1) * itemsPerPage, currentPageBatchDetail * itemsPerPage);

  
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
      toast.success(`Đã nhập kho thành công ${successCount}/${totalToImport} thiết bị (Mã đợt: ${importBatchId}).`);
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
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const rows = rawRows.map((rawRow) => {
        const row = normalizeExcelRow(rawRow);
        return {
          ...row,
          TenThietBi: getExcelValue(row, EXCEL_HEADERS.TenThietBi),
          LoaiThietBi: getExcelValue(row, EXCEL_HEADERS.LoaiThietBi),
          SoLuong: getExcelValue(row, EXCEL_HEADERS.SoLuong, 1),
          SeriNumber: getExcelValue(row, EXCEL_HEADERS.SeriNumber),
          NgayMua: getExcelValue(row, EXCEL_HEADERS.NgayMua),
          GiaTri: getExcelValue(row, EXCEL_HEADERS.GiaTri, 0),
        };
      });

      if (rows.length === 0) {
        toast.warning("File Excel không có dữ liệu.");
        setLoading(false);
        event.target.value = "";
        return;
      }

      const importableRows = rows.filter((row) => row.TenThietBi && row.LoaiThietBi);
      if (importableRows.length === 0) {
        toast.warning("File Excel khong co dong hop le. Can co cot TenThietBi va LoaiThietBi.");
        return;
      }

      const excelBatchId = generateBatchId();
      let successCount = 0;
      let totalToImport = 0;

      for (const row of importableRows) {
        const tenTB = row.TenThietBi || row["Tên thiết bị"] || row["Tên Thiết Bị"] || row["Tên thiêt bị"] || "";
        const loaiTB = row.LoaiThietBi || row["Loại thiết bị"] || row["Loại Thiết Bị"] || "";

        if (!tenTB || !loaiTB) continue;

        const rawQty = row.SoLuong ?? row["Số lượng"] ?? row.soluong ?? 1;
        const qty = parseImportQuantity(rawQty);
        totalToImport += qty;

        for (let i = 0; i < qty; i++) {
          const rawSeri = row.SeriNumber || row["Seri Number"] || row["Số seri"] || row["Seri"] || "";
          let seri = String(rawSeri).trim();
          if (qty > 1 && seri) {
            seri = `${seri}-${i + 1}`;
          }
          const rawNgayMua = row.NgayMua || row["Ngày mua"] || row["Ngày Mua"];
          const rawGiaTri = row.GiaTri || row["Giá trị"] || row["Giá Trị"] || row["Giá"] || 0;

          try {
            await axios.post(
              `${DEVICE_API_URL}/create`,
              {
                TenThietBi: String(tenTB).trim(),
                LoaiThietBi: String(loaiTB).trim(),
                SeriNumber: seri || null,
                NgayMua: formatDateInput(rawNgayMua),
                GiaTri: normalizeMoney(rawGiaTri),
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
      toast.success(`Import thành công ${successCount}/${totalToImport} thiết bị từ file Excel (Mã đợt: ${excelBatchId}).`);
      setOpenImportModal(false);
      handleTabChange("batches");
    } catch (err) {
      console.error(err);
      toast.error("Đọc và import file Excel thất bại.");
    } finally {
      event.target.value = "";
      setLoading(false);
    }
  };

  
  const openDispose = async () => {
    setLoading(true);
    await loadAvailableDevices();
    setDisposeBatchId(`TL_${generateBatchId()}`);
    setSelectedDisposeIds(new Set());
    setDisposeError("");
    setSearchDisposeModal("");
    setOpenDisposeModal(true);
    setLoading(false);
  };

  
  const filteredDisposeDevices = useMemo(() => {
    const q = searchDisposeModal.toLowerCase();
    if (!q) return availableDevices;
    return availableDevices.filter(dev =>
      (dev.TenThietBi || "").toLowerCase().includes(q) ||
      (dev.LoaiThietBi || "").toLowerCase().includes(q) ||
      (dev.SeriNumber || "").toLowerCase().includes(q) ||
      (String(dev.MaTB || "")).toLowerCase().includes(q)
    );
  }, [availableDevices, searchDisposeModal]);

  const toggleDisposeSelect = (id) => {
    setSelectedDisposeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllDispose = () => {
    if (selectedDisposeIds.size === filteredDisposeDevices.length) {
      setSelectedDisposeIds(new Set());
    } else {
      setSelectedDisposeIds(new Set(filteredDisposeDevices.map(d => d.MaTB)));
    }
  };

  const handleDispose = async () => {
    const targetIds = [...selectedDisposeIds];
    if (targetIds.length === 0) {
      setDisposeError("Vui lòng chọn ít nhất một thiết bị để thanh lý.");
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${DEVICE_API_URL}/dispose-batch`, {
        deviceIds: targetIds,
        batchId: disposeBatchId
      }, { headers: authHeader() });
      toast.success(`Thanh lý thành công ${targetIds.length} thiết bị.`);
      setOpenDisposeModal(false);
      handleTabChange("dispose_batches");
    } catch (err) {
      handleAuthError(err);
      const msg = err?.response?.data?.message || "Thanh lý thiết bị thất bại.";
      setDisposeError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  
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
      toast.error("Không tải được chi tiết đợt nhập.");
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

          {}
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

        {}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {loading ? (
              <p>Đang tải dữ liệu báo cáo...</p>
            ) : (
              <>
                {}
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

                {}
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

        {}
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

        {}
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

        {}
        {activeTab === "history" && (
          <div className="timeline-list">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", background: "var(--card-bg, #ffffff)", padding: "12px 16px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "760", color: "var(--accent)", margin: 0 }}>
                Nhật ký hoạt động
              </h2>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <select
                  className="search-input"
                  value={historyTypeFilter}
                  onChange={(e) => {
                    setHistoryTypeFilter(e.target.value);
                    setCurrentPageHistory(1);
                  }}
                  style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", width: "180px", outline: "none", cursor: "pointer", background: "var(--bg, #fcfcfc)", color: "var(--ink)" }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="IMPORT">Nhập kho</option>
                  <option value="ALLOCATE">Xuất kho</option>
                  <option value="RETURN">Thu hồi</option>
                  <option value="DISPOSE">Thanh lý</option>
                </select>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Tìm kiếm nhật ký..."
                  value={searchHistory}
                  onChange={(e) => {
                    setSearchHistory(e.target.value);
                    setCurrentPageHistory(1);
                  }}
                  style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", width: "300px", outline: "none", background: "var(--bg, #fcfcfc)", color: "var(--ink)" }}
                />
              </div>
            </div>
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

        {}
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

        {}
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
                    Chọn từng thiết bị sẵn sàng trong kho để đưa vào đợt thanh lý.
                  </p>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Tìm theo tên, loại, seri..."
                    value={searchDisposeModal}
                    onChange={(e) => setSearchDisposeModal(e.target.value)}
                    style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", width: "260px" }}
                  />
                </div>

                <div style={{ overflowX: "auto", maxHeight: "420px" }}>
                  <table className="device-table batch-input-table">
                    <thead>
                      <tr>
                        <th style={{ width: "36px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            title="Chọn tất cả"
                            checked={filteredDisposeDevices.length > 0 && selectedDisposeIds.size === filteredDisposeDevices.length}
                            onChange={toggleSelectAllDispose}
                          />
                        </th>
                        <th>Mã TB</th>
                        <th>Tên thiết bị</th>
                        <th>Loại</th>
                        <th>Số Seri</th>
                        <th>Nguyên giá (₫)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDisposeDevices.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-soft)" }}>Không tìm thấy thiết bị nào.</td>
                        </tr>
                      ) : (
                        filteredDisposeDevices.map((dev) => (
                          <tr
                            key={dev.MaTB}
                            onClick={() => toggleDisposeSelect(dev.MaTB)}
                            style={{ cursor: "pointer", background: selectedDisposeIds.has(dev.MaTB) ? "var(--accent-soft, #fce4e4)" : undefined }}
                          >
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={selectedDisposeIds.has(dev.MaTB)}
                                onChange={() => toggleDisposeSelect(dev.MaTB)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td><code>#{dev.MaTB}</code></td>
                            <td><strong>{dev.TenThietBi}</strong></td>
                            <td>{dev.LoaiThietBi}</td>
                            <td>{dev.SeriNumber || <span style={{ color: "var(--ink-soft)" }}>—</span>}</td>
                            <td>{dev.GiaTri != null ? Number(dev.GiaTri).toLocaleString("vi-VN") : "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: "12px", fontSize: "14px", color: "var(--ink-soft)" }}>
                  Đã chọn: <strong style={{ color: selectedDisposeIds.size > 0 ? "var(--danger)" : undefined }}>{selectedDisposeIds.size}</strong> / {availableDevices.length} thiết bị để thanh lý.
                </div>
              </div>

              <div className="device-modal-footer">
                <button className="btn-cancel" onClick={() => setOpenDisposeModal(false)} disabled={loading}>Hủy</button>
                <button
                  className="btn-save"
                  onClick={handleDispose}
                  disabled={loading || selectedDisposeIds.size === 0}
                  style={{ background: "var(--danger)" }}
                >
                  {loading ? "Đang xử lý..." : `Xác nhận thanh lý (${selectedDisposeIds.size})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {}
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
