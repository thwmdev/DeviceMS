from flask import Blueprint, request, jsonify
from database.db import get_connection
from security.hash import verify_password, hash_password # Import cả 2 hàm
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
    print(f"DEBUG: Kết quả tìm kiếm: {user}") # In ra để xem DB có trả về gì không
    cursor.close()
    conn.close()

    if not user:
        return jsonify({"message": "Tài khoản không tồn tại."}), 401

    db_password = user["MatKhau"]
    if isinstance(db_password, (bytes, bytearray)):
        db_password = db_password.decode('utf-8')

    # Xác thực
    if not verify_password(password, db_password):
        return jsonify({"message": "Mật khẩu không chính xác"}), 401

    payload = {"username": user["TenDangNhap"], "role": user["VaiTro"]}
    return jsonify({"token": encode_token(payload), "message": "Đăng nhập thành công"})