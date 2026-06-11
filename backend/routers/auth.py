from flask import Blueprint, request, jsonify
from database.db import get_connection
from security.hash import verify_password, hash_password 
from security.jwthandler import encode_token

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM TAIKHOAN WHERE TenDangNhap=%s", (username,))
    user = cursor.fetchone()
    cursor.close()
    
    if not user:
        conn.close()
        return jsonify({"message": "Tài khoản không tồn tại."}), 401

    db_password = user["MatKhau"]

    if not (db_password.startswith('$2b$') or db_password.startswith('$2a$')):
        print(f"Phát hiện mật khẩu thô cho user {username}, đang tự động băm...")
        


        new_hashed = hash_password(db_password)
        

        update_cursor = conn.cursor()
        update_cursor.execute(
            "UPDATE TAIKHOAN SET MatKhau = %s WHERE TenDangNhap = %s",
            (new_hashed, username)
        )
        conn.commit()
        update_cursor.close()
        


        db_password = new_hashed
    

    
    if not verify_password(password, db_password):
        conn.close()
        return jsonify({"message": "Mật khẩu không chính xác"}), 401

    conn.close()
    payload = {"username": user["TenDangNhap"], "role": user.get("VaiTro")}
    return jsonify({"token": encode_token(payload), "message": "Đăng nhập thành công"})