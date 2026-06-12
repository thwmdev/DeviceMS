from flask import Blueprint, jsonify, request
from mysql.connector import IntegrityError
from security.roles import token_and_role_required
from models.product_categories import (
    create_category,
    delete_category,
    get_categories_paginated,
    get_category_by_id,
    toggle_category_status,
    update_category,
)

product_category_bp = Blueprint("product_category", __name__)


@product_category_bp.route("/list", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR"])
def list_categories():
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = max(1, min(100, int(request.args.get("limit", 10))))
        search = request.args.get("search", "").strip()
        return jsonify(get_categories_paginated(page=page, limit=limit, search=search)), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@product_category_bp.route("/detail/<int:category_id>", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR"])
def category_detail(category_id):
    try:
        category = get_category_by_id(category_id)
        if not category:
            return jsonify({"message": "Khong tim thay danh muc."}), 404
        return jsonify(category), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@product_category_bp.route("/create", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def add_category():
    try:
        category_id = create_category(request.json or {})
        return jsonify({"message": "Them danh muc thanh cong.", "ID_DM": category_id}), 201
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except IntegrityError:
        return jsonify({"message": "Ma danh muc da ton tai."}), 400
    except Exception:
        return jsonify({"message": "Co loi he thong xay ra."}), 500


@product_category_bp.route("/update/<int:category_id>", methods=["PUT"])
@token_and_role_required(allowed_roles=["ADMIN"])
def edit_category(category_id):
    try:
        update_category(category_id, request.json or {})
        return jsonify({"message": "Cap nhat danh muc thanh cong."}), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except IntegrityError:
        return jsonify({"message": "Ma danh muc da ton tai."}), 400
    except Exception:
        return jsonify({"message": "Co loi he thong xay ra."}), 500


@product_category_bp.route("/toggle-status/<int:category_id>", methods=["PUT"])
@token_and_role_required(allowed_roles=["ADMIN"])
def toggle_status(category_id):
    try:
        next_status = toggle_category_status(category_id)
        return jsonify({"message": "Cap nhat trang thai danh muc thanh cong.", "TrangThai": next_status}), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception:
        return jsonify({"message": "Co loi he thong xay ra."}), 500


@product_category_bp.route("/delete/<int:category_id>", methods=["DELETE"])
@token_and_role_required(allowed_roles=["ADMIN"])
def remove_category(category_id):
    try:
        delete_category(category_id)
        return jsonify({"message": "Xoa danh muc thanh cong."}), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception:
        return jsonify({"message": "Co loi he thong xay ra."}), 500
