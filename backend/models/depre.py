from database.db import get_connection
import datetime

def save_depreciation(data):
    """Lưu hoặc cập nhật cấu hình khấu hao cho thiết bị."""
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
        
        # 2. Kiểm tra tính hợp lệ
        if float(data['residualValue']) >= float(nguyen_gia):
            raise ValueError("Giá trị thu hồi phải nhỏ hơn nguyên giá.")

        # 3. Lưu dữ liệu với cơ chế ON DUPLICATE KEY UPDATE
        sql = """
            INSERT INTO KHAUHAO (ID_TB, PhuongPhapTinh, ThoiGianSuDung, GiaTriThuHoi, GiaTriBanDau, NgayBatDau)
            VALUES (%s, %s, %s, %s, %s, CURDATE())
            ON DUPLICATE KEY UPDATE 
                PhuongPhapTinh = VALUES(PhuongPhapTinh),
                ThoiGianSuDung = VALUES(ThoiGianSuDung),
                GiaTriThuHoi = VALUES(GiaTriThuHoi),
                GiaTriBanDau = VALUES(GiaTriBanDau)
        """
        cursor.execute(sql, (data['MaTB'], data['method'], data['usefulLife'], data['residualValue'], nguyen_gia))
        conn.commit()
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        


def caculate_depre():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        now = datetime.datetime.now()
        nam, thang = now.year, now.month
        
        cursor.execute("SELECT ID_LKH FROM LICH_SU_KHAU_HAO WHERE Nam = %s AND Thang = %s LIMIT 1", (nam, thang))
        if cursor.fetchone():
            return {"status": "skipped", "message": "Tháng này đã tính khấu hao rồi"}

        cursor.execute("SELECT * FROM KHAUHAO")
        danh_sach = cursor.fetchall()
        
        for item in danh_sach:
            id_tb = item['ID_TB']
            nguyen_gia = float(item['GiaTriBanDau'])
            thu_hoi = float(item['GiaTriThuHoi'])
            tong_gia_tri_khau_hao = nguyen_gia - thu_hoi
            thoi_gian_thang = int(item['ThoiGianSuDung']) * 12
            
    #mỗi tháng
            khau_hao_thang_chuan = tong_gia_tri_khau_hao / thoi_gian_thang
            
            cursor.execute("SELECT SUM(GiaTriKhauHaoThang) as LuyKe FROM LICH_SU_KHAU_HAO WHERE ID_TB = %s", (id_tb,))
            luy_ke = float(cursor.fetchone()['LuyKe'] or 0)
            

 #còn lại phải khấu hao
            con_lai_can_khau_hao = tong_gia_tri_khau_hao - luy_ke
            
            if con_lai_can_khau_hao > 0:
        #phần nhỏ hơn giữa khấu hao tháng và phần còn lại
                thuc_te_ghi = min(khau_hao_thang_chuan, con_lai_can_khau_hao)
                
                cursor.execute("""
                    INSERT INTO LICH_SU_KHAU_HAO (ID_TB, Nam, Thang, GiaTriKhauHaoThang, GiaTriLuyKe, GiaTriConLai) 
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (id_tb, nam, thang, thuc_te_ghi, luy_ke + thuc_te_ghi, nguyen_gia - (luy_ke + thuc_te_ghi)))
        
        conn.commit()
        return {"status": "success"}
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
        sql = "SELECT * FROM KHAUHAO WHERE ID_TB = %s"
        cursor.execute(sql, (ma_tb,))
        return cursor.fetchone() # Trả về thông tin cấu hình hoặc None nếu chưa có
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


def get_depreciation_report():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        sql = """
            SELECT Nam, Thang, SUM(GiaTriKhauHaoThang) as TongKhauHaoThang
            FROM LICH_SU_KHAU_HAO
            GROUP BY Nam, Thang
            ORDER BY Nam DESC, Thang DESC
            LIMIT 12
        """
        cursor.execute(sql)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()