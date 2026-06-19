import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:5000/api" : "/api");
const API = `${API_BASE_URL}/account`;
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
    <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
    <path d="M3 3l18 18" />
  </svg>
);

const PasswordField = ({ label, name, value, onChange, autoFocus, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="chpw-field">
      {label && <label htmlFor={name}>{label}</label>}
      <div className="chpw-input-wrap">
        <input
          id={name}
          type={visible ? "text" : "password"}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoFocus={autoFocus}
          autoComplete="new-password"
        />
        <button
          type="button"
          className={`chpw-eye${visible ? " chpw-eye--active" : ""}`}
          onClick={() => setVisible(v => !v)}
          tabIndex={-1}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
};

const ChangePasswordModal = ({ onClose, targetAccount = null }) => {
  const isAdminMode = !!targetAccount;
  const [form, setForm] = useState({ MatKhauCu: "", MatKhauMoi: "", XacNhanMatKhau: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const passwordsMatch = !form.XacNhanMatKhau || form.MatKhauMoi === form.XacNhanMatKhau;

  const strength = !form.MatKhauMoi ? null
    : form.MatKhauMoi.length < 6  ? { key: "weak",   label: "Yếu",       width: "33%" }
    : form.MatKhauMoi.length < 10 ? { key: "medium", label: "Trung bình", width: "66%" }
    :                                { key: "strong", label: "Mạnh",       width: "100%" };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.MatKhauMoi || (!isAdminMode && !form.MatKhauCu)) {
      toast.warning("Vui lòng điền đầy đủ thông tin!"); return;
    }
    if (form.MatKhauMoi.length < 6) {
      toast.warning("Mật khẩu mới phải có ít nhất 6 ký tự!"); return;
    }
    if (form.MatKhauMoi !== form.XacNhanMatKhau) {
      toast.warning("Xác nhận mật khẩu không khớp!"); return;
    }
    setLoading(true);
    try {
      if (isAdminMode) {
        await axios.put(`${API}/admin-set-password/${targetAccount.ID_TK}`,
          { MatKhauMoi: form.MatKhauMoi }, { headers: authHeader() });
        toast.success(`Đặt mật khẩu cho "${targetAccount.TenDangNhap}" thành công!`);
      } else {
        await axios.post(`${API}/change-password`,
          { MatKhauCu: form.MatKhauCu, MatKhauMoi: form.MatKhauMoi }, { headers: authHeader() });
        toast.success("Đổi mật khẩu thành công!");
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Đổi mật khẩu thất bại!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content chpw-modal" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>

        <div className="chpw-header">
          <div className="chpw-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z" />
              <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
              <path d="M8 11v-4a4 4 0 1 1 8 0v4" />
            </svg>
          </div>
          <h3>{isAdminMode ? `Đặt mật khẩu — ${targetAccount.TenDangNhap}` : "Đổi mật khẩu"}</h3>
          {!isAdminMode && <p className="chpw-subtitle">Nhập mật khẩu hiện tại để xác nhận danh tính</p>}
        </div>

        <div className="chpw-body">
          {!isAdminMode && (
            <PasswordField
              label="Mật khẩu hiện tại"
              name="MatKhauCu"
              value={form.MatKhauCu}
              onChange={handleChange}
              autoFocus
              placeholder="Nhập mật khẩu hiện tại"
            />
          )}

          <PasswordField
            label="Mật khẩu mới"
            name="MatKhauMoi"
            value={form.MatKhauMoi}
            onChange={handleChange}
            autoFocus={isAdminMode}
            placeholder="Ít nhất 6 ký tự"
          />

          {strength && (
            <div className="chpw-strength">
              <div className="chpw-strength-bar">
                <div className={`chpw-strength-fill strength-${strength.key}`} style={{ width: strength.width }} />
              </div>
              <span className={`chpw-strength-label label-${strength.key}`}>{strength.label}</span>
            </div>
          )}

          <PasswordField
            label="Xác nhận mật khẩu mới"
            name="XacNhanMatKhau"
            value={form.XacNhanMatKhau}
            onChange={handleChange}
            placeholder="Nhập lại mật khẩu mới"
          />

          {!passwordsMatch && (
            <div style={{ padding: "4px 28px 0" }}>
              <span className="chpw-mismatch">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <path d="M12 9v4" />
                  <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
                  <path d="M12 16h.01" />
                </svg>
                Mật khẩu không khớp
              </span>
            </div>
          )}
        </div>

        <div className="chpw-actions">
          <button type="submit" className="chpw-btn-primary" disabled={loading || !passwordsMatch}>
            {loading ? <span className="chpw-spinner" /> : isAdminMode ? "Đặt mật khẩu" : "Đổi mật khẩu"}
          </button>
          <button type="button" className="chpw-btn-cancel" onClick={onClose}>Hủy</button>
        </div>

      </form>
    </div>
  );
};

export default ChangePasswordModal;
