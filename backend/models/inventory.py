from database.db import get_connection

def _date_to_text(value):
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)

def get_inventory_stats():
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")
        
        cursor = conn.cursor(dictionary=True)
        
        # 1. Thống kê theo Loại thiết bị (Categories)
        query_categories = """
            SELECT 
                Loai AS Category,
                COUNT(*) AS TotalItems,
                SUM(CASE WHEN TrangThai IN ('SanSang', 'SAN_SANG', 'Sẵn sàng') THEN 1 ELSE 0 END) AS AvailableItems,
                SUM(CASE WHEN TrangThai IN ('DaCapPhat', 'DA_CAP_PHAT', 'Đã cấp phát', 'Đã câp phât') THEN 1 ELSE 0 END) AS AssignedItems,
                SUM(CASE WHEN TrangThai IN ('ThanhLy', 'THANH_LY', 'Thanh lý', 'Thanh Lý') THEN 1 ELSE 0 END) AS DisposedItems,
                SUM(COALESCE(NguyenGia, 0)) AS TotalValue
            FROM THIETBI
            GROUP BY Loai
            ORDER BY Loai ASC
        """
        cursor.execute(query_categories)
        rows_categories = cursor.fetchall()
        categories_stats = []
        for r in rows_categories:
            categories_stats.append({
                "category": r["Category"] or "Chưa phân loại",
                "total": int(r["TotalItems"]),
                "available": int(r["AvailableItems"]),
                "assigned": int(r["AssignedItems"]),
                "disposed": int(r["DisposedItems"]),
                "value": float(r["TotalValue"])
            })

        # 2. Thống kê theo dòng máy (Models)
        query_models = """
            SELECT 
                TenThietBi AS ModelName,
                Loai AS Category,
                COUNT(*) AS TotalItems,
                SUM(CASE WHEN TrangThai IN ('SanSang', 'SAN_SANG', 'Sẵn sàng') THEN 1 ELSE 0 END) AS AvailableItems,
                SUM(CASE WHEN TrangThai IN ('DaCapPhat', 'DA_CAP_PHAT', 'Đã cấp phát', 'Đã câp phât') THEN 1 ELSE 0 END) AS AssignedItems,
                SUM(CASE WHEN TrangThai IN ('ThanhLy', 'THANH_LY', 'Thanh lý', 'Thanh Lý') THEN 1 ELSE 0 END) AS DisposedItems,
                SUM(COALESCE(NguyenGia, 0)) AS TotalValue
            FROM THIETBI
            GROUP BY TenThietBi, Loai
            ORDER BY TenThietBi ASC
        """
        cursor.execute(query_models)
        rows_models = cursor.fetchall()
        models_stats = []
        for r in rows_models:
            models_stats.append({
                "modelName": r["ModelName"] or "Chưa đặt tên",
                "category": r["Category"] or "Chưa phân loại",
                "total": int(r["TotalItems"]),
                "available": int(r["AvailableItems"]),
                "assigned": int(r["AssignedItems"]),
                "disposed": int(r["DisposedItems"]),
                "value": float(r["TotalValue"])
            })

        return {
            "categories": categories_stats,
            "models": models_stats
        }
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def get_inventory_batches():
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")
        
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT 
                MaDot,
                COUNT(*) AS TotalItems,
                SUM(CASE WHEN TrangThai IN ('SanSang', 'SAN_SANG', 'Sẵn sàng') THEN 1 ELSE 0 END) AS AvailableItems,
                SUM(CASE WHEN TrangThai IN ('ThanhLy', 'THANH_LY', 'Thanh lý', 'Thanh Lý') THEN 1 ELSE 0 END) AS DisposedItems,
                SUM(COALESCE(NguyenGia, 0)) AS TotalValue,
                MIN(NgayTao) AS ImportDate
            FROM THIETBI
            WHERE MaDot IS NOT NULL AND MaDot != ''
            GROUP BY MaDot
            ORDER BY ImportDate DESC, MaDot DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        formatted = []
        for r in rows:
            formatted.append({
                "batchId": r["MaDot"],
                "total": int(r["TotalItems"]),
                "available": int(r["AvailableItems"]),
                "disposed": int(r["DisposedItems"]),
                "value": float(r["TotalValue"]),
                "date": _date_to_text(r["ImportDate"])
            })
        return formatted
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def get_disposal_batches():
    from database.db import get_connection
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")
        
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT 
                MaDotThanhLy AS batchId,
                COUNT(*) AS totalItems,
                SUM(COALESCE(NguyenGia, 0)) AS totalValue,
                MIN(NgayThanhLy) AS disposeDate
            FROM THIETBI
            WHERE MaDotThanhLy IS NOT NULL AND MaDotThanhLy != '' AND TrangThai IN ('THANH_LY', 'Thanh lý', 'ThanhLy')
            GROUP BY MaDotThanhLy
            ORDER BY disposeDate DESC, MaDotThanhLy DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        formatted = []
        for r in rows:
            formatted.append({
                "batchId": r["batchId"],
                "total": int(r["totalItems"]),
                "value": float(r["totalValue"]),
                "date": _date_to_text(r["disposeDate"])
            })
        return formatted
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def get_inventory_transactions(limit=100):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        if not conn:
            raise Exception("Khong the ket noi co so du lieu.")
        
        cursor = conn.cursor(dictionary=True)
        
        # Lấy lịch sử: 
        # 1. Nhập kho theo đợt (GOM NHÓM theo MaDot nếu có MaDot)
        # 2. Nhập kho đơn lẻ (nếu MaDot trống)
        # 3. Xuất cấp phát (NgayCap)
        # 4. Thu hồi (NgayThuHoi)
        # 5. Thanh lý trực tiếp (NgayThanhLy)
        query = """
            (
                SELECT 
                    MIN(ID_TB) AS id, 
                    'IMPORT' AS type, 
                    CONCAT('Nhập đợt ', MaDot) AS name, 
                    'Thiết bị' AS category, 
                    NULL AS seri, 
                    MIN(NgayTao) AS date, 
                    SUM(COALESCE(NguyenGia, 0)) AS value, 
                    NULL AS employee, 
                    MaDot AS batch, 
                    CONCAT('Nhập mới đợt thiết bị (Tổng cộng: ', COUNT(*), ' thiết bị)') AS description
                FROM THIETBI
                WHERE MaDot IS NOT NULL AND MaDot != ''
                GROUP BY MaDot
            )
            UNION ALL
            (
                SELECT 
                    ID_TB AS id, 
                    'IMPORT' AS type, 
                    TenThietBi AS name, 
                    Loai AS category, 
                    SeriNumber AS seri, 
                    NgayTao AS date, 
                    NguyenGia AS value, 
                    NULL AS employee, 
                    NULL AS batch, 
                    'Nhập lẻ thiết bị mới' AS description
                FROM THIETBI
                WHERE MaDot IS NULL OR MaDot = ''
            )
            UNION ALL
            (
                SELECT 
                    cp.ID_TB AS id, 
                    'ALLOCATE' AS type, 
                    tb.TenThietBi AS name, 
                    tb.Loai AS category, 
                    tb.SeriNumber AS seri, 
                    cp.NgayCap AS date, 
                    tb.NguyenGia AS value, 
                    nv.HoTen AS employee, 
                    tb.MaDot AS batch, 
                    CONCAT('Cấp phát cho ', nv.HoTen, ' (', COALESCE(cp.GhiChu, 'Không ghi chú'), ')') AS description
                FROM LICHSUCAPPHAT cp
                JOIN THIETBI tb ON cp.ID_TB = tb.ID_TB
                JOIN NHANVIEN nv ON cp.ID_NV = nv.ID_NV
            )
            UNION ALL
            (
                SELECT 
                    cp.ID_TB AS id, 
                    'RETURN' AS type, 
                    tb.TenThietBi AS name, 
                    tb.Loai AS category, 
                    tb.SeriNumber AS seri, 
                    th.NgayThuHoi AS date, 
                    tb.NguyenGia AS value, 
                    nv.HoTen AS employee, 
                    tb.MaDot AS batch, 
                    CONCAT('Thu hồi từ ', nv.HoTen, ' - Tình trạng: ', COALESCE(th.TinhTrang, 'Tốt'), ' (', COALESCE(th.GhiChu, ''), ')') AS description
                FROM LICHSUTHUHOI th
                JOIN LICHSUCAPPHAT cp ON th.ID_CP = cp.ID_CP
                JOIN THIETBI tb ON cp.ID_TB = tb.ID_TB
                JOIN NHANVIEN nv ON cp.ID_NV = nv.ID_NV
            )
            UNION ALL
            (
                SELECT 
                    ID_TB AS id, 
                    'DISPOSE' AS type, 
                    TenThietBi AS name, 
                    Loai AS category, 
                    SeriNumber AS seri, 
                    NgayThanhLy AS date, 
                    NguyenGia AS value, 
                    NULL AS employee, 
                    MaDotThanhLy AS batch, 
                    CONCAT('Thanh lý thiết bị đợt ', COALESCE(MaDotThanhLy, 'lẻ')) AS description
                FROM THIETBI
                WHERE TrangThai IN ('THANH_LY', 'Thanh lý', 'ThanhLy') AND NgayThanhLy IS NOT NULL
            )
            ORDER BY date DESC
            LIMIT %s
        """
        cursor.execute(query, (limit,))
        rows = cursor.fetchall()
        
        formatted = []
        for r in rows:
            formatted.append({
                "deviceId": r["id"],
                "type": r["type"],
                "name": r["name"],
                "category": r["category"],
                "seri": r["seri"] or "",
                "date": _date_to_text(r["date"]),
                "value": float(r["value"]) if r["value"] is not None else 0.0,
                "employee": r["employee"] or "",
                "batchId": r["batch"] or "",
                "description": r["description"]
            })
        return formatted
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
