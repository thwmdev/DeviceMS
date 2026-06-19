from flask import Blueprint, jsonify, request
from models.depreM import caculate_depre, save_depreciation, get_depreciation_detail
from security.roles import token_and_role_required
from database.db import get_connection
import datetime

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


@depre_bp.route("/cleanup-and-recalc", methods=["POST"])
@token_and_role_required(allowed_roles=["ADMIN"])
def cleanup_and_recalc():
    """
    1. Xóa toàn bộ LICHSUKHAUHAO
    2. Tính lại khấu hao từ tháng cấp phát đầu tiên → tháng hiện tại
       Chỉ thiết bị đã cấp phát mới được tính.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        
        cursor.execute("DELETE FROM LICHSUKHAUHAO")
        deleted = cursor.rowcount
        conn.commit()

        
        cursor.execute("""
            SELECT MIN(NgayCap) AS EarliestAlloc
            FROM LICHSUCAPPHAT
        """)
        row = cursor.fetchone()
        earliest = row["EarliestAlloc"] if row else None

        if not earliest:
            return jsonify({
                "message": f"Đã xóa {deleted} bản ghi cũ. Không có thiết bị nào được cấp phát, không cần tính lại."
            }), 200

        
        if hasattr(earliest, 'date'):
            earliest = earliest.date()

        now = datetime.datetime.now()
        inserted_total = 0

        
        y, m = earliest.year, earliest.month
        while (y < now.year) or (y == now.year and m <= now.month):
            try:
                result = caculate_depre(m, y)
                inserted_total += result.get("inserted", 0)
            except Exception as e:
                print(f"Lỗi tính lại {m}/{y}: {e}")

            m += 1
            if m > 12:
                m = 1
                y += 1

        return jsonify({
            "message": f"Đã xóa {deleted} bản ghi cũ. Tính lại từ {earliest.month}/{earliest.year} → {now.month}/{now.year}: {inserted_total} bản ghi mới.",
            "deleted": deleted,
            "inserted": inserted_total
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Lỗi: {str(e)}"}), 500

    finally:
        cursor.close()
        conn.close()

@depre_bp.route("/detail/<ma_tb>", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR", "NHANVIEN"])
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

            (SELECT MIN(NgayCap) FROM LICHSUCAPPHAT WHERE ID_TB = t.ID_TB) AS NgayCapDauTien,

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
        now = datetime.datetime.now()
        thang_ht = now.month
        nam_ht = now.year

        sql = """
            SELECT Nam, Thang, SUM(GiaTriKhauHaoThang) AS TongKhauHaoThang
            FROM LICHSUKHAUHAO
            WHERE (Nam < %s) OR (Nam = %s AND Thang <= %s)
            GROUP BY Nam, Thang
            ORDER BY Nam ASC, Thang ASC
        """

        cursor.execute(sql, (nam_ht, nam_ht, thang_ht))
        data = cursor.fetchall()

        return jsonify(data), 200

    finally:
        cursor.close()
        conn.close()



@depre_bp.route("/devices", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR", "NHANVIEN"])
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



@depre_bp.route("/history/<int:ma_tb>", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN", "HR", "NHANVIEN"])
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
                DATE(cp.NgayCapDauTien),
                DATE_ADD(
                    DATE(cp.NgayCapDauTien),
                    INTERVAL COALESCE(d.ThoiGianKhauHao, 5) YEAR
                )
            FROM THIETBI t
            LEFT JOIN DANHMUCSANPHAM d
                ON t.ID_DM = d.ID_DM
            INNER JOIN (
                SELECT ID_TB, MIN(NgayCap) AS NgayCapDauTien
                FROM LICHSUCAPPHAT
                GROUP BY ID_TB
            ) cp ON t.ID_TB = cp.ID_TB
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



@depre_bp.route("/verify", methods=["GET"])
@token_and_role_required(allowed_roles=["ADMIN"])
def verify_depreciation():
    """
    Trả về danh sách thiết bị kèm:
    - Ngày mua (NgayMua) vs Ngày cấp phát đầu tiên (NgayCapDauTien)
    - Cấu hình khấu hao hiện tại (NgayBatDau trong KHAUHAO)
    - Khấu hao kỳ vọng hàng tháng (straight-line)
    - Tổng số tháng đã tính, tổng lũy kế, giá trị còn lại
    - Trạng thái OK / CHƯA_CẤP_PHÁT / CHƯA_CÓ_LỊCH_SỬ
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT
                t.ID_TB                                           AS MaTB,
                t.TenThietBi,
                t.NguyenGia,
                t.NgayMua,
                t.TrangThai,

                (SELECT MIN(NgayCap)
                 FROM LICHSUCAPPHAT
                 WHERE ID_TB = t.ID_TB)                           AS NgayCapDauTien,

                k.NgayBatDau                                      AS KH_NgayBatDau,
                k.NgayKetThuc                                     AS KH_NgayKetThuc,
                COALESCE(k.ThoiGianSuDung, d.ThoiGianKhauHao, 5) AS ThoiGianSuDung,
                COALESCE(k.GiaTriThuHoi, 0)                       AS GiaTriThuHoi,
                COALESCE(k.PhuongPhapTinh, 'straight-line')       AS PhuongPhap,

                (SELECT COUNT(*)
                 FROM LICHSUKHAUHAO
                 WHERE ID_TB = t.ID_TB)                           AS SoThangDaTinh,

                COALESCE((
                    SELECT SUM(GiaTriKhauHaoThang)
                    FROM LICHSUKHAUHAO
                    WHERE ID_TB = t.ID_TB
                ), 0)                                             AS TongLuyKe,

                t.NguyenGia - COALESCE((
                    SELECT SUM(GiaTriKhauHaoThang)
                    FROM LICHSUKHAUHAO
                    WHERE ID_TB = t.ID_TB
                ), 0)                                             AS GiaTriConLai,

                (SELECT MIN(CONCAT(Nam, '-', LPAD(Thang, 2, '0')))
                 FROM LICHSUKHAUHAO
                 WHERE ID_TB = t.ID_TB)                           AS ThangDauTienTinh,

                (SELECT MAX(CONCAT(Nam, '-', LPAD(Thang, 2, '0')))
                 FROM LICHSUKHAUHAO
                 WHERE ID_TB = t.ID_TB)                           AS ThangCuoiTinh

            FROM THIETBI t
            LEFT JOIN KHAUHAO k ON t.ID_TB = k.ID_TB
            LEFT JOIN DANHMUCSANPHAM d ON t.ID_DM = d.ID_DM
            WHERE t.TrangThai NOT IN ('ThanhLy', 'THANH_LY')
            ORDER BY t.ID_TB
        """)
        rows = cursor.fetchall()

        result = []
        for r in rows:
            nguyen_gia = float(r["NguyenGia"] or 0)
            thoi_gian  = int(r["ThoiGianSuDung"] or 5)
            thu_hoi    = float(r["GiaTriThuHoi"] or 0)
            so_thang   = thoi_gian * 12

            kh_thang_ky_vong = round((nguyen_gia - thu_hoi) / so_thang, 2) if so_thang > 0 else 0

            ngay_cap = r["NgayCapDauTien"]
            so_thang_da_tinh = int(r["SoThangDaTinh"] or 0)

            if not ngay_cap:
                trang_thai = "CHUA_CAP_PHAT"
            elif so_thang_da_tinh == 0:
                trang_thai = "CHUA_CO_LICH_SU"
            else:
                trang_thai = "OK"

            result.append({
                "MaTB": r["MaTB"],
                "TenThietBi": r["TenThietBi"],
                "NguyenGia": nguyen_gia,
                "NgayMua": str(r["NgayMua"]) if r["NgayMua"] else None,
                "NgayCapDauTien": str(ngay_cap) if ngay_cap else None,
                "KH_NgayBatDau": str(r["KH_NgayBatDau"]) if r["KH_NgayBatDau"] else None,
                "ThoiGianSuDung_Nam": thoi_gian,
                "PhuongPhap": r["PhuongPhap"],
                "KhauHaoThangKyVong": kh_thang_ky_vong,
                "SoThangDaTinh": so_thang_da_tinh,
                "TongLuyKe": float(r["TongLuyKe"]),
                "GiaTriConLai": float(r["GiaTriConLai"]),
                "ThangDauTienTinh": r["ThangDauTienTinh"],
                "ThangCuoiTinh": r["ThangCuoiTinh"],
                "TrangThaiKiemTra": trang_thai,
                "TrangThaiTB": r["TrangThai"],
            })

        return jsonify(result), 200

    finally:
        cursor.close()
        conn.close()
