import { useState, useEffect } from "react";
import axios from "axios";
import { getCanonicalStoredRole } from "../utils/roles";
import { toast } from "react-toastify";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:5000/api" : "/api");
const ACCOUNT_API_URL = `${API_BASE_URL}/account`;

const AccountModal = ({ onClose, refresh, accountData }) => {
  const isEdit = !!accountData;
  const initialRole = getCanonicalStoredRole(
    accountData?.VaiTro || "NHANVIEN"
  );

  const [formData, setFormData] = useState({
    HoTen: accountData?.HoTen || "",
    PhongBan: accountData?.PhongBan || "IT",
    ChucVu: accountData?.ChucVu || "NHANVIEN",
    TenDangNhap: accountData?.TenDangNhap || "",
    Email: accountData?.Email || "",
    MatKhau: "",
    VaiTro: initialRole,
  });

  useEffect(() => {
    if (accountData) {
      setFormData({
        HoTen: accountData.HoTen || "",
        PhongBan: accountData.PhongBan || "",
        ChucVu: accountData.ChucVu || "",
        TenDangNhap: accountData.TenDangNhap || "",
        Email: accountData.Email || "",
        MatKhau: "",
        VaiTro: getCanonicalStoredRole(
          accountData.VaiTro || "NHANVIEN"
        ),
      });
    }
  }, [accountData]);

  const handleRoleChange = (role) => {
    let phongBan = "";
    let chucVu = "";

    if (role === "ADMIN") {
      phongBan = "IT";
      chucVu = "ADMIN";
    } else if (role === "HR") {
      phongBan = "HR";
      chucVu = "HR";
    } else {
      phongBan = "Marketing";
      chucVu = "NHANVIEN";
    }

    setFormData((prev) => ({
      ...prev,
      VaiTro: role,
      PhongBan: phongBan,
      ChucVu: chucVu,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.HoTen || !formData.TenDangNhap) {
      toast.warning("Vui lòng điền đủ thông tin!");
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      };

      if (isEdit) {
        const updateData = {
          HoTen: formData.HoTen,
          VaiTro: formData.VaiTro,
          PhongBan: formData.PhongBan,
          ChucVu: formData.ChucVu,
        };

        await axios.put(
          `${ACCOUNT_API_URL}/update/${accountData.ID_TK}`,
          updateData,
          config
        );

        toast.success("Cập nhật thành công!");
      } else {
        await axios.post(
          `${ACCOUNT_API_URL}/create`,
          formData,
          config
        );

        toast.success("Tạo tài khoản thành công!");
      }

      refresh();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Lỗi khi xử lý tài khoản"
      );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{isEdit ? "Cập nhật tài khoản" : "Thêm tài khoản"}</h3>

        <input
          value={formData.HoTen}
          onChange={(e) =>
            setFormData({ ...formData, HoTen: e.target.value })
          }
          placeholder="Họ tên"
        />

        <input
          value={formData.TenDangNhap}
          placeholder="Username"
          onChange={(e) => {
            const username = e.target.value
              .toLowerCase()
              .replace(/\s+/g, "");

            setFormData((prev) => ({
              ...prev,
              TenDangNhap: username,
              Email: username ? `${username}@company.com` : "",
            }));
          }}
          disabled={isEdit}
        />

        <input value={formData.Email} disabled />

        <select
          value={formData.VaiTro}
          onChange={(e) => handleRoleChange(e.target.value)}
        >
          <option value="ADMIN">ADMIN</option>
          <option value="HR">HR</option>
          <option value="NHANVIEN">NHANVIEN</option>
        </select>

        <input value={formData.PhongBan} disabled />

        {!isEdit && (
          <input
            type="password"
            placeholder="Mật khẩu"
            onChange={(e) =>
              setFormData({
                ...formData,
                MatKhau: e.target.value,
              })
            }
          />
        )}

        <button type="submit">
          {isEdit ? "Cập nhật" : "Tạo mới"}
        </button>

        <button type="button" onClick={onClose}>
          Hủy
        </button>
      </form>
    </div>
  );
};

export default AccountModal;
