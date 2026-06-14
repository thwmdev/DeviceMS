from flask import Blueprint, jsonify, request
from models.inventory import (
    get_inventory_stats,
    get_inventory_batches,
    get_inventory_transactions,
    get_disposal_batches,
)
from security.roles import token_and_role_required

inventory_bp = Blueprint("inventory", __name__)

ALLOWED_ROLES = ["ADMIN"]

@inventory_bp.route("/stats", methods=["GET"])
@token_and_role_required(allowed_roles=ALLOWED_ROLES)
def get_stats():
    try:
        stats = get_inventory_stats()
        return jsonify({"stats": stats}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@inventory_bp.route("/batches", methods=["GET"])
@token_and_role_required(allowed_roles=ALLOWED_ROLES)
def get_batches():
    try:
        batches = get_inventory_batches()
        return jsonify({"batches": batches}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@inventory_bp.route("/transactions", methods=["GET"])
@token_and_role_required(allowed_roles=ALLOWED_ROLES)
def get_transactions():
    try:
        limit = max(1, min(500, int(request.args.get("limit", 100))))
        txs = get_inventory_transactions(limit=limit)
        return jsonify({"transactions": txs}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@inventory_bp.route("/disposal-batches", methods=["GET"])
@token_and_role_required(allowed_roles=ALLOWED_ROLES)
def get_disposal_batches_route():
    try:
        batches = get_disposal_batches()
        return jsonify({"batches": batches}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

