import os
import urllib.request
from flask import Blueprint, request, jsonify
from database.db import get_connection
from security.hash import verify_password, hash_password
from security.jwthandler import encode_token
from security.roles import normalize_role
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

auth_bp = Blueprint("auth", __name__)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM TAIKHOAN WHERE TenDangNhap=%s",
        (username,)
    )
    user = cursor.fetchone()
    cursor.close()

    if not user:
        conn.close()
        return jsonify({
            "message": "Tài khoản không tồn tại."
        }), 401

    db_password = user["MatKhau"]

    if not (
        db_password.startswith("$2b$")
        or db_password.startswith("$2a$")
    ):
        print(
            f"Phát hiện mật khẩu thô cho user {username}, đang tự động băm..."
        )

        new_hashed = hash_password(db_password)

        update_cursor = conn.cursor()
        update_cursor.execute(
            "UPDATE TAIKHOAN SET MatKhau=%s WHERE TenDangNhap=%s",
            (new_hashed, username)
        )
        conn.commit()
        update_cursor.close()

        db_password = new_hashed

    if not verify_password(password, db_password):
        conn.close()
        return jsonify({
            "message": "Mật khẩu không chính xác"
        }), 401

    conn.close()

    mapped_role = normalize_role(user.get("VaiTro", ""))

    payload = {
        "username": user["TenDangNhap"],
        "role": mapped_role,
        "id_nv": user.get("ID_NV"),
    }

    return jsonify({
        "token": encode_token(payload),
        "username": user["TenDangNhap"],
        "role": mapped_role,
        "id_nv": user.get("ID_NV"),
        "message": "Đăng nhập thành công"
    })


@auth_bp.route("/google-login", methods=["POST"])
def google_login():
    """
    Đăng nhập bằng Google.
    Frontend gửi Google ID token → backend verify → tìm email trong NHANVIEN
    → tạo JWT nội bộ → trả về thông tin đăng nhập.
    """
    data = request.json or {}
    credential = data.get("credential")  # Google ID token từ frontend

    if not credential:
        return jsonify({"message": "Thiếu Google credential token."}), 400

    if not GOOGLE_CLIENT_ID:
        return jsonify({"message": "Server chưa cấu hình Google Client ID."}), 500

    # Verify Google ID token bằng urllib (tránh SSL/proxy issues của requests lib)
    try:
        _transport = google_requests.Request(session=None)
        id_info = google_id_token.verify_oauth2_token(
            credential,
            _transport,
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=30,
        )
    except ValueError as exc:
        err_msg = str(exc)
        print(f"[GoogleLogin] Token verify failed: {err_msg}")
        # Trả về lỗi chi tiết hơn để debug
        if "Wrong number of segments" in err_msg or "Token is not a JWT" in err_msg:
            detail = "Token Google không đúng định dạng."
        elif "Token expired" in err_msg or "iat" in err_msg or "exp" in err_msg:
            detail = "Token Google đã hết hạn. Vui lòng thử đăng nhập lại."
        elif "audience" in err_msg.lower() or "aud" in err_msg:
            detail = f"Google Client ID không khớp. Kiểm tra GOOGLE_CLIENT_ID trong .env"
        elif "certificate" in err_msg.lower() or "key" in err_msg.lower():
            detail = "Không thể xác thực với Google (lỗi kết nối mạng hoặc certificate)."
        else:
            detail = f"Lỗi xác thực Google: {err_msg}"
        return jsonify({"message": detail}), 401
    except Exception as exc:
        err_msg = str(exc)
        print(f"[GoogleLogin] Unexpected error: {err_msg}")
        return jsonify({"message": f"Lỗi hệ thống khi xác thực Google: {err_msg}"}), 500

    google_email = id_info.get("email", "").lower().strip()
    google_name = id_info.get("name", "")

    if not google_email:
        return jsonify({"message": "Không lấy được email từ tài khoản Google."}), 401

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # Tìm nhân viên theo email Google
        cursor.execute(
            "SELECT ID_NV, HoTen, Email FROM NHANVIEN WHERE LOWER(TRIM(Email)) = %s LIMIT 1",
            (google_email,),
        )
        employee = cursor.fetchone()

        if not employee:
            return jsonify({
                "message": (
                    f"Email {google_email} chưa được đăng ký trong hệ thống. "
                    "Vui lòng liên hệ quản trị viên."
                )
            }), 403

        id_nv = employee["ID_NV"]

        # Tìm tài khoản tương ứng để lấy vai trò
        cursor.execute(
            "SELECT TenDangNhap, VaiTro, TrangThai FROM TAIKHOAN WHERE ID_NV = %s LIMIT 1",
            (id_nv,),
        )
        account = cursor.fetchone()

        if not account:
            return jsonify({
                "message": "Nhân viên chưa có tài khoản trong hệ thống. Vui lòng liên hệ quản trị viên."
            }), 403

        if account.get("TrangThai") == "TamDung":
            return jsonify({
                "message": "Tài khoản đang bị tạm ngưng. Vui lòng liên hệ quản trị viên."
            }), 403

        ten_dang_nhap = account["TenDangNhap"]
        mapped_role = normalize_role(account.get("VaiTro", ""))

        payload = {
            "username": ten_dang_nhap,
            "role": mapped_role,
            "id_nv": id_nv,
        }

        return jsonify({
            "token": encode_token(payload),
            "username": ten_dang_nhap,
            "role": mapped_role,
            "id_nv": id_nv,
            "display_name": google_name or employee.get("HoTen", ten_dang_nhap),
            "message": "Đăng nhập bằng Google thành công",
        })

    except Exception as exc:
        print(f"[GoogleLogin] Lỗi hệ thống: {exc}")
        return jsonify({"message": "Có lỗi hệ thống xảy ra."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
