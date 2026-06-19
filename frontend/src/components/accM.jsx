import { useState } from "react";
import axios from "axios";


const AccountModal = ({ onClose, refresh, accountData }) => {
  const isEdit = !!accountData; 
  const [formData, setFormData] = useState({ 
      HoTen: accountData?.HoTen || "", 
      PhongBan: accountData?.PhongBan || "IT", 
      ChucVu: accountData?.ChucVu || "NHANVIEN", 
      TenDangNhap: accountData?.TenDangNhap || "", 
      MatKhau: "",
      VaiTro: accountData?.VaiTro || "NHANVIEN" 
    });




  const handleRoleChange = (selectedRole) => {
    let autoDepartment = "Marketing"; 
    let autoPosition = "NHANVIEN";

    if (selectedRole === "ADMIN") {
      autoDepartment = "IT";
      autoPosition = "ADMIN";
    } else if (selectedRole === "HR") {
      autoDepartment = "HR";
      autoPosition = "HR";
    } else if (selectedRole === "NHANVIEN") {
      autoDepartment = "Marketing";
      autoPosition = "NHANVIEN";
    }

    setFormData(prev => ({
      ...prev,
      VaiTro: selectedRole,
      PhongBan: autoDepartment,
      ChucVu: autoPosition
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Kiểm tra dữ liệu
    if (!formData.HoTen || !formData.TenDangNhap) {
      alert("Vui lòng điền đủ thông tin!");
      return;
    }

    try {
      const config = { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } };
      
      if (isEdit) {
        const updateData = {
          HoTen: formData.HoTen,
          VaiTro: formData.VaiTro,
          PhongBan: formData.PhongBan,
          ChucVu: formData.ChucVu
        };
        
        if (!updateData.MatKhau) {
          delete updateData.MatKhau;
        }
        // Cập nhật
        await axios.put(`http://127.0.0.1:5000/api/account/update/${accountData.ID_TK}`, formData, config);
      } else {


        // Thêm 
        await axios.post("http://127.0.0.1:5000/api/account/create", formData, config);
      }
      
      refresh(); 
      onClose(); 
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Lỗi khi xử lý tài khoản");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>{isEdit ? "Cập nhật tài khoản" : "Thêm tài khoản mới"}</h3>
        <label>Họ Tên:</label>
        <input className="form-field" placeholder="Họ và tên" value={formData.HoTen} onChange={(e) => setFormData({...formData, HoTen: e.target.value})} required/>
        
            
        <label>Vai Trò:</label>
        <select 
            className="form-field" 
            value={formData.VaiTro} 
            onChange={(e) => handleRoleChange(e.target.value)} 
            required
        >
            <option value="ADMIN">Admin</option>
            <option value="HR">HR</option>
            <option value="NHANVIEN">Nhân viên</option>
        </select>
        <label>Phòng ban:</label>
        <input 
          className="form-field" 
          value={formData.PhongBan} 
          readOnly 
          style={{ backgroundColor: "#e9ecef", cursor: "not-allowed" }}
        />

        <label>Tên đăng nhập:</label>
        <input className="form-field" placeholder="Tên đăng nhập" value={formData.TenDangNhap} 
          readOnly 
          style={{ backgroundColor: "#e9ecef", cursor: "not-allowed" }}
        />

        {!isEdit && <input className="form-field" type="password" placeholder="Mật khẩu" onChange={(e) => setFormData({...formData, MatKhau: e.target.value})} required />}

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="submit" className="btn-primary">{isEdit ? "Cập nhật" : "Lưu"}</button>
          <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
        </div>
      </form>
    </div>
  );
};

export default AccountModal;