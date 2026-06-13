from security.hash import hash_password
from database.db import get_connection

def get_all_accounts():
    """Lấy danh sách tất cả tài khoản."""
    conn = get_connection()
    if not conn: return []
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT ID_TK, TenDangNhap, VaiTro, TrangThai FROM TAIKHOAN")
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()



def create_account_db(data):
    # Sử dụng .get() để an toàn hơn
    ho_ten = data.get("HoTen")
    email = data.get("Email")
    ten_dn = data.get("TenDangNhap")
    mat_khau = data.get("MatKhau")
    
    if not all([ho_ten, email, ten_dn, mat_khau]):
        raise Exception("Vui lòng điền đầy đủ các thông tin bắt buộc (Họ tên, Email, Tên đăng nhập, Mật khẩu)")

    conn = get_connection()
    cursor = conn.cursor()
    try:
        #vào NHANVIEN
        cursor.execute("INSERT INTO NHANVIEN (HoTen, Email, PhongBan, ChucVu) VALUES (%s, %s, %s, %s)", 
                       (ho_ten, email, data.get("PhongBan"), data.get("ChucVu")))
        
        new_id_nv = cursor.lastrowid
        
        
        
        #vào TAIKHOAN
        hashed_pw = hash_password(str(mat_khau))
        cursor.execute("INSERT INTO TAIKHOAN (ID_NV, TenDangNhap, MatKhau, VaiTro) VALUES (%s, %s, %s, %s)", 
                       (new_id_nv, ten_dn, hashed_pw, data.get("VaiTro", "NHANVIEN").upper()))
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
        
        
        
        

def toggle_account_status_db(matk):
    """Vô hiệu hóa hoặc kích hoạt tài khoản."""
    conn = get_connection()
    # PHẢI THÊM dictionary=True ĐỂ LẤY KẾT QUẢ DẠNG DICTIONARY
    cursor = conn.cursor(dictionary=True) 
    try:
        cursor.execute("SELECT TrangThai FROM TAIKHOAN WHERE ID_TK = %s", (matk,))
        result = cursor.fetchone()
        
        if not result:
            raise Exception("Tài khoản không tồn tại")
        
        # Bây giờ result['TrangThai'] sẽ hoạt động đúng
        new_status = 'TamDung' if result['TrangThai'] == 'HoatDong' else 'HoatDong'
        
        cursor.execute("UPDATE TAIKHOAN SET TrangThai = %s WHERE ID_TK = %s", (new_status, matk))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

def update_account_db(matk, data):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        updates = []
        params = []

        if data.get("VaiTro"):
            updates.append("VaiTro = %s")
            params.append(data["VaiTro"].upper())
        
        if data.get("MatKhau"):
            hashed_pw = hash_password(str(data["MatKhau"]))
            updates.append("MatKhau = %s")
            params.append(hashed_pw)
            
        
        if updates:
            params.append(matk)
            sql = f"UPDATE TAIKHOAN SET {', '.join(updates)} WHERE ID_TK = %s"
            cursor.execute(sql, tuple(params))
            conn.commit()
            
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()