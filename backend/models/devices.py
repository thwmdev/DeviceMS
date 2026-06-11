from database.db import get_connection


TABLE_NAME = "THIETBI"

DB_STATUS_BY_FRONTEND = {
    "SAN_SANG": "Sẵn sàng",
    "DA_CAP_PHAT": "Đã câp phât",
    "THANH_LY": "Thanh Lý",
}

FRONTEND_STATUS_BY_DB = {
    "SanSang": "SAN_SANG",
    "DaCapPhat": "DA_CAP_PHAT",
    "ThanhLy": "THANH_LY",
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
        "NgayMua": ngay_mua,
        "GiaTri": float(db_device["NguyenGia"]) if db_device["NguyenGia"] is not None else None,
        "TrangThai": normalize_status_for_frontend(db_device["TrangThai"]),
    }


def get_devices_paginated(page=1, limit=10, search=""):
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
            where_clause += " AND (CAST(ID_TB AS CHAR) LIKE %s OR TenThietBi LIKE %s)"
            keyword = f"%{search}%"
            params.extend([keyword, keyword])

        count_query = f"SELECT COUNT(*) AS total FROM {TABLE_NAME} {where_clause}"
        cursor.execute(count_query, tuple(params))
        total = cursor.fetchone()["total"]

        data_query = f"""
            SELECT *
            FROM {TABLE_NAME}
            {where_clause}
            ORDER BY ID_TB DESC
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


def get_device_by_id(matb):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"SELECT * FROM {TABLE_NAME} WHERE ID_TB = %s",
            (matb,),
        )
        return map_to_frontend(cursor.fetchone())
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def create_device(data):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor()

        cursor.execute(f"SELECT COALESCE(MAX(ID_TB), 0) + 1 FROM {TABLE_NAME}")
        device_id = cursor.fetchone()[0]

        cursor.execute(
            f"""
            INSERT INTO {TABLE_NAME} (ID_TB, TenThietBi, Loai, NgayMua, NguyenGia, TrangThai)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                device_id,
                data["TenThietBi"],
                data["LoaiThietBi"],
                data.get("NgayMua") or None,
                data.get("GiaTri") or None,
                normalize_status_for_db(data.get("TrangThai")),
            ),
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

        cursor.execute(
            f"""
            UPDATE {TABLE_NAME}
            SET ID_TB = %s,
                TenThietBi = %s,
                Loai = %s,
                NgayMua = %s,
                NguyenGia = %s,
                TrangThai = %s
            WHERE ID_TB = %s
            """,
            (
                new_device_id,
                data["TenThietBi"],
                data["LoaiThietBi"],
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
            f"DELETE FROM {TABLE_NAME} WHERE ID_TB = %s",
            (matb,),
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
