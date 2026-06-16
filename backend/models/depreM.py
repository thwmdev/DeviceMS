from database.db import get_connection
import datetime


def save_depreciation(data):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT NguyenGia FROM THIETBI WHERE ID_TB = %s", (data['MaTB'],))
        device = cursor.fetchone()
        if not device:
            raise ValueError("Không tìm thấy thiết bị.")

        nguyen_gia = device['NguyenGia']
        if float(data['residualValue']) >= float(nguyen_gia):
            raise ValueError("Giá trị thu hồi phải nhỏ hơn nguyên giá.")

        cursor.execute("""
            INSERT INTO KHAUHAO (ID_TB, PhuongPhapTinh, ThoiGianSuDung, GiaTriThuHoi, GiaTriBanDau, NgayBatDau)
            VALUES (%s, %s, %s, %s, %s, CURDATE())
            ON DUPLICATE KEY UPDATE
                PhuongPhapTinh = VALUES(PhuongPhapTinh),
                ThoiGianSuDung = VALUES(ThoiGianSuDung),
                GiaTriThuHoi   = VALUES(GiaTriThuHoi),
                GiaTriBanDau   = VALUES(GiaTriBanDau)
        """, (data['MaTB'], data['method'], data['usefulLife'], data['residualValue'], nguyen_gia))
        conn.commit()
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


def caculate_depre(thang=None, nam=None):
    """
    Tính khấu hao tháng cho tất cả thiết bị chưa được tính trong tháng đó.
    Thời gian sử dụng: ưu tiên cấu hình riêng (KHAUHAO), sau đó danh mục (DANHMUCSANPHAM), cuối cùng mặc định 5 năm.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        now = datetime.datetime.now()
        if thang is None: thang = now.month
        if nam is None: nam = now.year

        # Lấy các thiết bị chưa được tính khấu hao trong tháng này
        sql_get = """
            SELECT
                t.ID_TB,
                t.NguyenGia,
                COALESCE(k.PhuongPhapTinh, 'straight-line')               AS PhuongPhapTinh,
                COALESCE(k.ThoiGianSuDung, d.ThoiGianKhauHao, 5)          AS SoNam,
                COALESCE(k.GiaTriThuHoi, 0)                                AS GiaTriThuHoi
            FROM THIETBI t
            LEFT JOIN KHAUHAO        k ON t.ID_TB = k.ID_TB
            LEFT JOIN DANHMUCSANPHAM d ON t.ID_DM  = d.ID_DM
            WHERE t.TrangThai IN ('SanSang', 'SAN_SANG', 'DangSuDung', 'DA_CAP_PHAT', 'DaCapPhat', 'DANG_SU_DUNG')
              AND (t.NgayMua IS NULL OR (YEAR(t.NgayMua) < %s OR (YEAR(t.NgayMua) = %s AND MONTH(t.NgayMua) <= %s)))
              AND t.ID_TB NOT IN (
                  SELECT ID_TB FROM LICHSUKHAUHAO WHERE Nam = %s AND Thang = %s
              )
        """
        cursor.execute(sql_get, (nam, nam, thang, nam, thang))
        danh_sach = cursor.fetchall()

        if not danh_sach:
            return {"status": "skipped", "message": f"Tất cả thiết bị đã được tính khấu hao tháng {thang}/{nam}"}

        inserted = 0
        for item in danh_sach:
            id_tb       = item['ID_TB']
            nguyen_gia  = float(item['NguyenGia'] or 0)
            # Ưu tiên: KHAUHAO.ThoiGianSuDung → DANHMUCSANPHAM.ThoiGianKhauHao → 5
            # COALESCE trong SQL đã xử lý thứ tự này; fallback Python chỉ để tránh None/0
            so_nam      = float(item['SoNam']) if item['SoNam'] else 5
            phuong_phap = item['PhuongPhapTinh']
            gia_tri_thu_hoi = float(item['GiaTriThuHoi'] or 0)

            # Tính lũy kế tất cả tháng trước tháng này
            cursor.execute("""
                SELECT COALESCE(SUM(GiaTriKhauHaoThang), 0) AS LuyKe
                FROM LICHSUKHAUHAO
                WHERE ID_TB = %s
                  AND (Nam < %s OR (Nam = %s AND Thang < %s))
            """, (id_tb, nam, nam, thang))
            luy_ke = float(cursor.fetchone()['LuyKe'])

            gia_tri_con_lai = nguyen_gia - luy_ke

            # Chỉ tính khi còn giá trị khấu hao
            if gia_tri_con_lai <= gia_tri_thu_hoi:
                continue

            if phuong_phap == 'declining-balance':
                ty_le_thang = (2 / so_nam) / 12
                khau_hao_thang = gia_tri_con_lai * ty_le_thang
            else:
                # Đường thẳng (straight-line)
                khau_hao_thang = (nguyen_gia - gia_tri_thu_hoi) / (so_nam * 12)

            # Không khấu hao vượt phần còn được khấu hao
            thuc_ghi = min(khau_hao_thang, gia_tri_con_lai - gia_tri_thu_hoi)

            new_luy_ke   = luy_ke + thuc_ghi
            new_con_lai  = nguyen_gia - new_luy_ke

            cursor.execute("""
                INSERT INTO LICHSUKHAUHAO (ID_TB, Nam, Thang, GiaTriKhauHaoThang, GiaTriLuyKe, GiaTriConLai)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (id_tb, nam, thang, thuc_ghi, new_luy_ke, new_con_lai))
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
