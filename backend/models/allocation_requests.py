from database.db import get_connection


REQUEST_TABLE = "YEUCAU"
ASSIGNMENT_TABLE = "LICHSUCAPPHAT"
RETURN_TABLE = "LICHSUTHUHOI"
DEVICE_TABLE = "THIETBI"
EMPLOYEE_TABLE = "NHANVIEN"

REQUEST_TYPE_ALLOCATE = "CAP_PHAT"
REQUEST_TYPE_RETURN = "THU_HOI"

STATUS_PENDING = "ChoDuyet"
STATUS_APPROVED = "DaDuyet"
STATUS_REJECTED = "TuChoi"

DEVICE_READY = "SanSang"
DEVICE_ASSIGNED = "DaCapPhat"
DEVICE_RETIRED = "ThanhLy"

ACTIVE_ASSIGNMENT_STATUS = "DangCapPhat"
RETURNED_ASSIGNMENT_STATUS = "DaThuHoi"


def _date_to_text(value):
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _clean_text(value, default=""):
    return str(value if value is not None else default).strip()


def _clean_int(value, field_name):
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} phai la so.")
    if number <= 0:
        raise ValueError(f"{field_name} phai lon hon 0.")
    return number


def _device_status_key(status):
    value = _clean_text(status)
    mapping = {
        "SanSang": "SAN_SANG",
        "SAN_SANG": "SAN_SANG",
        "Sáºµn sÃ ng": "SAN_SANG",
        "DaCapPhat": "DA_CAP_PHAT",
        "DA_CAP_PHAT": "DA_CAP_PHAT",
        "ÄÃ£ cáº¥p phÃ¡t": "DA_CAP_PHAT",
        "ThanhLy": "THANH_LY",
        "THANH_LY": "THANH_LY",
        "Thanh lÃ½": "THANH_LY",
    }
    return mapping.get(value, value)


def _device_status_for_db(status):
    value = _clean_text(status, DEVICE_READY)
    mapping = {
        "SAN_SANG": DEVICE_READY,
        "DA_CAP_PHAT": DEVICE_ASSIGNED,
        "THANH_LY": DEVICE_RETIRED,
        "SanSang": DEVICE_READY,
        "DaCapPhat": DEVICE_ASSIGNED,
        "ThanhLy": DEVICE_RETIRED,
    }
    return mapping.get(value, DEVICE_READY)


def _request_type(value):
    normalized = _clean_text(value).upper()
    if normalized in ["CAP_PHAT", "CAP PHAT", "CAPPHAT", "ALLOCATE"]:
        return REQUEST_TYPE_ALLOCATE
    if normalized in ["THU_HOI", "THU HOI", "THUHOI", "RETURN", "REVOKE"]:
        return REQUEST_TYPE_RETURN
    raise ValueError("Loai yeu cau khong hop le.")


def _column_exists(conn, table_name, column_name):
    """Dùng connection riêng (cursor mới) để kiểm tra cột, tránh unread-result."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = %s
              AND COLUMN_NAME = %s
            """,
            (table_name, column_name),
        )
        row = cursor.fetchone()
        return (row["cnt"] if row else 0) > 0
    finally:
        cursor.close()


def _add_column_if_missing(conn, table_name, column_name, definition):
    """Thêm cột nếu chưa tồn tại, dùng cursor riêng cho mỗi thao tác."""
    if _column_exists(conn, table_name, column_name):
        return
    cursor = conn.cursor()
    try:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")
        # Consume any result MySQL Connector might leave after DDL
        try:
            cursor.fetchall()
        except Exception:
            pass
        conn.commit()
    finally:
        cursor.close()


def _run_ddl(conn, sql):
    """Chạy 1 câu DDL trên cursor mới, consume result, commit."""
    cursor = conn.cursor()
    try:
        cursor.execute(sql)
        try:
            cursor.fetchall()
        except Exception:
            pass
        conn.commit()
    finally:
        cursor.close()


def ensure_allocation_tables():
    conn = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        # Tạo bảng nếu chưa tồn tại — mỗi DDL dùng cursor riêng
        _run_ddl(conn, f"""
            CREATE TABLE IF NOT EXISTS {REQUEST_TABLE} (
                ID_YC INT PRIMARY KEY,
                ID_NV INT NOT NULL,
                ID_TB INT NULL,
                LoaiYeuCau VARCHAR(50) NOT NULL,
                LyDo VARCHAR(255),
                NgayTraDuKien DATE NULL,
                NgayGui DATETIME DEFAULT CURRENT_TIMESTAMP,
                TrangThaiDuyet VARCHAR(20) DEFAULT '{STATUS_PENDING}',
                NgayDuyet DATETIME NULL,
                NguoiDuyet VARCHAR(50) NULL,
                GhiChuDuyet VARCHAR(255) NULL,
                ID_CP INT NULL
            )
        """)
        _run_ddl(conn, f"""
            CREATE TABLE IF NOT EXISTS {ASSIGNMENT_TABLE} (
                ID_CP INT PRIMARY KEY,
                ID_TB INT NOT NULL,
                ID_NV INT NOT NULL,
                ID_YC INT NULL,
                NgayCap DATETIME DEFAULT CURRENT_TIMESTAMP,
                NgayTraDuKien DATE NULL,
                TrangThai VARCHAR(20),
                GhiChu VARCHAR(255)
            )
        """)
        _run_ddl(conn, f"""
            CREATE TABLE IF NOT EXISTS {RETURN_TABLE} (
                ID_TH INT PRIMARY KEY,
                ID_CP INT NOT NULL,
                ID_YC INT NULL,
                NgayThuHoi DATETIME DEFAULT CURRENT_TIMESTAMP,
                TinhTrang VARCHAR(255),
                GhiChu VARCHAR(255)
            )
        """)

        # Thêm cột nếu chưa có — mỗi thêm dùng cursor riêng
        _add_column_if_missing(conn, REQUEST_TABLE, "ID_TB", "INT NULL")
        _add_column_if_missing(conn, REQUEST_TABLE, "LyDo", "VARCHAR(255) NULL")
        _add_column_if_missing(conn, REQUEST_TABLE, "NgayTraDuKien", "DATE NULL")
        _add_column_if_missing(conn, REQUEST_TABLE, "NgayDuyet", "DATETIME NULL")
        _add_column_if_missing(conn, REQUEST_TABLE, "NguoiDuyet", "VARCHAR(50) NULL")
        _add_column_if_missing(conn, REQUEST_TABLE, "GhiChuDuyet", "VARCHAR(255) NULL")
        _add_column_if_missing(conn, REQUEST_TABLE, "ID_CP", "INT NULL")
        _add_column_if_missing(conn, REQUEST_TABLE, "MaDot", "VARCHAR(50) NULL")

        _add_column_if_missing(conn, ASSIGNMENT_TABLE, "ID_YC", "INT NULL")
        _add_column_if_missing(conn, ASSIGNMENT_TABLE, "NgayTraDuKien", "DATE NULL")
        _add_column_if_missing(conn, ASSIGNMENT_TABLE, "GhiChu", "VARCHAR(255) NULL")

        _add_column_if_missing(conn, RETURN_TABLE, "ID_YC", "INT NULL")
        _add_column_if_missing(conn, RETURN_TABLE, "GhiChu", "VARCHAR(255) NULL")
    finally:
        if conn:
            conn.close()



def _next_id(cursor, table_name, column_name):
    cursor.execute(f"SELECT COALESCE(MAX({column_name}), 0) + 1 AS next_id FROM {table_name}")
    return cursor.fetchone()["next_id"]


def _map_request(row):
    return {
        "ID_YC": row["ID_YC"],
        "ID_NV": row["ID_NV"],
        "HoTen": row.get("HoTen") or "",
        "PhongBan": row.get("PhongBan") or "",
        "ID_TB": row.get("ID_TB"),
        "TenThietBi": row.get("TenThietBi") or "",
        "LoaiThietBi": row.get("Loai") or "",
        "LoaiYeuCau": row.get("LoaiYeuCau") or REQUEST_TYPE_ALLOCATE,
        "LyDo": row.get("LyDo") or "",
        "NgayTraDuKien": _date_to_text(row.get("NgayTraDuKien")),
        "NgayGui": _date_to_text(row.get("NgayGui")),
        "TrangThaiDuyet": row.get("TrangThaiDuyet") or STATUS_PENDING,
        "NgayDuyet": _date_to_text(row.get("NgayDuyet")),
        "NguoiDuyet": row.get("NguoiDuyet") or "",
        "GhiChuDuyet": row.get("GhiChuDuyet") or "",
        "ID_CP": row.get("ID_CP"),
        "TrangThaiCapPhat": row.get("TrangThaiCapPhat") or "",
        "MaDot": row.get("MaDot") or "",
    }


def _map_employee(row):
    return {
        "ID_NV": row["ID_NV"],
        "HoTen": row.get("HoTen") or "",
        "Email": row.get("Email") or "",
        "PhongBan": row.get("PhongBan") or "",
        "ChucVu": row.get("ChucVu") or "",
    }


def _map_device(row):
    return {
        "ID_TB": row["ID_TB"],
        "TenThietBi": row.get("TenThietBi") or "",
        "LoaiThietBi": row.get("Loai") or "",
        "SeriNumber": row.get("SeriNumber") or "",
        "TrangThai": _device_status_key(row.get("TrangThai")),
    }


def _map_assignment(row):
    ngay_cap = _date_to_text(row.get("NgayCap"))
    return {
        "ID_CP": row["ID_CP"],
        "ID_NV": row["ID_NV"],
        "HoTen": row.get("HoTen") or "",
        "ID_TB": row["ID_TB"],
        "TenThietBi": row.get("TenThietBi") or "",
        "LoaiThietBi": row.get("Loai") or "",
        "NgayCap": ngay_cap,
        "TrangThai": row.get("TrangThai") or ACTIVE_ASSIGNMENT_STATUS,
    }


def get_allocation_options(employee_id=None):
    ensure_allocation_tables()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT ID_NV, HoTen, Email, PhongBan, ChucVu
            FROM {EMPLOYEE_TABLE}
            WHERE TrangThai IS NULL OR TrangThai IN ('HoatDong', 'HOAT_DONG')
            ORDER BY HoTen ASC, ID_NV ASC
            """
        )
        employees = [_map_employee(row) for row in cursor.fetchall()]

        cursor.execute(
            f"""
            SELECT ID_TB, TenThietBi, Loai, SeriNumber, TrangThai
            FROM {DEVICE_TABLE}
            WHERE TrangThai IN ('SanSang', 'SAN_SANG', 'Sẵn sàng')
            ORDER BY TenThietBi ASC, ID_TB ASC
            """
        )
        available_devices = [_map_device(row) for row in cursor.fetchall()]

        # Nếu có employee_id, chỉ lấy các cấp phát của nhân viên đó
        extra_where = ""
        extra_params = [RETURNED_ASSIGNMENT_STATUS, "ThuHoi"]
        if employee_id:
            extra_where = "AND cp.ID_NV = %s"
            extra_params.append(employee_id)

        cursor.execute(
            f"""
            SELECT cp.ID_CP, cp.ID_NV, nv.HoTen, cp.ID_TB, tb.TenThietBi,
                   tb.Loai, cp.NgayCap, cp.TrangThai
            FROM {ASSIGNMENT_TABLE} cp
            JOIN {DEVICE_TABLE} tb ON tb.ID_TB = cp.ID_TB
            JOIN {EMPLOYEE_TABLE} nv ON nv.ID_NV = cp.ID_NV
            WHERE (cp.TrangThai IS NULL OR cp.TrangThai NOT IN (%s, %s))
              AND tb.TrangThai IN ('DaCapPhat', 'DA_CAP_PHAT', 'Đã cấp phát')
              {extra_where}
            ORDER BY cp.NgayCap DESC, cp.ID_CP DESC
            """,
            tuple(extra_params),
        )
        active_assignments = [_map_assignment(row) for row in cursor.fetchall()]

        return {
            "employees": employees,
            "availableDevices": available_devices,
            "activeAssignments": active_assignments,
        }
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def get_requests_paginated(page=1, limit=10, search="", request_type="", status="", batch_id="", employee_id=None):
    ensure_allocation_tables()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        offset = (page - 1) * limit
        where_parts = ["1 = 1"]
        params = []

        if search:
            keyword = f"%{search}%"
            where_parts.append(
                """
                (CAST(y.ID_YC AS CHAR) LIKE %s
                 OR CAST(y.ID_TB AS CHAR) LIKE %s
                 OR CAST(y.ID_NV AS CHAR) LIKE %s
                 OR nv.HoTen LIKE %s
                 OR tb.TenThietBi LIKE %s
                 OR y.LyDo LIKE %s)
                """
            )
            params.extend([keyword, keyword, keyword, keyword, keyword, keyword])

        if request_type:
            where_parts.append("y.LoaiYeuCau = %s")
            params.append(_request_type(request_type))

        if status:
            where_parts.append("y.TrangThaiDuyet = %s")
            params.append(status)

        if batch_id:
            where_parts.append("y.MaDot = %s")
            params.append(batch_id)

        if employee_id:
            where_parts.append("y.ID_NV = %s")
            params.append(employee_id)

        where_clause = " AND ".join(where_parts)

        cursor.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM {REQUEST_TABLE} y
            LEFT JOIN {EMPLOYEE_TABLE} nv ON nv.ID_NV = y.ID_NV
            LEFT JOIN {DEVICE_TABLE} tb ON tb.ID_TB = y.ID_TB
            WHERE {where_clause}
            """,
            tuple(params),
        )
        total = cursor.fetchone()["total"]

        cursor.execute(
            f"""
            SELECT y.*, nv.HoTen, nv.PhongBan, tb.TenThietBi, tb.Loai,
                   cp.TrangThai AS TrangThaiCapPhat
            FROM {REQUEST_TABLE} y
            LEFT JOIN {EMPLOYEE_TABLE} nv ON nv.ID_NV = y.ID_NV
            LEFT JOIN {DEVICE_TABLE} tb ON tb.ID_TB = y.ID_TB
            LEFT JOIN {ASSIGNMENT_TABLE} cp ON cp.ID_CP = y.ID_CP
            WHERE {where_clause}
            ORDER BY y.ID_YC DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [limit, offset]),
        )
        rows = cursor.fetchall()

        return {
            "data": [_map_request(row) for row in rows],
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


def get_request_batches():
    """Tráº£ vá» danh sÃ¡ch cÃ¡c mÃ£ Äá»£t yÃªu cáº§u ÄÃ£ dÃ¹ng."""
    ensure_allocation_tables()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT DISTINCT MaDot FROM {REQUEST_TABLE} WHERE MaDot IS NOT NULL AND MaDot != '' ORDER BY MaDot DESC"
        )
        return [row[0] for row in cursor.fetchall()]
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def _get_device(cursor, device_id):
    cursor.execute(
        f"SELECT ID_TB, TenThietBi, Loai, TrangThai FROM {DEVICE_TABLE} WHERE ID_TB = %s",
        (device_id,),
    )
    return cursor.fetchone()


def _get_employee(cursor, employee_id):
    cursor.execute(
        f"SELECT ID_NV, HoTen FROM {EMPLOYEE_TABLE} WHERE ID_NV = %s",
        (employee_id,),
    )
    return cursor.fetchone()


def _get_active_assignment(cursor, assignment_id=None, device_id=None, employee_id=None):
    where_parts = [
        "(cp.TrangThai IS NULL OR cp.TrangThai NOT IN (%s, %s))",
        "tb.TrangThai IN ('DaCapPhat', 'DA_CAP_PHAT', 'ÄÃ£ cáº¥p phÃ¡t')",
    ]
    params = [RETURNED_ASSIGNMENT_STATUS, "ThuHoi"]

    if assignment_id:
        where_parts.append("cp.ID_CP = %s")
        params.append(assignment_id)
    if device_id:
        where_parts.append("cp.ID_TB = %s")
        params.append(device_id)
    if employee_id:
        where_parts.append("cp.ID_NV = %s")
        params.append(employee_id)

    cursor.execute(
        f"""
        SELECT cp.*, tb.TenThietBi, tb.TrangThai AS TrangThaiThietBi, nv.HoTen
        FROM {ASSIGNMENT_TABLE} cp
        JOIN {DEVICE_TABLE} tb ON tb.ID_TB = cp.ID_TB
        JOIN {EMPLOYEE_TABLE} nv ON nv.ID_NV = cp.ID_NV
        WHERE {" AND ".join(where_parts)}
        ORDER BY cp.ID_CP DESC
        LIMIT 1
        """,
        tuple(params),
    )
    return cursor.fetchone()


def _insert_request(cursor, payload):
    request_id = _next_id(cursor, REQUEST_TABLE, "ID_YC")
    ma_dot = str(payload.get("MaDot") or "").strip() or None
    cursor.execute(
        f"""
        INSERT INTO {REQUEST_TABLE}
            (ID_YC, ID_NV, ID_TB, LoaiYeuCau, LyDo, NgayTraDuKien,
             TrangThaiDuyet, ID_CP, MaDot)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            request_id,
            payload["ID_NV"],
            payload["ID_TB"],
            payload["LoaiYeuCau"],
            payload.get("LyDo") or None,
            payload.get("NgayTraDuKien") or None,
            STATUS_PENDING,
            payload.get("ID_CP"),
            ma_dot,
        ),
    )
    return request_id


def create_allocation_request(data):
    ensure_allocation_tables()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        request_type = _request_type(data.get("LoaiYeuCau"))
        reason = _clean_text(data.get("LyDo"))[:255]
        return_due_date = _clean_text(data.get("NgayTraDuKien")) or None

        cursor = conn.cursor(dictionary=True)

        if request_type == REQUEST_TYPE_ALLOCATE:
            employee_id = _clean_int(data.get("ID_NV"), "Ma nhan vien")
            device_id = _clean_int(data.get("ID_TB"), "Ma thiet bi")

            if not _get_employee(cursor, employee_id):
                raise ValueError("Nhan vien khong ton tai.")

            device = _get_device(cursor, device_id)
            if not device:
                raise ValueError("Thiet bi khong ton tai.")
            if _device_status_key(device.get("TrangThai")) != "SAN_SANG":
                raise ValueError("Chi co the yeu cau cap phat thiet bi dang san sang.")

            cursor.execute(
                f"""
                SELECT ID_YC FROM {REQUEST_TABLE}
                WHERE ID_TB = %s
                  AND LoaiYeuCau = %s
                  AND TrangThaiDuyet = %s
                LIMIT 1
                """,
                (device_id, REQUEST_TYPE_ALLOCATE, STATUS_PENDING),
            )
            if cursor.fetchone():
                raise ValueError("Thiet bi nay da co yeu cau cap phat dang cho duyet.")

            request_id = _insert_request(
                cursor,
                {
                    "ID_NV": employee_id,
                    "ID_TB": device_id,
                    "LoaiYeuCau": request_type,
                    "LyDo": reason,
                    "NgayTraDuKien": return_due_date,
                    "MaDot": data.get("MaDot"),
                },
            )
        else:
            assignment_id = data.get("ID_CP")
            assignment = None
            if assignment_id:
                assignment = _get_active_assignment(
                    cursor,
                    assignment_id=_clean_int(assignment_id, "Ma cap phat"),
                )
            else:
                employee_id = _clean_int(data.get("ID_NV"), "Ma nhan vien")
                device_id = _clean_int(data.get("ID_TB"), "Ma thiet bi")
                assignment = _get_active_assignment(
                    cursor,
                    device_id=device_id,
                    employee_id=employee_id,
                )

            if not assignment:
                raise ValueError("Khong tim thay lich su cap phat dang hoat dong.")

            cursor.execute(
                f"""
                SELECT ID_YC FROM {REQUEST_TABLE}
                WHERE ID_CP = %s
                  AND LoaiYeuCau = %s
                  AND TrangThaiDuyet = %s
                LIMIT 1
                """,
                (assignment["ID_CP"], REQUEST_TYPE_RETURN, STATUS_PENDING),
            )
            if cursor.fetchone():
                raise ValueError("Lich su cap phat nay da co yeu cau thu hoi dang cho duyet.")

            request_id = _insert_request(
                cursor,
                {
                    "ID_NV": assignment["ID_NV"],
                    "ID_TB": assignment["ID_TB"],
                    "LoaiYeuCau": request_type,
                    "LyDo": reason,
                    "ID_CP": assignment["ID_CP"],
                    "MaDot": data.get("MaDot"),
                },
            )

        conn.commit()
        return request_id
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def approve_allocation_request(request_id, data, reviewer):
    ensure_allocation_tables()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"SELECT * FROM {REQUEST_TABLE} WHERE ID_YC = %s FOR UPDATE",
            (request_id,),
        )
        request_row = cursor.fetchone()
        if not request_row:
            raise ValueError("Yeu cau khong ton tai.")
        if request_row.get("TrangThaiDuyet") != STATUS_PENDING:
            raise ValueError("Yeu cau nay da duoc xu ly.")

        note = _clean_text(data.get("GhiChuDuyet"))[:255]
        reviewer_name = _clean_text(reviewer, "system")[:50]

        if request_row["LoaiYeuCau"] == REQUEST_TYPE_ALLOCATE:
            device = _get_device(cursor, request_row["ID_TB"])
            if not device:
                raise ValueError("Thiet bi khong ton tai.")
            if _device_status_key(device.get("TrangThai")) != "SAN_SANG":
                raise ValueError("Thiet bi khong con o trang thai san sang.")

            assignment_id = _next_id(cursor, ASSIGNMENT_TABLE, "ID_CP")
            cursor.execute(
                f"""
                INSERT INTO {ASSIGNMENT_TABLE}
                    (ID_CP, ID_TB, ID_NV, ID_YC, NgayTraDuKien, TrangThai, GhiChu)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    assignment_id,
                    request_row["ID_TB"],
                    request_row["ID_NV"],
                    request_id,
                    request_row.get("NgayTraDuKien"),
                    ACTIVE_ASSIGNMENT_STATUS,
                    note or None,
                ),
            )
            cursor.execute(
                f"UPDATE {DEVICE_TABLE} SET TrangThai = %s WHERE ID_TB = %s",
                (DEVICE_ASSIGNED, request_row["ID_TB"]),
            )
            cursor.execute(
                f"""
                UPDATE {REQUEST_TABLE}
                SET TrangThaiDuyet = %s,
                    NgayDuyet = CURRENT_TIMESTAMP,
                    NguoiDuyet = %s,
                    GhiChuDuyet = %s,
                    ID_CP = %s
                WHERE ID_YC = %s
                """,
                (STATUS_APPROVED, reviewer_name, note or None, assignment_id, request_id),
            )
        else:
            assignment = _get_active_assignment(
                cursor,
                assignment_id=request_row.get("ID_CP"),
                device_id=request_row.get("ID_TB"),
                employee_id=request_row.get("ID_NV"),
            )
            if not assignment:
                raise ValueError("Khong tim thay cap phat dang hoat dong de thu hoi.")

            return_id = _next_id(cursor, RETURN_TABLE, "ID_TH")
            condition = _clean_text(data.get("TinhTrang"), "Tot")[:255]
            next_device_status = _device_status_for_db(data.get("TrangThaiSauThuHoi", DEVICE_READY))

            cursor.execute(
                f"""
                INSERT INTO {RETURN_TABLE}
                    (ID_TH, ID_CP, ID_YC, TinhTrang, GhiChu)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (return_id, assignment["ID_CP"], request_id, condition, note or None),
            )
            cursor.execute(
                f"UPDATE {ASSIGNMENT_TABLE} SET TrangThai = %s WHERE ID_CP = %s",
                (RETURNED_ASSIGNMENT_STATUS, assignment["ID_CP"]),
            )
            cursor.execute(
                f"UPDATE {DEVICE_TABLE} SET TrangThai = %s WHERE ID_TB = %s",
                (next_device_status, assignment["ID_TB"]),
            )
            cursor.execute(
                f"""
                UPDATE {REQUEST_TABLE}
                SET TrangThaiDuyet = %s,
                    NgayDuyet = CURRENT_TIMESTAMP,
                    NguoiDuyet = %s,
                    GhiChuDuyet = %s,
                    ID_CP = %s
                WHERE ID_YC = %s
                """,
                (STATUS_APPROVED, reviewer_name, note or None, assignment["ID_CP"], request_id),
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


def reject_allocation_request(request_id, data, reviewer):
    ensure_allocation_tables()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"SELECT TrangThaiDuyet FROM {REQUEST_TABLE} WHERE ID_YC = %s FOR UPDATE",
            (request_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError("Yeu cau khong ton tai.")
        if row.get("TrangThaiDuyet") != STATUS_PENDING:
            raise ValueError("Yeu cau nay da duoc xu ly.")

        note = _clean_text(data.get("GhiChuDuyet"))[:255]
        reviewer_name = _clean_text(reviewer, "system")[:50]
        cursor.execute(
            f"""
            UPDATE {REQUEST_TABLE}
            SET TrangThaiDuyet = %s,
                NgayDuyet = CURRENT_TIMESTAMP,
                NguoiDuyet = %s,
                GhiChuDuyet = %s
            WHERE ID_YC = %s
            """,
            (STATUS_REJECTED, reviewer_name, note or None, request_id),
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
