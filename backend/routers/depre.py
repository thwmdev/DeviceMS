from flask import Blueprint, jsonify, request
from models.depre import get_depreciation_detail, get_depreciation_report, save_depreciation, caculate_depre
from security.roles import token_and_role_required
from database.db import get_connection


depre_bp = Blueprint("depreciation", __name__)

@depre_bp.route("", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def set_depreciation():
    try:
        data = request.json
        required = ["MaTB", "method", "usefulLife", "residualValue"]
        if not all(k in data for k in required):
            return jsonify({"message": "Thiếu thông tin cấu hình"}), 400
            
        save_depreciation(data)
        return jsonify({"message": "Lưu cấu hình khấu hao thành công"}), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": "Lỗi hệ thống: " + str(e)}), 500
    
@depre_bp.route("/run-monthly", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def run_monthly_depreciation():
    try:
        result = caculate_depre()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"message": f"Lỗi hệ thống: {str(e)}"}), 500
    
    
@depre_bp.route("/detail/<ma_tb>", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR", "USER"])
def get_depreciation_config(ma_tb):
    config = get_depreciation_detail(ma_tb)
    if not config:
        return jsonify({"message": "Chưa có cấu hình khấu hao"}), 404
    return jsonify(config), 200

@depre_bp.route("/report", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN"])
def get_report():
    data = get_depreciation_report() 
    return jsonify(data), 200




@depre_bp.route("/history/<int:ma_tb>", methods=["GET", "OPTIONS"]) 
@token_and_role_required(allowed_roles=["ADMIN", "USER"])
def get_depreciation_history(ma_tb):

    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT Thang, Nam, GiaTriConLai, GiaTriKhauHaoThang FROM LICHSUKHAUHAO WHERE ID_TB = %s ORDER BY Nam DESC, Thang DESC"
        cursor.execute(query, (ma_tb,))
        history = cursor.fetchall()
        
        cursor.close()
        conn.close()
        return jsonify(history), 200
    except Exception as e:
        return jsonify({"message": f"Lỗi truy vấn lịch sử: {str(e)}"}), 500
    
@depre_bp.route("/report-by-month", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN"])
def get_report_by_month():
    thang = request.args.get("thang")
    nam = request.args.get("nam")
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        sql = """
            SELECT t.ID_TB as MaTB, t.TenThietBi, l.GiaTriKhauHaoThang, l.GiaTriLuyKe, l.GiaTriConLai
            FROM LICHSUKHAUHAO l
            JOIN THIETBI t ON l.ID_TB = t.ID_TB
            WHERE l.Thang = %s AND l.Nam = %s
        """
        cursor.execute(sql, (thang, nam))
        data = cursor.fetchall()
        return jsonify(data), 200
    except Exception as e:
        print(f"Lỗi truy vấn SQL: {e}")
        return jsonify({"message": "Lỗi dữ liệu: " + str(e)}), 500
    finally:
        cursor.close()
        conn.close()