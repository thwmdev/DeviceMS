from database.db import get_connection
import datetime
import calendar
from datetime import date
from dateutil.relativedelta import relativedelta



def save_depreciation(data):

    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT NguyenGia
            FROM THIETBI
            WHERE ID_TB = %s
        """, (data["MaTB"],))

        device = cursor.fetchone()

        if not device:
            raise ValueError("Không tìm thấy thiết bị.")

        nguyen_gia = float(device["NguyenGia"])

        # Lấy ngày cấp phát đầu tiên thay vì ngày mua
        cursor.execute("""
            SELECT MIN(NgayCap) AS NgayCapDauTien
            FROM LICHSUCAPPHAT
            WHERE ID_TB = %s
        """, (data["MaTB"],))
        cap_phat = cursor.fetchone()
        ngay_cap_dau = cap_phat["NgayCapDauTien"] if cap_phat else None

        if not ngay_cap_dau:
            raise ValueError("Thiết bị chưa được cấp phát, không thể tính khấu hao.")

        if float(data["residualValue"]) >= nguyen_gia:
            raise ValueError("Giá trị thu hồi phải nhỏ hơn nguyên giá.")

        ngay_bat_dau = ngay_cap_dau.date() if hasattr(ngay_cap_dau, 'date') else ngay_cap_dau

        # FIX chuẩn ERP (không cộng tay year nữa)
        ngay_ket_thuc = ngay_bat_dau + relativedelta(years=int(data["usefulLife"]))

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
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE
                PhuongPhapTinh = VALUES(PhuongPhapTinh),
                ThoiGianSuDung = VALUES(ThoiGianSuDung),
                GiaTriThuHoi   = VALUES(GiaTriThuHoi),
                GiaTriBanDau   = VALUES(GiaTriBanDau),
                NgayBatDau     = VALUES(NgayBatDau),
                NgayKetThuc    = VALUES(NgayKetThuc)
        """, (
            data["MaTB"],
            data["method"],
            data["usefulLife"],
            data["residualValue"],
            nguyen_gia,
            ngay_bat_dau,
            ngay_ket_thuc
        ))

        conn.commit()

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()



def caculate_depre(thang=None, nam=None):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        now = datetime.datetime.now()

        if thang is None:
            thang = now.month
        if nam is None:
            nam = now.year

        start_month = date(nam, thang, 1)
        end_month = date(nam, thang, calendar.monthrange(nam, thang)[1])

        cursor.execute("""
            SELECT
                t.ID_TB,
                t.NguyenGia,
                COALESCE(k.PhuongPhapTinh, 'straight-line') AS PhuongPhapTinh,
                COALESCE(k.ThoiGianSuDung, 5) AS SoNam,
                COALESCE(k.GiaTriThuHoi, 0) AS GiaTriThuHoi,
                k.NgayBatDau,
                k.NgayKetThuc,
                (SELECT MIN(NgayCap) FROM LICHSUCAPPHAT WHERE ID_TB = t.ID_TB) AS NgayCapDauTien
            FROM THIETBI t
            LEFT JOIN KHAUHAO k ON t.ID_TB = k.ID_TB
            WHERE t.TrangThai IN ('DangSuDung', 'DA_CAP_PHAT', 'DaCapPhat', 'DANG_SU_DUNG')
        """)

        danh_sach = cursor.fetchall()
        inserted = 0

        for item in danh_sach:

            id_tb = item["ID_TB"]
            nguyen_gia = float(item["NguyenGia"] or 0)
            so_nam = float(item["SoNam"] or 5)
            gia_tri_thu_hoi = float(item["GiaTriThuHoi"] or 0)
            phuong_phap = item["PhuongPhapTinh"]

            ngay_ket_thuc = item["NgayKetThuc"]

            # Chưa cấp phát → không tính khấu hao
            ngay_cap_dau = item.get("NgayCapDauTien")
            if not ngay_cap_dau:
                continue

            if hasattr(ngay_cap_dau, 'date'):
                ngay_cap_dau = ngay_cap_dau.date()

            ngay_bat_dau = ngay_cap_dau

            # =========================
            # 1. VALID TIME RANGE
            # =========================

            if ngay_bat_dau > end_month:
                continue

            if ngay_ket_thuc and ngay_ket_thuc < start_month:
                continue

            # 👉 không cho chạy trước ngày cấp phát đầu tiên
            if (nam < ngay_bat_dau.year) or (nam == ngay_bat_dau.year and thang < ngay_bat_dau.month):
                continue

            # =========================
            # 2. AVOID DUPLICATE MONTH
            # =========================

            cursor.execute("""
                SELECT 1 FROM LICHSUKHAUHAO
                WHERE ID_TB=%s AND Nam=%s AND Thang=%s
            """, (id_tb, nam, thang))

            if cursor.fetchone():
                continue

            # =========================
            # 3. LŨY KẾ
            # =========================

            cursor.execute("""
                SELECT COALESCE(SUM(GiaTriKhauHaoThang), 0) AS LuyKe
                FROM LICHSUKHAUHAO
                WHERE ID_TB = %s
                  AND (Nam < %s OR (Nam = %s AND Thang < %s))
            """, (id_tb, nam, nam, thang))

            luy_ke = float(cursor.fetchone()["LuyKe"])
            gia_tri_con_lai = nguyen_gia - luy_ke

            if gia_tri_con_lai <= gia_tri_thu_hoi:
                continue

            so_thang = so_nam * 12

            # =========================
            # 4. DEPRECIATION METHOD
            # =========================

            if phuong_phap == "declining-balance":

                rate_year = 2 / so_nam
                rate_month = 1 - (1 - rate_year) ** (1 / 12)

                khau_hao_thang = gia_tri_con_lai * rate_month

                straight_line = (nguyen_gia - gia_tri_thu_hoi) / so_thang

                if khau_hao_thang < straight_line:
                    khau_hao_thang = straight_line

            else:
                khau_hao_thang = (nguyen_gia - gia_tri_thu_hoi) / so_thang

            # =========================
            # 5. FINAL SAFETY LIMIT
            # =========================

            thuc_ghi = min(khau_hao_thang, gia_tri_con_lai - gia_tri_thu_hoi)

            new_luy_ke = luy_ke + thuc_ghi
            new_con_lai = nguyen_gia - new_luy_ke

            # =========================
            # 6. INSERT
            # =========================

            cursor.execute("""
                INSERT INTO LICHSUKHAUHAO
                (ID_TB, Nam, Thang, GiaTriKhauHaoThang, GiaTriLuyKe, GiaTriConLai)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, (
                id_tb, nam, thang,
                thuc_ghi, new_luy_ke, new_con_lai
            ))

            inserted += 1

        conn.commit()
        return {"status": "success", "inserted": inserted}

    except Exception as e:
        conn.rollback()
        raise e

    finally:
        cursor.close()
        conn.close()
        
def get_depreciation_detail(ma_tb):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM KHAUHAO WHERE ID_TB = %s", (ma_tb,))
        return cursor.fetchone()
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

