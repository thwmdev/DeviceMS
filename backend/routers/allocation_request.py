from flask import Blueprint, jsonify, request
from models.allocation_requests import (
    approve_allocation_request,
    create_allocation_request,
    get_allocation_options,
    get_request_batches,
    get_requests_paginated,
    reject_allocation_request,
)
from security.roles import token_and_role_required


allocation_request_bp = Blueprint("allocation_request", __name__)

# Xem danh sách: tất cả role
VIEW_ROLES = ["ADMIN", "HR", "NHANVIEN"]
# Tạo yêu cầu cấp phát: USER, HR, ADMIN
CREATE_CAP_PHAT_ROLES = ["ADMIN", "HR", "NHANVIEN"]
# Tạo yêu cầu thu hồi: HR, ADMIN, USER (USER chỉ thu hồi thiết bị của chính mình)
CREATE_THU_HOI_ROLES = ["ADMIN", "HR", "NHANVIEN"]
# Duyệt / từ chối: chỉ ADMIN
APPROVE_ROLES = ["ADMIN"]


def _reviewer_name():
    claims = getattr(request, "user_claims", {}) or {}
    return claims.get("username") or "system"


def _current_user_claims():
    return getattr(request, "user_claims", {}) or {}


@allocation_request_bp.route("/list", methods=["GET"])
@token_and_role_required(allowed_roles=VIEW_ROLES)
def list_allocation_requests():
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = max(1, min(100, int(request.args.get("limit", 10))))
        search = request.args.get("search", "").strip()
        request_type = request.args.get("type", "").strip()
        status = request.args.get("status", "").strip()
        batch_id = request.args.get("batch_id", "").strip()
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

        result = get_requests_paginated(
            page=page,
            limit=limit,
            search=search,
            request_type=request_type,
            status=status,
            batch_id=batch_id,
            employee_id=employee_id,
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@allocation_request_bp.route("/batches", methods=["GET"])
@token_and_role_required(allowed_roles=VIEW_ROLES)
def list_request_batches():
    try:
        return jsonify({"batches": get_request_batches()}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@allocation_request_bp.route("/options", methods=["GET"])
@token_and_role_required(allowed_roles=VIEW_ROLES)
def allocation_options():
    try:
        claims = _current_user_claims()
        user_role = claims.get("role", "").upper()
        # Nếu là USER thì chỉ lấy activeAssignments của chính họ
        employee_id = None
        if user_role == "USER":
            raw_id = claims.get("employee_id") or claims.get("id_nv")
            if raw_id:
                try:
                    employee_id = int(raw_id)
                except (TypeError, ValueError):
                    pass
        return jsonify(get_allocation_options(employee_id=employee_id)), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@allocation_request_bp.route("/create", methods=["POST"])
@token_and_role_required(allowed_roles=CREATE_CAP_PHAT_ROLES)
def create_request():
    try:
        data = request.json or {}
        loai_yeu_cau = data.get("LoaiYeuCau", "").upper()
        claims = _current_user_claims()
        user_role = claims.get("role", "").upper()

        # USER chỉ được tạo yêu cầu cấp phát
        if loai_yeu_cau == "THU_HOI" and user_role not in CREATE_THU_HOI_ROLES:
            return jsonify({"message": "Bạn không có quyền tạo yêu cầu thu hồi!"}), 403

        request_id = create_allocation_request(data)
        return jsonify({
            "message": "Tao yeu cau thanh cong.",
            "ID_YC": request_id,
        }), 201
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception:
        return jsonify({"message": "Co loi he thong xay ra."}), 500


@allocation_request_bp.route("/approve/<int:request_id>", methods=["PUT"])
@token_and_role_required(allowed_roles=APPROVE_ROLES)
def approve_request(request_id):
    try:
        approve_allocation_request(request_id, request.json or {}, _reviewer_name())
        return jsonify({"message": "Chap nhan yeu cau thanh cong."}), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception:
        return jsonify({"message": "Co loi he thong xay ra."}), 500


@allocation_request_bp.route("/reject/<int:request_id>", methods=["PUT"])
@token_and_role_required(allowed_roles=APPROVE_ROLES)
def reject_request(request_id):
    try:
        reject_allocation_request(request_id, request.json or {}, _reviewer_name())
        return jsonify({"message": "Tu choi yeu cau thanh cong."}), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception:
        return jsonify({"message": "Co loi he thong xay ra."}), 500
