from flask import Blueprint, jsonify, request
from security.roles import token_and_role_required
from models.accM import (
    get_all_accounts,
    create_account_db,
    update_account_db,
    toggle_account_status_db    
)

account_bp = Blueprint("account", __name__)



@account_bp.route("/list", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN"]) 
def get_accounts():
    return jsonify(get_all_accounts())

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
        return jsonify({"message": "Có lỗi hệ thống xảy ra!"}), 500

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
        default_password = "123456"
        update_account_db(matk, {"MatKhau": default_password})
        return jsonify({"message": "Đã reset về mật khẩu mặc định 123456!"}), 200
    except Exception as e:
        return jsonify({"message": "Lỗi hệ thống!"}), 500

