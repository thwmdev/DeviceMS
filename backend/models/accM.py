from security.hash import hash_password
from database.db import get_connection



def create_account_db(data):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        raw_password = data.get("MatKhau") or data.get("password")
        hashed_pw = hash_password(str(raw_password)) 
        
        cursor.execute("""
            INSERT INTO TAIKHOAN (TenDangNhap, MatKhau, VaiTro, TrangThai)
            VALUES (%s, %s, %s, 'HOATDONG')
        """, (data["TenDangNhap"].strip(), hashed_pw, data["VaiTro"].upper()))
        
        conn.commit()
    finally:
        cursor.close()
        conn.close()
        
def get_all_accounts():

    pass

def create_account_db(data):
    pass

def update_account_db(matk, data):
  
    pass

def toggle_account_status_db(matk):
    pass