import { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/sidebar";
import AccountModal from "../components/accM";
import ChangePasswordModal from "../components/ChangePasswordModal";
import Pagination from "../components/Pagination";
import "../styles/acc.css";
import { getRoleLabel } from "../utils/roles";
import { useConfirm } from "../components/confirmContext";
import { toast } from "react-toastify";
import SortableHeader from "../components/SortableHeader";
import { getNextSort, sortRows } from "../utils/tableSort";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:5000/api" : "/api");
const ACCOUNT_API_URL = `${API_BASE_URL}/account`;

const Accounts = () => {
  const confirm = useConfirm();
  const [accounts, setAccounts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [chpwTarget, setChpwTarget] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "TenDangNhap", direction: "asc" });

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${ACCOUNT_API_URL}/list`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setAccounts(res.data);
    } catch (err) {
      toast.error("Lỗi: " + (err.response?.data?.message || "Không thể tải danh sách tài khoản"));
    }
  };

  const handleToggle = async (id) => {
    try {
      await axios.put(`${ACCOUNT_API_URL}/toggle-status/${id}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      await fetchAccounts();
    } catch (err) {
      toast.error("Lỗi: " + (err.response?.data?.message || "Không thể cập nhật trạng thái"));
    }
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const handleResetPassword = async (acc) => {
    const accepted = await confirm({
      tone: "danger",
      eyebrow: "Tài khoản",
      title: "Reset mật khẩu",
      message: `Reset mật khẩu của ${acc.TenDangNhap} về mật khẩu mặc định 123456?`,
      details: "Người dùng nên đổi mật khẩu sau khi đăng nhập lại.",
      confirmText: "Reset mật khẩu",
      cancelText: "Hủy",
    });
    if (!accepted) return;

    try {
      await axios.put(`${ACCOUNT_API_URL}/reset-password/${acc.ID_TK}`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      toast.success("Reset mật khẩu thành công!");
    } catch (err) {
      toast.error("Lỗi: " + (err.response?.data?.message || "Không thể reset mật khẩu"));
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortConfig]);

  let filteredAccounts = accounts || [];

  if (search) {
    const lowerSearch = search.toLowerCase();
    filteredAccounts = filteredAccounts.filter(acc => 
      acc.TenDangNhap?.toLowerCase().includes(lowerSearch) ||
      getRoleLabel(acc.VaiTro)?.toLowerCase().includes(lowerSearch)
    );
  }

  if (statusFilter) {
    filteredAccounts = filteredAccounts.filter(acc => acc.TrangThai === statusFilter);
  }

  const sortedAccounts = sortRows(filteredAccounts, sortConfig);

  const totalPages = Math.ceil(sortedAccounts.length / itemsPerPage) || 1;
  const currentAccounts = sortedAccounts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content">
        <div className="module-header">
          <h2>Quản lý tài khoản</h2>
          <button className="btn-primary" onClick={handleAdd}>
            Thêm tài khoản mới
          </button>
        </div>

        {isModalOpen && (
          <AccountModal
            onClose={() => {
              setIsModalOpen(false);
              setEditingAccount(null);
            }}
            refresh={fetchAccounts}
            accountData={editingAccount}
          />
        )}

        {chpwTarget && (
          <ChangePasswordModal
            targetAccount={chpwTarget}
            onClose={() => setChpwTarget(null)}
          />
        )}

        <div className="search-container">
          <input
            type="text"
            placeholder="Tìm theo username hoặc vai trò..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="HoatDong">Hoạt động</option>
            <option value="Khoa">Khóa</option>
          </select>
          {search && (
            <span className="search-result-hint">
              Kết quả cho &quot;{search}&quot;: {filteredAccounts.length} tài khoản
            </span>
          )}
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>
                <SortableHeader
                  label="Username"
                  sortKey="TenDangNhap"
                  sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))}
                />
              </th>
              <th>
                <SortableHeader
                  label="Vai trò"
                  sortKey="VaiTro"
                  sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))}
                />
              </th>
              <th>
                <SortableHeader
                  label="Trạng thái"
                  sortKey="TrangThai"
                  sortConfig={sortConfig}
                  onSort={(key) => setSortConfig((current) => getNextSort(current, key))}
                />
              </th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(accounts) && currentAccounts.map(acc => (
              <tr key={acc.ID_TK}>
                <td>{acc.TenDangNhap}</td>
                <td>{getRoleLabel(acc.VaiTro)}</td>
                <td>
                  <span className={`status-badge ${acc.TrangThai === 'HoatDong' ? 'active' : 'locked'}`}>
                    {acc.TrangThai}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-edit" onClick={() => handleEdit(acc)}>
                      Cập nhật
                    </button>
                    <button className="btn-action" onClick={() => setChpwTarget(acc)}>
                      Đổi mật khẩu
                    </button>
                    <button className="btn-action" onClick={() => handleResetPassword(acc)}>
                      Reset MK
                    </button>
                    <button className="btn-action" onClick={() => handleToggle(acc.ID_TK)}>
                      {acc.TrangThai === 'HoatDong' ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </main>
    </div>
  );
};

export default Accounts;
