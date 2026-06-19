from flask import Blueprint, jsonify, request
from security.roles import token_and_role_required
from security.hash import verify_password
from models.accM import (
    get_all_accounts,
    create_account_db,
    update_account_db,
    toggle_account_status_db,
    get_account_hashed_password
)

account_bp = Blueprint("account", __name__)


@account_bp.route("/list", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN"])
def get_accounts():
    data = get_all_accounts()
    return jsonify(data)

@account_bp.route("/create", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def create_account():
    try:
        data = request.json
        required_fields = ["TenDangNhap", "MatKhau", "VaiTro", "HoTen"]
        if not all(field in data for field in required_fields):
            return jsonify({"message": "Thiếu thông tin bắt buộc!"}), 400
        try:
            create_account_db(data)
            return jsonify({"message": "Tạo tài khoản thành công!"}), 201
        except ValueError as val_err:
            return jsonify({"message": str(val_err)}), 400
    except Exception as e:
        print(e)
        return jsonify({"message": "Đã tồn tại tài khoản có tên đăng nhập này!"}), 500

@account_bp.route("/update/<int:matk>", methods=["PUT"])
@token_and_role_required(allowed_roles=["ADMIN"])
def update_account(matk):
    try:
        data = request.json
        update_account_db(matk, data)
        return jsonify({"message": "Cập nhật thông tin tài khoản thành công!"}), 200
    except ValueError as val_err:
        return jsonify({"message": str(val_err)}), 400
    except Exception as e:
        return jsonify({"message": "Có lỗi hệ thống xảy ra!"}), 500

@account_bp.route("/toggle-status/<int:matk>", methods=["PUT"])
@token_and_role_required(allowed_roles=["ADMIN"])
def toggle_account_status(matk):
    try:
        toggle_account_status_db(matk)
        return jsonify({"message": "Cập nhật trạng thái tài khoản thành công!"}), 200
    except Exception as e:
        return jsonify({"message": "Có lỗi hệ thống xảy ra!"}), 500

@account_bp.route("/reset-password/<int:matk>", methods=["PUT"])
@token_and_role_required(allowed_roles=["ADMIN"])
def reset_password(matk):
    try:
        update_account_db(matk, {"MatKhau": "123456"})
        return jsonify({"message": "Đã reset về mật khẩu mặc định 123456!"}), 200
    except Exception as e:
        return jsonify({"message": "Lỗi hệ thống!"}), 500


@account_bp.route("/change-password", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN", "HR", "NHANVIEN"])
def change_password():
    try:
        data = request.json
        old_password = data.get("MatKhauCu", "").strip()
        new_password = data.get("MatKhauMoi", "").strip()

        if not old_password or not new_password:
            return jsonify({"message": "Vui lòng nhập đầy đủ mật khẩu cũ và mới!"}), 400

        if len(new_password) < 6:
            return jsonify({"message": "Mật khẩu mới phải có ít nhất 6 ký tự!"}), 400

        username = request.user_claims.get("username")
        if not username:
            return jsonify({"message": "Phiên làm việc không hợp lệ!"}), 401

        from database.db import get_connection
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT ID_TK, MatKhau FROM TAIKHOAN WHERE TenDangNhap = %s", (username,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row or not verify_password(old_password, row["MatKhau"]):
            return jsonify({"message": "Mật khẩu cũ không đúng!"}), 400

        update_account_db(row["ID_TK"], {"MatKhau": new_password})
        return jsonify({"message": "Đổi mật khẩu thành công!"}), 200
    except Exception as e:
        print(e)
        return jsonify({"message": "Lỗi hệ thống!"}), 500


@account_bp.route("/admin-set-password/<int:matk>", methods=["PUT"])
@token_and_role_required(allowed_roles=["ADMIN"])
def admin_set_password(matk):
    try:
        data = request.json
        new_password = data.get("MatKhauMoi", "").strip()
        if not new_password or len(new_password) < 6:
            return jsonify({"message": "Mật khẩu mới phải có ít nhất 6 ký tự!"}), 400
        update_account_db(matk, {"MatKhau": new_password})
        return jsonify({"message": "Đặt mật khẩu thành công!"}), 200
    except Exception as e:
        print(e)
        return jsonify({"message": "Lỗi hệ thống!"}), 500
