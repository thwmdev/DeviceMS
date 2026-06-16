from flask import Blueprint, jsonify, request
from models.depreM import get_depreciation_detail, get_depreciation_report, save_depreciation, caculate_depre
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
    data = request.get_json()
    print(f"DEBUG: Dữ liệu nhận được từ Frontend: {data}")
    # Kiểm tra xem data có tồn tại và đủ thuộc tính không
    if not data or 'thang' not in data or 'nam' not in data:
        return jsonify({"message": "Thiếu dữ liệu tháng/năm"}), 400
    
    thang = data['thang']
    nam = data['nam']
    
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = """
            INSERT INTO LICHSUKHAUHAO (ID_TB, Thang, Nam, GiaTriKhauHaoThang, GiaTriLuyKe, GiaTriConLai)
            SELECT t.ID_TB, %s, %s, 
                   (t.NguyenGia / k.ThoiGianSuDung / 12), 
                   (t.NguyenGia / k.ThoiGianSuDung / 12), 
                   (t.NguyenGia - (t.NguyenGia / k.ThoiGianSuDung / 12))
            FROM THIETBI t
            JOIN KHAUHAO k ON t.ID_TB = k.ID_TB
            WHERE t.TrangThai = 'SanSang' 
            AND t.ID_TB NOT IN (
                SELECT ID_TB FROM LICHSUKHAUHAO WHERE Thang = %s AND Nam = %s
            )
        """
        # Phải truyền đủ 4 tham số theo đúng thứ tự 4 dấu %s
        cursor.execute(sql, (thang, nam, thang, nam))
        conn.commit()
        return jsonify({"message": "Tính khấu hao thành công"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
        
        
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
            SELECT t.ID_TB as MaTB, t.TenThietBi, t.NguyenGia, 
            COALESCE(l.GiaTriKhauHaoThang, 0) as GiaTriKhauHaoThang, 
            COALESCE(l.GiaTriLuyKe, 0) as GiaTriLuyKe, 
            COALESCE(l.GiaTriConLai, 0) as GiaTriConLai
            FROM THIETBI t
            LEFT JOIN LICHSUKHAUHAO l ON t.ID_TB = l.ID_TB AND l.Thang = %s AND l.Nam = %s  
        """
        cursor.execute(sql, (thang, nam))
        data = cursor.fetchall()
        return jsonify(data), 200
    finally:
        cursor.close()
        conn.close()
        
@depre_bp.route("/chart-data", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN"])
def get_chart_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        sql = """
            SELECT Thang, SUM(GiaTriKhauHaoThang) as TongKhauHaoThang
            FROM LICHSUKHAUHAO
            GROUP BY Thang
            ORDER BY Thang ASC
            LIMIT 12
        """
        cursor.execute(sql)
        data = cursor.fetchall()
        return jsonify(data), 200
    finally:
        cursor.close()
        conn.close()