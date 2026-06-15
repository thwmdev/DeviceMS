from flask import Blueprint, jsonify, request
from database.db import get_connection
from models.devices import (
    get_devices_paginated,
    get_device_by_id,
    get_device_batches,
    create_device,
    update_device,
    soft_delete_device,
    batch_dispose_devices,
)
from security.roles import token_and_role_required

device_bp = Blueprint("device", __name__)

VIEW_ROLES = ["ADMIN", "HR", "USER"]


@device_bp.route("/list", methods=["GET"])
@token_and_role_required(allowed_roles=VIEW_ROLES)
def get_devices():
    try:
        page  = max(1, int(request.args.get("page",  1)))
        limit = max(1, min(100, int(request.args.get("limit", 10))))
        search = request.args.get("search", "").strip()
        batch_id = request.args.get("batch_id", "").strip()

        dispose_batch_id = request.args.get("dispose_batch_id", "").strip()

        claims = getattr(request, "user_claims", {}) or {}
        user_role = claims.get("role", "").upper()
        employee_id = None
        if user_role == "USER":
            raw_id = claims.get("employee_id") or claims.get("id_nv")
            if raw_id:
                try:
                    employee_id = int(raw_id)
                except (TypeError, ValueError):
                    pass

        result = get_devices_paginated(page=page, limit=limit, search=search, batch_id=batch_id, dispose_batch_id=dispose_batch_id, employee_id=employee_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@device_bp.route("/batches", methods=["GET"])
@token_and_role_required(allowed_roles=VIEW_ROLES)
def list_device_batches():
    try:
        return jsonify({"batches": get_device_batches()}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@device_bp.route("/detail/<int:matb>", methods=["GET"])
@token_and_role_required(allowed_roles=VIEW_ROLES)
def get_device_detail(matb):
    try:
        device = get_device_by_id(matb)
        if not device:
            return jsonify({"message": "Không tìm thấy thiết bị."}), 404
        return jsonify(device), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


def create_device(data):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. Thêm thiết bị
        sql_device = "INSERT INTO THIETBI (TenThietBi, ID_DM, NguyenGia, TrangThai) VALUES (%s, %s, %s, 'Mới')"
        cursor.execute(sql_device, (data['TenThietBi'], data['LoaiThietBi'], data.get('NguyenGia', 0)))
        new_device_id = cursor.lastrowid
        
        # 2. Lấy thông tin từ danh mục sản phẩm (nếu không có thì lấy mặc định)
        cursor.execute("SELECT ThoiGianKhauHao FROM DANHMUCSANPHAM WHERE ID_DM = %s", (data['LoaiThietBi'],))
        row = cursor.fetchone()
        thoi_gian = row['ThoiGianKhauHao'] if row else 5 # Mặc định 5 năm nếu không tìm thấy
        
        # 3. Insert trực tiếp (An toàn hơn dùng JOIN)
        sql_depre = """
            INSERT INTO KHAUHAO (ID_TB, PhuongPhapTinh, ThoiGianSuDung, GiaTriThuHoi, GiaTriBanDau)
            VALUES (%s, 'straight-line', %s, 0, %s)
        """
        cursor.execute(sql_depre, (new_device_id, thoi_gian, data.get('NguyenGia', 0)))
        
        conn.commit()
        return new_device_id
    except Exception as e:
        conn.rollback()
        print(f"Lỗi chi tiết: {e}") # XEM DÒNG NÀY Ở TERMINAL
        raise e
    finally:
        cursor.close()
        conn.close()
        
        
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


@device_bp.route("/dispose-batch", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def dispose_batch():
    try:
        data = request.json or {}
        device_ids = data.get("deviceIds", [])
        batch_id = data.get("batchId", "")
        
        if not device_ids or not isinstance(device_ids, list):
            return jsonify({"message": "Danh sách thiết bị không hợp lệ."}), 400
            
        if not str(batch_id).strip():
            return jsonify({"message": "Mã đợt thanh lý không được để trống."}), 400

        # Validate that all device_ids are integers
        valid_ids = []
        for d in device_ids:
            try:
                valid_ids.append(int(str(d).strip()))
            except (TypeError, ValueError):
                return jsonify({"message": "Mã thiết bị không hợp lệ."}), 400

        count = batch_dispose_devices(valid_ids, str(batch_id).strip())
        return jsonify({"message": f"Đã thanh lý thành công {count} thiết bị."}), 200

    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": "Có lỗi hệ thống xảy ra."}), 500

