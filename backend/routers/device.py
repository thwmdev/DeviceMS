from flask import Blueprint, jsonify, request
from models.devices import (
    get_devices_paginated,
    get_device_by_id,
    create_device,
    update_device,
    soft_delete_device,
)
from security.roles import token_and_role_required

device_bp = Blueprint("device", __name__)


@device_bp.route("/list", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR"])
def get_devices():
    try:
        page  = max(1, int(request.args.get("page",  1)))
        limit = max(1, min(100, int(request.args.get("limit", 10))))
        search = request.args.get("search", "").strip()
        result = get_devices_paginated(page=page, limit=limit, search=search)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@device_bp.route("/detail/<int:matb>", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR"])
def get_device_detail(matb):
    try:
        device = get_device_by_id(matb)
        if not device:
            return jsonify({"message": "Không tìm thấy thiết bị."}), 404
        return jsonify(device), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@device_bp.route("/create", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def add_device():
    try:
        data = request.json or {}
        required = ["TenThietBi", "LoaiThietBi"]
        for field in required:
            if not str(data.get(field, "")).strip():
                return jsonify({"message": f"{field} không được để trống."}), 400

        device_id = create_device(data)
        return jsonify({
            "message": "Thêm thiết bị thành công.",
            "MaThietBi": str(device_id),
        }), 201

    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": "Có lỗi hệ thống xảy ra."}), 500


@device_bp.route("/update/<int:matb>", methods=["PUT"])
@token_and_role_required(allowed_roles=["ADMIN"])
def edit_device(matb):
    try:
        data = request.json or {}
        required = ["MaThietBi", "TenThietBi", "LoaiThietBi", "TrangThai"]
        for field in required:
            if not str(data.get(field, "")).strip():
                return jsonify({"message": f"{field} không được để trống."}), 400

        device = get_device_by_id(matb)
        if not device:
            return jsonify({"message": "Thiết bị không tồn tại."}), 404

        update_device(matb, data)
        return jsonify({"message": "Cập nhật thiết bị thành công."}), 200

    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": "Có lỗi hệ thống xảy ra."}), 500


@device_bp.route("/delete/<int:matb>", methods=["DELETE"])
@token_and_role_required(allowed_roles=["ADMIN"])
def delete_device_route(matb):
    try:
        device = get_device_by_id(matb)
        if not device:
            return jsonify({"message": "Thiết bị không tồn tại."}), 404
        
        if device["TrangThai"] == "THANH_LY":
            return jsonify({"message": "Thiết bị đã được thanh lý."}), 400

        soft_delete_device(matb)
        return jsonify({"message": "Thanh lý thiết bị thành công."}), 200

    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": "Có lỗi hệ thống xảy ra."}), 500
