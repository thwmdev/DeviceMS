import { useState } from "react";
import axios from "axios";

// Thêm accountData vào props
const AccountModal = ({ onClose, refresh, accountData }) => {
  const isEdit = !!accountData; // Xác định đang ở chế độ Sửa hay Thêm

  const [formData, setFormData] = useState(accountData || { 
    HoTen: "", Email: "", PhongBan: "", ChucVu: "NHANVIEN", 
    TenDangNhap: "", MatKhau: "", VaiTro: "" 
  });

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
        
        <input className="form-field" placeholder="Họ và tên" value={formData.HoTen} onChange={(e) => setFormData({...formData, HoTen: e.target.value})} required={false} />
        <input className="form-field" placeholder="Email" type="email" value={formData.Email} onChange={(e) => setFormData({...formData, Email: e.target.value})} required={false} />
        
        <select className="form-field" value={formData.PhongBan} onChange={(e) => setFormData({...formData, PhongBan: e.target.value})} required={false}>
            <option value="IT">IT</option>
            <option value="HR">HR</option>
            <option value="Marketing">Marketing</option>
        </select>
        
        <select 
            className="form-field" 
            value={formData.VaiTro} 
            onChange={(e) => setFormData({...formData, VaiTro: e.target.value})} 
            required
        >
            <option value="ADMIN">Admin</option>
            <option value="HR">HR</option>
            <option value="NHANVIEN">Nhân viên</option>
        </select>

        <input className="form-field" placeholder="Tên đăng nhập" value={formData.TenDangNhap} onChange={(e) => setFormData({...formData, TenDangNhap: e.target.value})} required readOnly={false} />
        
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