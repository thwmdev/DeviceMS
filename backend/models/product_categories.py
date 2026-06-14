from database.db import get_connection


TABLE_NAME = "DANHMUCSANPHAM"


def _ensure_ma_dot_column():
    """Tự động thêm cột MaDot nếu chưa có."""
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            return
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'DANHMUCSANPHAM'
              AND COLUMN_NAME = 'MaDot'
            """
        )
        if cursor.fetchone()["cnt"] == 0:
            cursor.execute("ALTER TABLE DANHMUCSANPHAM ADD COLUMN MaDot VARCHAR(50) NULL")
            conn.commit()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def ensure_category_table():
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor()
        cursor.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
                ID_DM INT PRIMARY KEY AUTO_INCREMENT,
                MaDanhMuc VARCHAR(30) NOT NULL UNIQUE,
                TenDanhMuc VARCHAR(100) NOT NULL,
                MoTa VARCHAR(255),
                TrangThai VARCHAR(20) NOT NULL DEFAULT 'HoatDong',
                NgayTao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                NgayCapNhat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def normalize_category(row):
    if not row:
        return None

    ngay_tao = row.get("NgayTao")
    ngay_cap_nhat = row.get("NgayCapNhat")

    return {
        "ID_DM": row["ID_DM"],
        "MaDanhMuc": row["MaDanhMuc"],
        "TenDanhMuc": row["TenDanhMuc"],
        "MoTa": row.get("MoTa") or "",
        "TrangThai": row["TrangThai"],
        "NgayTao": ngay_tao.isoformat() if hasattr(ngay_tao, "isoformat") else str(ngay_tao or ""),
        "NgayCapNhat": ngay_cap_nhat.isoformat() if hasattr(ngay_cap_nhat, "isoformat") else str(ngay_cap_nhat or ""),
        "MaDot": row.get("MaDot") or "",
    }


def validate_category_payload(data, is_update=False):
    code = str(data.get("MaDanhMuc", "")).strip().upper()
    name = str(data.get("TenDanhMuc", "")).strip()
    description = str(data.get("MoTa", "")).strip()
    status = str(data.get("TrangThai", "HoatDong")).strip() or "HoatDong"

    if not code:
        raise ValueError("Ma danh muc khong duoc de trong.")
    if len(code) > 30:
        raise ValueError("Ma danh muc khong duoc vuot qua 30 ky tu.")
    if not name:
        raise ValueError("Ten danh muc khong duoc de trong.")
    if len(name) > 100:
        raise ValueError("Ten danh muc khong duoc vuot qua 100 ky tu.")
    if len(description) > 255:
        raise ValueError("Mo ta khong duoc vuot qua 255 ky tu.")
    if status not in ["HoatDong", "TamDung"]:
        raise ValueError("Trang thai danh muc khong hop le.")

    return {
        "MaDanhMuc": code,
        "TenDanhMuc": name,
        "MoTa": description or None,
        "TrangThai": status,
    }


def get_categories_paginated(page=1, limit=10, search="", batch_id=""):
    ensure_category_table()
    _ensure_ma_dot_column()
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

        if search:
            where_clause += " AND (MaDanhMuc LIKE %s OR TenDanhMuc LIKE %s OR MoTa LIKE %s)"
            keyword = f"%{search}%"
            params.extend([keyword, keyword, keyword])

        if batch_id:
            where_clause += " AND MaDot = %s"
            params.append(batch_id)

        cursor.execute(f"SELECT COUNT(*) AS total FROM {TABLE_NAME} {where_clause}", tuple(params))
        total = cursor.fetchone()["total"]

        cursor.execute(
            f"""
            SELECT *
            FROM {TABLE_NAME}
            {where_clause}
            ORDER BY ID_DM DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [limit, offset]),
        )

        return {
            "data": [normalize_category(row) for row in cursor.fetchall()],
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


def get_category_batches():
    """Trả về danh sách các mã đợt đã dùng."""
    _ensure_ma_dot_column()
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


def get_category_by_id(category_id):
    ensure_category_table()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"SELECT * FROM {TABLE_NAME} WHERE ID_DM = %s", (category_id,))
        return normalize_category(cursor.fetchone())
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def create_category(data):
    ensure_category_table()
    _ensure_ma_dot_column()
    payload = validate_category_payload(data)
    ma_dot = str(data.get("MaDot") or "").strip() or None
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor()
        cursor.execute(
            f"""
            INSERT INTO {TABLE_NAME} (MaDanhMuc, TenDanhMuc, MoTa, TrangThai, MaDot)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                payload["MaDanhMuc"],
                payload["TenDanhMuc"],
                payload["MoTa"],
                payload["TrangThai"],
                ma_dot,
            ),
        )
        conn.commit()
        return cursor.lastrowid
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def update_category(category_id, data):
    ensure_category_table()
    payload = validate_category_payload(data, is_update=True)
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"SELECT ID_DM FROM {TABLE_NAME} WHERE MaDanhMuc = %s AND ID_DM != %s",
            (payload["MaDanhMuc"], category_id),
        )
        if cursor.fetchone():
            raise ValueError("Ma danh muc da ton tai.")

        cursor.execute(f"SELECT TenDanhMuc FROM {TABLE_NAME} WHERE ID_DM = %s", (category_id,))
        old_cat = cursor.fetchone()
        if not old_cat:
            raise ValueError("Danh muc khong ton tai.")
        old_name = old_cat["TenDanhMuc"]

        cursor.close()
        cursor = conn.cursor()

        cursor.execute(
            f"""
            UPDATE {TABLE_NAME}
            SET MaDanhMuc = %s,
                TenDanhMuc = %s,
                MoTa = %s,
                TrangThai = %s
            WHERE ID_DM = %s
            """,
            (
                payload["MaDanhMuc"],
                payload["TenDanhMuc"],
                payload["MoTa"],
                payload["TrangThai"],
                category_id,
            ),
        )
        
        # Update device table if category name changed
        if old_name != payload["TenDanhMuc"]:
            cursor.execute("UPDATE THIETBI SET Loai = %s WHERE Loai = %s", (payload["TenDanhMuc"], old_name))

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


def toggle_category_status(category_id):
    ensure_category_table()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"SELECT TrangThai FROM {TABLE_NAME} WHERE ID_DM = %s", (category_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError("Danh muc khong ton tai.")

        next_status = "TamDung" if row["TrangThai"] == "HoatDong" else "HoatDong"
        cursor.close()
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE {TABLE_NAME} SET TrangThai = %s WHERE ID_DM = %s",
            (next_status, category_id),
        )
        conn.commit()
        return next_status
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def delete_category(category_id):
    ensure_category_table()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor()
        cursor.execute(f"DELETE FROM {TABLE_NAME} WHERE ID_DM = %s", (category_id,))
        if cursor.rowcount == 0:
            raise ValueError("Danh muc khong ton tai.")
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
