from security.hash import hash_password
from database.db import get_connection
from security.roles import VALID_ROLES, normalize_role, normalize_role_value


def _clean_account_role(role):
    normalized = normalize_role_value(role)
    if normalized not in VALID_ROLES:
        raise ValueError("VaiTro chi duoc la ADMIN, HR hoac NHANVIEN")

    return normalized

def get_all_accounts():
    """Lấy danh sách tất cả tài khoản."""
    conn = get_connection()
    if not conn: return []
    cursor = conn.cursor(dictionary=True)
    try:
        sql = """
                SELECT 
                    TK.ID_TK, TK.TenDangNhap, TK.VaiTro, TK.TrangThai,
                    NV.HoTen, NV.PhongBan, NV.ChucVu, NV.Email
                FROM TAIKHOAN TK
                INNER JOIN NHANVIEN NV ON TK.ID_NV = NV.ID_NV
                """
        cursor.execute(sql)
        accounts = cursor.fetchall()
        for account in accounts:
            account["VaiTro"] = normalize_role(account.get("VaiTro"))

        return accounts
    finally:
        cursor.close()
        conn.close()



def create_account_db(data):

    ho_ten = data.get("HoTen")
    ten_dn = data.get("TenDangNhap")
    mat_khau = data.get("MatKhau")
    
    if not all([ho_ten, ten_dn, mat_khau]):
        raise Exception("Vui lòng điền đầy đủ các thông tin bắt buộc (Họ tên, Email, Tên đăng nhập, Mật khẩu)")

    email = f"{ten_dn}@company.com"
    conn = get_connection()
    cursor = conn.cursor()
    try:
        
        cursor.execute("INSERT INTO NHANVIEN (HoTen, Email, PhongBan, ChucVu) VALUES (%s, %s, %s, %s)", 
                       (ho_ten, email, data.get("PhongBan"), data.get("ChucVu")))
        
        new_id_nv = cursor.lastrowid
        
        
        
        
        hashed_pw = hash_password(str(mat_khau))
        role = _clean_account_role(data.get("VaiTro", "NHANVIEN"))
        cursor.execute("INSERT INTO TAIKHOAN (ID_NV, TenDangNhap, MatKhau, VaiTro) VALUES (%s, %s, %s, %s)", 
                       (new_id_nv, ten_dn, hashed_pw, role))
        
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

    cursor = conn.cursor(dictionary=True) 
    try:
        cursor.execute("SELECT TrangThai FROM TAIKHOAN WHERE ID_TK = %s", (matk,))
        result = cursor.fetchone()
        
        if not result:
            raise Exception("Tài khoản không tồn tại")
        
        
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
            params.append(_clean_account_role(data["VaiTro"]))
        
        if data.get("MatKhau"):
            hashed_pw = hash_password(str(data["MatKhau"]))
            updates.append("MatKhau = %s")
            params.append(hashed_pw)
            
        
        if updates:
            params.append(matk)
            sql = f"UPDATE TAIKHOAN SET {', '.join(updates)} WHERE ID_TK = %s"
            cursor.execute(sql, tuple(params))
            
            cursor.execute("SELECT ID_NV FROM TAIKHOAN WHERE ID_TK = %s", (matk,))
        
        res = cursor.fetchone()
        
        if res:
            id_nv = res["ID_NV"] if isinstance(res, dict) else res[0]
            
            updates_nv = []
            params_nv = []
            
            if data.get("HoTen"):
                updates_nv.append("HoTen = %s")
                params_nv.append(data["HoTen"])
                
            if data.get("PhongBan"):
                updates_nv.append("PhongBan = %s")
                params_nv.append(data["PhongBan"])
                
            if data.get("ChucVu"):
                updates_nv.append("ChucVu = %s")
                params_nv.append(data["ChucVu"])
                
            if updates_nv:
                params_nv.append(id_nv)
                sql_nv = f"UPDATE NHANVIEN SET {', '.join(updates_nv)} WHERE ID_NV = %s"
                cursor.execute(sql_nv, tuple(params_nv))
                
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
