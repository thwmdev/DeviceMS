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
@token_and_role_required(allowed_roles=["ADMIN", "MANAGER"]) # Bảo mật API
def get_accounts():
    return jsonify(get_all_accounts())

@account_bp.route("/create", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"]) # Chỉ ADMIN mới được tạo tài khoản
def create_account():
    try:
        data = request.json
        create_account_db(data)
        return jsonify({"message": "Tạo tài khoản thành công!"}), 201
    except ValueError as val_err:
        return jsonify({"message": str(val_err)}), 400
    except Exception as e:
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