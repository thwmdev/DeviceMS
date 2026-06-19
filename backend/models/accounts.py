from sqlalchemy import Column, Integer, String
from database.db import Base

from models.accM import (
    get_all_accounts,
    create_account_db,
    update_account_db,
    toggle_account_status_db
)

class TaiKhoan(Base):
    __tablename__ = "TAIKHOAN"

    ID_TK = Column(Integer, primary_key=True, autoincrement=True)
    ID_NV = Column(Integer, ForeignKey("NHANVIEN.ID_NV"), unique=True, nullable=False)
    TenDangNhap = Column(String(50), unique=True, nullable=False)
    MatKhau = Column(String(255), nullable=False)
    VaiTro = Column(String(20), nullable=False)
    TrangThai = Column(String(20), default='HoatDong')
    NgayTao = Column(DateTime, server_default=func.now())