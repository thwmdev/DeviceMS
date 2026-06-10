from database.db import get_connection
from security.hash import hash_password
import sys
import os


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def run_seed():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT TenDangNhap, MatKhau FROM TAIKHOAN")
    users = cursor.fetchall()

    for user in users:
        username = user["TenDangNhap"]
        password_raw = str(user["MatKhau"]).strip()
        
        if not password_raw.startswith('$2b$'):
            print(f"băm cho: {username}...")
            
            hashed = hash_password(password_raw)
            
            cursor.execute(
                "UPDATE TAIKHOAN SET MatKhau = %s WHERE TenDangNhap = %s",
                (hashed, username)
            )
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Hoàn tất!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")

if __name__ == "__main__":
    run_seed()