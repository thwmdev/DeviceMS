import { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/sidebar";
import AccountModal from "../components/accM";
import Pagination from "../components/Pagination";
import "../styles/acc.css";

const Accounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchAccounts = async () => {
    try {
      const res = await axios.get("https://devicems-hd3z.onrender.com/api/account/list", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setAccounts(res.data);
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || "Không thể tải danh sách tài khoản"));
    }
  };



  const handleToggle = async (id) => {
    try {
      await axios.put(`https://devicems-hd3z.onrender.com/api/account/toggle-status/${id}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      await fetchAccounts();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || "Không thể cập nhật trạng thái"));
    }
  };




  const handleEdit = (account) => {
      const cleanAccount = { ...account, ID_TK: Number(String(account.ID_TK).split(':')[0]) };
      setEditingAccount(cleanAccount);
      setIsModalOpen(true);
  };


  const handleAdd = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const handleResetPassword = async (acc) => {
  
  if (!window.confirm(`Bạn có chắc chắn muốn reset mật khẩu của ${acc.TenDangNhap} về 123456?`)) {
    return;
  }

  try {
    // Gọi API không cần gửi mật khẩu từ body nếu đã gán cứng ở server
    await axios.put(`https://devicems-hd3z.onrender.com/api/account/reset-password/${acc.ID_TK}`, 
      {}, // Gửi rỗng vì mật khẩu đã được xử lý ở server
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );
    alert("Reset mật khẩu thành công!");
  } catch (err) {
    alert("Lỗi: " + (err.response?.data?.message || "Không thể reset mật khẩu"));
  }
};

  useEffect(() => {
    fetchAccounts();
  }, []);

  const totalPages = Math.ceil((accounts || []).length / itemsPerPage) || 1;
  const currentAccounts = (accounts || []).slice(
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

        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(accounts) && currentAccounts.map(acc => (
              <tr key={acc.ID_TK}>
                <td>{acc.TenDangNhap}</td>
                <td>{acc.VaiTro}</td>
                <td>
                  <span className={`status-badge ${acc.TrangThai === 'HoatDong' ? 'active' : 'locked'}`}>
                    {acc.TrangThai}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-edit" onClick={() => handleEdit(acc)}>
                      Cập nhật
                    </button>
                    <button className="btn-action" onClick={() => handleResetPassword(acc)}>
                      Reset Mật khẩu
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
