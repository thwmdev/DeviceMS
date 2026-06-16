from database.db import get_connection


TABLE_NAME = "THIETBI"

DB_STATUS_BY_FRONTEND = {
    "SAN_SANG": "SanSang",
    "DA_CAP_PHAT": "DaCapPhat",
    "THANH_LY": "ThanhLy",
}

FRONTEND_STATUS_BY_DB = {
    "SanSang": "SAN_SANG",
    "DaCapPhat": "DA_CAP_PHAT",
    "ThanhLy": "THANH_LY",
    "Sẵn sàng": "SAN_SANG",
    "Đã cấp phát": "DA_CAP_PHAT",
    "Đã câp phât": "DA_CAP_PHAT",
    "Thanh Lý": "THANH_LY",
    "Thanh lý": "THANH_LY",
}


def normalize_status_for_frontend(status):
    return FRONTEND_STATUS_BY_DB.get(status, status)


def normalize_status_for_db(status):
    return DB_STATUS_BY_FRONTEND.get(status, status or "SanSang")


def parse_device_id(value):
    try:
        device_id = int(str(value).strip())
    except (TypeError, ValueError):
        raise ValueError("Ma thiet bi phai la so.")

    if device_id <= 0:
        raise ValueError("Ma thiet bi phai lon hon 0.")

    return device_id


def _ensure_device_columns():
    """Tự động thêm các cột MaDot, NgayThanhLy, NgayTao nếu chưa có."""
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            return
        cursor = conn.cursor(dictionary=True)
        
        # Thêm MaDot
        cursor.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'THIETBI'
              AND COLUMN_NAME = 'MaDot'
            """
        )
        if cursor.fetchone()["cnt"] == 0:
            cursor.execute("ALTER TABLE THIETBI ADD COLUMN MaDot VARCHAR(50) NULL")
            conn.commit()
            
        # Thêm NgayThanhLy
        cursor.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'THIETBI'
              AND COLUMN_NAME = 'NgayThanhLy'
            """
        )
        if cursor.fetchone()["cnt"] == 0:
            cursor.execute("ALTER TABLE THIETBI ADD COLUMN NgayThanhLy DATETIME NULL")
            conn.commit()

        # Thêm NgayTao
        cursor.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'THIETBI'
              AND COLUMN_NAME = 'NgayTao'
            """
        )
        if cursor.fetchone()["cnt"] == 0:
            cursor.execute("ALTER TABLE THIETBI ADD COLUMN NgayTao DATETIME NULL DEFAULT CURRENT_TIMESTAMP")
            conn.commit()
            cursor.execute("UPDATE THIETBI SET NgayTao = COALESCE(NgayMua, CURRENT_TIMESTAMP()) WHERE NgayTao IS NULL")
            conn.commit()

        # Thêm MaDotThanhLy
        cursor.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'THIETBI'
              AND COLUMN_NAME = 'MaDotThanhLy'
            """
        )
        if cursor.fetchone()["cnt"] == 0:
            cursor.execute("ALTER TABLE THIETBI ADD COLUMN MaDotThanhLy VARCHAR(50) NULL")
            conn.commit()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def map_to_frontend(db_device):
    if not db_device:
        return None

    ngay_mua = db_device.get("NgayMua")
    if ngay_mua and hasattr(ngay_mua, "isoformat"):
        ngay_mua = ngay_mua.isoformat()
    elif ngay_mua:
        ngay_mua = str(ngay_mua)

    return {
        "MaTB": db_device["ID_TB"],
        "MaThietBi": str(db_device["ID_TB"]),
        "TenThietBi": db_device["TenThietBi"],
        "LoaiThietBi": db_device["Loai"],
        "SeriNumber": db_device.get("SeriNumber") or "",
        "NgayMua": ngay_mua,
        "GiaTri": float(db_device["NguyenGia"]) if db_device["NguyenGia"] is not None else None,
        "TrangThai": normalize_status_for_frontend(db_device["TrangThai"]),
        "MaDot": db_device.get("MaDot") or "",
        "MaDotThanhLy": db_device.get("MaDotThanhLy") or "",
        "NguoiSuDung": db_device.get("NguoiSuDung") or "",
        "ThoiGianKhauHao": db_device.get("ThoiGianKhauHao"),
    }



def get_devices_paginated(page=1, limit=10, search="", batch_id="", dispose_batch_id="", employee_id=None):
    _ensure_device_columns()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        offset = (page - 1) * limit

        where_clause = "WHERE 1 = 1"
        params = []

        if employee_id:
            where_clause += " AND t.ID_TB IN (SELECT ID_TB FROM LICHSUCAPPHAT WHERE ID_NV = %s AND (TrangThai IS NULL OR TrangThai NOT IN ('DaThuHoi', 'ThuHoi')))"
            params.append(employee_id)

        if search:
            where_clause += " AND (CAST(t.ID_TB AS CHAR) LIKE %s OR t.TenThietBi LIKE %s OR t.SeriNumber LIKE %s OR t.MaDot LIKE %s OR t.MaDotThanhLy LIKE %s)"
            keyword = f"%{search}%"
            params.extend([keyword, keyword, keyword, keyword, keyword])

        if batch_id:
            where_clause += " AND t.MaDot = %s"
            params.append(batch_id)

        if dispose_batch_id:
            where_clause += " AND t.MaDotThanhLy = %s"
            params.append(dispose_batch_id)

        count_query = f"SELECT COUNT(*) AS total FROM {TABLE_NAME} t {where_clause}"
        cursor.execute(count_query, tuple(params))
        total = cursor.fetchone()["total"]

        data_query = f"""
            SELECT t.*,
                   d.ThoiGianKhauHao,
                   (SELECT n.HoTen 
                    FROM LICHSUCAPPHAT cp 
                    JOIN NHANVIEN n ON cp.ID_NV = n.ID_NV 
                    WHERE cp.ID_TB = t.ID_TB 
                      AND (cp.TrangThai IS NULL OR cp.TrangThai NOT IN ('DaThuHoi', 'ThuHoi')) 
                    ORDER BY cp.NgayCap DESC LIMIT 1) AS NguoiSuDung
            FROM {TABLE_NAME} t
            LEFT JOIN DANHMUCSANPHAM d ON t.ID_DM = d.ID_DM
            {where_clause}
            ORDER BY t.ID_TB ASC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        cursor.execute(data_query, tuple(params))
        devices = cursor.fetchall()

        return {
            "data": [map_to_frontend(device) for device in devices],
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": max(1, (total + limit - 1) // limit),
        }
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def get_device_batches():
    """Trả về danh sách các mã đợt đã dùng (DISTINCT MaDot)."""
    _ensure_device_columns()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT DISTINCT MaDot FROM {TABLE_NAME} WHERE MaDot IS NOT NULL AND MaDot != '' ORDER BY MaDot DESC"
        )
        return [row[0] for row in cursor.fetchall()]
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def get_device_by_id(matb):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT t.*, 
                   (SELECT n.HoTen 
                    FROM LICHSUCAPPHAT cp 
                    JOIN NHANVIEN n ON cp.ID_NV = n.ID_NV 
                    WHERE cp.ID_TB = t.ID_TB 
                      AND (cp.TrangThai IS NULL OR cp.TrangThai NOT IN ('DaThuHoi', 'ThuHoi')) 
                    ORDER BY cp.NgayCap DESC LIMIT 1) AS NguoiSuDung
            FROM {TABLE_NAME} t
            WHERE t.ID_TB = %s
            """,
            (matb,),
        )
        return map_to_frontend(cursor.fetchone())
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def create_device(data):
    """Tạo thiết bị mới, gán ID_DM và tự tạo bản ghi KHAUHAO từ danh mục."""
    _ensure_device_columns()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)

        seri   = str(data.get("SeriNumber") or "").strip() or None
        ma_dot = str(data.get("MaDot") or "").strip() or None
        ten_danh_muc = str(data["LoaiThietBi"]).strip()
        nguyen_gia = data.get("GiaTri") or data.get("NguyenGia") or 0

        # --- 1. Tra cứu / tạo danh mục, lấy ID_DM + ThoiGianKhauHao ---
        cursor.execute(
            "SELECT ID_DM, ThoiGianKhauHao FROM DANHMUCSANPHAM WHERE TenDanhMuc = %s",
            (ten_danh_muc,)
        )
        dm_row = cursor.fetchone()

        if dm_row:
            id_dm    = dm_row["ID_DM"]
            thoi_gian = int(dm_row["ThoiGianKhauHao"]) if dm_row["ThoiGianKhauHao"] else 5
        else:
            # Danh mục chưa tồn tại → tự tạo, dùng mặc định 5 năm
            import uuid
            ma_danh_muc = f"DM_{str(uuid.uuid4())[:6].upper()}"
            cursor.execute(
                "INSERT INTO DANHMUCSANPHAM (MaDanhMuc, TenDanhMuc, TrangThai, MaDot) VALUES (%s, %s, 'HoatDong', %s)",
                (ma_danh_muc, ten_danh_muc, ma_dot)
            )
            id_dm     = cursor.lastrowid
            thoi_gian = 5

        # --- 2. Lấy ID tiếp theo ---
        cursor.execute(f"SELECT COALESCE(MAX(ID_TB), 0) + 1 AS next_id FROM {TABLE_NAME}")
        device_id = cursor.fetchone()["next_id"]

        # --- 3. INSERT THIETBI với cả Loai (tên) và ID_DM (khoá ngoại) ---
        cursor.execute(
            f"""
            INSERT INTO {TABLE_NAME} (ID_TB, TenThietBi, Loai, ID_DM, SeriNumber, NgayMua, NguyenGia, TrangThai, MaDot)
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
                normalize_status_for_db(data.get("TrangThai", "SanSang")),
                ma_dot,
            ),
        )

        # --- 4. Tạo bản ghi KHAUHAO tự động từ ThoiGianKhauHao của danh mục ---
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
        return device_id
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def update_device(matb, data):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        new_device_id = parse_device_id(data["MaThietBi"])
        cursor = conn.cursor()

        cursor.execute(
            f"SELECT ID_TB FROM {TABLE_NAME} WHERE ID_TB = %s AND ID_TB != %s",
            (new_device_id, matb),
        )
        if cursor.fetchone():
            raise ValueError("Ma thiet bi da duoc dung boi thiet bi khac.")

        seri = str(data.get("SeriNumber") or "").strip() or None

        cursor.execute(
            f"""
            UPDATE {TABLE_NAME}
            SET ID_TB = %s,
                TenThietBi = %s,
                Loai = %s,
                SeriNumber = %s,
                NgayMua = %s,
                NguyenGia = %s,
                TrangThai = %s
            WHERE ID_TB = %s
            """,
            (
                new_device_id,
                data["TenThietBi"],
                data["LoaiThietBi"],
                seri,
                data.get("NgayMua") or None,
                data.get("GiaTri") or None,
                normalize_status_for_db(data["TrangThai"]),
                matb,
            ),
        )
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def soft_delete_device(matb):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"SELECT TrangThai FROM {TABLE_NAME} WHERE ID_TB = %s",
            (matb,),
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError("Thiet bi khong ton tai.")
        if normalize_status_for_frontend(row["TrangThai"]) == "DA_CAP_PHAT":
            raise ValueError("Khong the xoa thiet bi dang duoc cap phat.")

        cursor.close()
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE {TABLE_NAME} SET TrangThai = %s, NgayThanhLy = CURRENT_TIMESTAMP WHERE ID_TB = %s",
            ("THANH_LY", matb,),
        )
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def batch_dispose_devices(device_ids, batch_id):
    if not device_ids:
        raise ValueError("Danh sách thiết bị không được rỗng.")
    if not batch_id:
        raise ValueError("Mã đợt thanh lý không được để trống.")
        
    _ensure_device_columns()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        
        # Tạo chuỗi tham số %s, %s, ...
        placeholders = ', '.join(['%s'] * len(device_ids))
        
        # Kiểm tra xem có thiết bị nào đang cấp phát không
        cursor.execute(
            f"SELECT ID_TB, TrangThai FROM {TABLE_NAME} WHERE ID_TB IN ({placeholders})",
            tuple(device_ids),
        )
        rows = cursor.fetchall()
        
        if len(rows) != len(device_ids):
            raise ValueError("Một số thiết bị không tồn tại trong hệ thống.")
            
        for row in rows:
            if normalize_status_for_frontend(row["TrangThai"]) == "DA_CAP_PHAT":
                raise ValueError(f"Thiết bị mã {row['ID_TB']} đang được cấp phát, không thể thanh lý.")
            if normalize_status_for_frontend(row["TrangThai"]) == "THANH_LY":
                raise ValueError(f"Thiết bị mã {row['ID_TB']} đã được thanh lý trước đó.")

        cursor.close()
        cursor = conn.cursor()
        
        # Cập nhật hàng loạt
        params = ["THANH_LY", batch_id] + list(device_ids)
        cursor.execute(
            f"UPDATE {TABLE_NAME} SET TrangThai = %s, NgayThanhLy = CURRENT_TIMESTAMP, MaDotThanhLy = %s WHERE ID_TB IN ({placeholders})",
            tuple(params),
        )
        conn.commit()
        return cursor.rowcount
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

