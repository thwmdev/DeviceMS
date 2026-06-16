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
        
        cursor.execute("SELECT ID_LKH FROM LICHSUKHAUHAO WHERE Nam = %s AND Thang = %s LIMIT 1", (nam, thang))
        if cursor.fetchone():
            return {"status": "skipped", "message": "Tháng này đã tính khấu hao rồi"}

        sql_get_devices = """
            SELECT t.ID_TB, t.NguyenGia, k.PhuongPhapTinh, k.ThoiGianSuDung as CauHinhRieng, 
                   k.GiaTriThuHoi, d.ThoiGianKhauHao as MacDinh
            FROM THIETBI t
            LEFT JOIN KHAUHAO k ON t.ID_TB = k.ID_TB
            JOIN DANHMUCSANPHAM d ON t.ID_DM = d.ID_DM
        """
        cursor.execute(sql_get_devices)
        danh_sach = cursor.fetchall()
        
        for item in danh_sach:
            id_tb = item['ID_TB']
            nguyen_gia = float(item['NguyenGia'])
            
            # Lấy thông tin cấu hình
            so_nam = float(item['CauHinhRieng'] if item['CauHinhRieng'] else item['MacDinh'])
            phuong_phap = item['PhuongPhapTinh'] or 'straight-line'
            gia_tri_thu_hoi = float(item['GiaTriThuHoi'] or 0)
            
            # Tính lũy kế
            cursor.execute("SELECT SUM(GiaTriKhauHaoThang) as LuyKe FROM LICHSUKHAUHAO WHERE ID_TB = %s", (id_tb,))
            luy_ke = float(cursor.fetchone()['LuyKe'] or 0)
            gia_tri_con_lai = nguyen_gia - luy_ke
            
            if gia_tri_con_lai > gia_tri_thu_hoi:
                # Logic tính toán theo phương pháp
                if phuong_phap == 'declining-balance':
                    # Tỷ lệ khấu hao nhanh (2x đường thẳng) chia cho 12 tháng
                    ty_le_thang = (2 / so_nam) / 12
                    khau_hao_thang = gia_tri_con_lai * ty_le_thang
                else:
                    # Phương pháp đường thẳng mặc định
                    khau_hao_thang = (nguyen_gia - gia_tri_thu_hoi) / (so_nam * 12)
                
                # Đảm bảo không khấu hao vượt quá giá trị thu hồi
                thuc_te_ghi = min(khau_hao_thang, gia_tri_con_lai - gia_tri_thu_hoi)
                
                cursor.execute("""
                    INSERT INTO LICHSUKHAUHAO (ID_TB, Nam, Thang, GiaTriKhauHaoThang, GiaTriLuyKe, GiaTriConLai) 
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
        return cursor.fetchone() 
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


def get_depreciation_report():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        sql = """
            SELECT Nam, Thang, SUM(GiaTriKhauHaoThang) as TongKhauHaoThang
            FROM LICHSUKHAUHAO
            GROUP BY Nam, Thang
            ORDER BY Nam DESC, Thang DESC
            LIMIT 12
        """
        cursor.execute(sql)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()