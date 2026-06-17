from flask import Blueprint, jsonify, request
from models.depreM import caculate_depre, save_depreciation, get_depreciation_detail
from security.roles import token_and_role_required
from database.db import get_connection

depre_bp = Blueprint("depreciation", __name__)


# ─── Cấu hình phương pháp khấu hao cho một thiết bị ─────────────────────────
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
    if not data or 'thang' not in data or 'nam' not in data:
        return jsonify({"message": "Thiếu dữ liệu tháng/năm"}), 400
    thang = int(data['thang'])
    nam = int(data['nam'])
    try:
        result = caculate_depre(thang, nam)
        if result.get("status") == "skipped":
            return jsonify({"message": result.get("message")}), 400
        return jsonify({"message": f"Tính khấu hao tháng {thang}/{nam} thành công!", "inserted": result.get("inserted", 0)}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@depre_bp.route("/generate-history", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def generate_history():

    for nam in [2025, 2026]:
        start = 6 if nam == 2025 else 1
        end = 12 if nam == 2025 else 6

        for thang in range(start, end + 1):
            try:
                caculate_depre(thang, nam)
            except Exception as e:
                print(f"Lỗi {thang}/{nam}: {e}")

    return jsonify({"message": "Đã sinh dữ liệu 06/2025 -> 06/2026"}), 200

@depre_bp.route("/detail/<ma_tb>", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR", "USER"])
def get_depreciation_config(ma_tb):
    config = get_depreciation_detail(ma_tb)
    if not config:
        return jsonify({"message": "Chưa có cấu hình khấu hao"}), 404
    return jsonify(config), 200


@depre_bp.route("/report-by-month", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN"])
def get_report_by_month():
    thang = request.args.get("thang", type=int)
    nam = request.args.get("nam", type=int)
    if not thang or not nam:
        return jsonify({"message": "Thiếu tháng/năm"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        sql = """
        SELECT
            t.ID_TB                                              AS MaTB,
            t.TenThietBi,
            t.NguyenGia,
            t.NgayMua,
            t.TrangThai,
            COALESCE(k.ThoiGianSuDung, d.ThoiGianKhauHao, 5)   AS ThoiGianSuDung,

            COALESCE(l.GiaTriKhauHaoThang, 0)                   AS GiaTriKhauHaoThang,

            COALESCE((
                SELECT SUM(GiaTriKhauHaoThang)
                FROM LICHSUKHAUHAO
                WHERE ID_TB = t.ID_TB
                  AND (Nam < %s OR (Nam = %s AND Thang <= %s))
            ), 0)                                                AS GiaTriLuyKe,

            t.NguyenGia - COALESCE((
                SELECT SUM(GiaTriKhauHaoThang)
                FROM LICHSUKHAUHAO
                WHERE ID_TB = t.ID_TB
                  AND (Nam < %s OR (Nam = %s AND Thang <= %s))
            ), 0)                                                AS GiaTriConLai

        FROM THIETBI t
        LEFT JOIN KHAUHAO        k ON t.ID_TB = k.ID_TB
        LEFT JOIN DANHMUCSANPHAM d ON t.ID_DM  = d.ID_DM
        LEFT JOIN LICHSUKHAUHAO  l ON t.ID_TB  = l.ID_TB
                                   AND l.Thang  = %s
                                   AND l.Nam    = %s
        WHERE t.TrangThai NOT IN ('ThanhLy', 'THANH_LY', 'Hong', 'HONG')
        ORDER BY
            CASE t.TrangThai
                WHEN 'SanSang'    THEN 1
                WHEN 'SAN_SANG'   THEN 1
                WHEN 'DangSuDung' THEN 2
                WHEN 'DA_CAP_PHAT'THEN 2
                WHEN 'BaoTri'     THEN 3
                WHEN 'Hong'       THEN 4
                WHEN 'ThanhLy'    THEN 5
                ELSE 99
            END, t.ID_TB
        """
        cursor.execute(sql, (nam, nam, thang, nam, nam, thang, thang, nam))
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
            SELECT Nam, Thang, SUM(GiaTriKhauHaoThang) AS TongKhauHaoThang
            FROM LICHSUKHAUHAO
            GROUP BY Nam, Thang
            ORDER BY Nam ASC, Thang ASC
        """
        cursor.execute(sql)
        data = cursor.fetchall()
        return jsonify(data), 200
    finally:
        cursor.close()
        conn.close()


@depre_bp.route("/devices", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR", "USER"])
def get_depre_devices():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT ID_TB AS MaTB, TenThietBi, NguyenGia, TrangThai
            FROM THIETBI
            ORDER BY ID_TB DESC
        """)
        data = cursor.fetchall()
        return jsonify(data), 200
    finally:
        cursor.close()
        conn.close()


# ─── Lịch sử khấu hao 1 thiết bị theo tháng (tab 2) ─────────────────────────
@depre_bp.route("/history/<int:ma_tb>", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR", "USER"])
def get_depreciation_history(ma_tb):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT Thang, Nam, GiaTriKhauHaoThang, GiaTriLuyKe, GiaTriConLai
            FROM LICHSUKHAUHAO
            WHERE ID_TB = %s
            ORDER BY Nam ASC, Thang ASC
        """, (ma_tb,))
        history = cursor.fetchall()
        return jsonify(history), 200
    except Exception as e:
        return jsonify({"message": f"Lỗi: {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()
        
@depre_bp.route("/generate-config", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def generate_config():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO KHAUHAO (
                ID_TB,
                PhuongPhapTinh,
                ThoiGianSuDung,
                GiaTriThuHoi,
                GiaTriBanDau,
                NgayBatDau,
                NgayKetThuc
            )
            SELECT
                t.ID_TB,
                'straight-line',
                COALESCE(d.ThoiGianKhauHao, 5),
                0,
                t.NguyenGia,
                t.NgayMua,
                DATE_ADD(
                    t.NgayMua,
                    INTERVAL COALESCE(d.ThoiGianKhauHao, 5) YEAR
                )
            FROM THIETBI t
            LEFT JOIN DANHMUCSANPHAM d
                ON t.ID_DM = d.ID_DM
            WHERE NOT EXISTS (
                SELECT 1
                FROM KHAUHAO k
                WHERE k.ID_TB = t.ID_TB
            )
        """)

        conn.commit()

        return jsonify({
            "message": "Sinh cấu hình khấu hao thành công"
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({
            "message": str(e)
        }), 500

    finally:
        cursor.close()
        conn.close()
