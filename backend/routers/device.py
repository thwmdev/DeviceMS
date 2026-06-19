from flask import Blueprint, jsonify, request
import traceback
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



VIEW_ROLES = ["ADMIN", "HR", "NHANVIEN"]


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
        if user_role == "NHANVIEN":
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


@device_bp.route("/create", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def add_device():
    """Tạo thiết bị mới và tự động tạo cấu hình khấu hao từ danh mục."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        data = request.json or {}
        if not data.get("TenThietBi") or not data.get("LoaiThietBi"):
            return jsonify({"message": "Tên và loại thiết bị không được để trống."}), 400

        ten_danh_muc = str(data["LoaiThietBi"]).strip()

        # 1. Tra cứu danh mục theo tên để lấy ID_DM và ThoiGianKhauHao
        cursor.execute(
            "SELECT ID_DM, ThoiGianKhauHao FROM DANHMUCSANPHAM WHERE TenDanhMuc = %s AND TrangThai = 'HoatDong'",
            (ten_danh_muc,)
        )
        dm_row = cursor.fetchone()
        id_dm = dm_row["ID_DM"] if dm_row else None
        # Ưu tiên: ThoiGianKhauHao từ danh mục → mặc định 5
        thoi_gian = int(dm_row["ThoiGianKhauHao"]) if (dm_row and dm_row["ThoiGianKhauHao"]) else 5

        # 2. Tạo thiết bị — lưu cả Loai (tên) và ID_DM (khoá ngoại)
        nguyen_gia = data.get("GiaTri") or data.get("NguyenGia") or 0
        ma_dot     = str(data.get("MaDot") or "").strip() or None
        seri       = str(data.get("SeriNumber") or "").strip() or None

        from models.devices import normalize_status_for_db
        trang_thai = normalize_status_for_db(data.get("TrangThai", "SanSang"))

        # Lấy ID tự tăng tiếp theo
        cursor.execute("SELECT COALESCE(MAX(ID_TB), 0) + 1 FROM THIETBI")
        device_id = cursor.fetchone()["COALESCE(MAX(ID_TB), 0) + 1"]

        cursor.execute(
            """
            INSERT INTO THIETBI (ID_TB, TenThietBi, Loai, ID_DM, SeriNumber, NgayMua, NguyenGia, TrangThai, MaDot)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                device_id,
                data["TenThietBi"],
                ten_danh_muc,
                id_dm,
                seri,
                data.get("NgayMua") or None,
                nguyen_gia,
                trang_thai,
                ma_dot,
            ),
        )

        # 3. Tạo bản ghi KHAUHAO mặc định từ danh mục
        cursor.execute(
            """
            INSERT INTO KHAUHAO (ID_TB, PhuongPhapTinh, ThoiGianSuDung, GiaTriThuHoi, GiaTriBanDau)
            VALUES (%s, 'straight-line', %s, 0, %s)
            ON DUPLICATE KEY UPDATE
                ThoiGianSuDung = VALUES(ThoiGianSuDung),
                GiaTriBanDau   = VALUES(GiaTriBanDau)
            """,
            (device_id, thoi_gian, nguyen_gia),
        )

        conn.commit()
        return jsonify({"message": "Thêm thiết bị thành công.", "ID_TB": device_id}), 201
    except Exception as e:
        conn.rollback()
        print(f"Lỗi tạo thiết bị: {e}")
        return jsonify({"message": f"Lỗi hệ thống: {str(e)}"}), 500
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
        print(f"Loi cap nhat thiet bi {matb}: {e}")
        traceback.print_exc()
        return jsonify({"message": f"Co loi he thong xay ra: {str(e)}"}), 500


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




@device_bp.route("/update-life/<int:matb>", methods=["PUT"])
@token_and_role_required(allowed_roles=["ADMIN"])
def update_device_life(matb):
    try:
        data = request.json
        new_life = data.get("ThoiGianSuDung")
        
        import logging

        logging.basicConfig(level=logging.INFO)

        logging.info(f"Đang cập nhật thiết bị {matb} với kh {new_life}")
                    
  

        if new_life is None or int(new_life) <= 0:
            return jsonify({"message": "Thời gian sử dụng phải là số dương."}), 400

        new_life = int(new_life)
        # reset_history=true → xóa LICHSUKHAUHAO để tính lại từ đầu
        reset_history = data.get("reset_history", False)

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT ThoiGianSuDung FROM KHAUHAO WHERE ID_TB = %s", (matb,))
        result = cursor.fetchone()

        if not result:
            cursor.execute("""
                INSERT INTO KHAUHAO (ID_TB, PhuongPhapTinh, ThoiGianSuDung, GiaTriThuHoi, GiaTriBanDau)
                VALUES (%s, 'straight-line', %s, 0, (SELECT NguyenGia FROM THIETBI WHERE ID_TB = %s))
            """, (matb, new_life, matb))
        else:
            cursor.execute("UPDATE KHAUHAO SET ThoiGianSuDung = %s WHERE ID_TB = %s", (new_life, matb))

        msg = f"Cập nhật thời gian khấu hao thành {new_life} năm thành công."

        if reset_history:
            cursor.execute("DELETE FROM LICHSUKHAUHAO WHERE ID_TB = %s", (matb,))
            msg += " Đã xóa lịch sử — khấu hao sẽ được tính lại từ đầu khi chạy tháng tiếp theo."
        else:
            msg += " Thay đổi áp dụng từ tháng chưa tính tiếp theo (lịch sử cũ giữ nguyên)."

        conn.commit()
        return jsonify({"message": msg}), 200

    except Exception as e:
        print(f"DEBUG ERROR: {e}")
        return jsonify({"message": f"Lỗi hệ thống: {str(e)}"}), 500
    finally:
        if 'cursor' in dir() and cursor:
            cursor.close()
        if 'conn' in dir() and conn:
            conn.close()
