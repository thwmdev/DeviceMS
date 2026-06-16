import { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import Sidebar from "../components/sidebar";
import DepreciationChart from "../components/depreChart";
import "../styles/depre.css";
import { toast } from "react-toastify";

export default function Depreciation() {
  const [reportData, setReportData] = useState([]);
  const [filter, setFilter] = useState({ 
    thang: new Date().getMonth() + 1, 
    nam: new Date().getFullYear() 
  });
  const [loading, setLoading] = useState(false);




const fetchReport = async (thang, nam) => {
  console.log("fetchReport được gọi", thang, nam);

  const token = localStorage.getItem("token");

  try {
    const res = await axios.get(
      `http://127.0.0.1:5000/api/depreciation/report-by-month?thang=${thang}&nam=${nam}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    console.log("=== REPORT DATA ===");
    console.table(res.data);

    setReportData(res.data || []);
  } catch (err) {
    console.error(err);
  }
};

const handleRunDepreciation = async () => {
  try {
    await axios.post(
      "http://127.0.0.1:5000/api/depreciation/run-monthly",
      {
        thang: filter.thang,
        nam: filter.nam
      },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    toast.success("Đã tính khấu hao thành công!");

    await fetchReport(filter.thang, filter.nam);
  } catch (err) {
    console.error(err);

    toast.error(
      err.response?.data?.message ||
      "Không thể tính khấu hao"
    );
  }
};

  ///xuất Excel
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(reportData.map(item => ({
      "Mã TS": item.MaTB,
      "Tên tài sản": item.TenThietBi,
      "Nguyên giá": item.NguyenGia,
      "Khấu hao tháng": item.GiaTriKhauHaoThang,
      "Lũy kế": item.GiaTriLuyKe,
      "Còn lại": item.GiaTriConLai
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao");
    XLSX.writeFile(workbook, `BaoCao_KhauHao_${filter.thang}_${filter.nam}.xlsx`);
  };

  const summary = reportData.reduce((acc, curr) => ({
    nguyenGia: acc.nguyenGia + Number(curr.NguyenGia || 0),
    khauHao: acc.khauHao + Number(curr.GiaTriKhauHaoThang || 0),
    luyKe: acc.luyKe + Number(curr.GiaTriLuyKe || 0),
    conLai: acc.conLai + Number(curr.GiaTriConLai || 0)
  }), { nguyenGia: 0, khauHao: 0, luyKe: 0, conLai: 0 });

  
  
  
  
  const updateDeviceLife = async (maTB, newLife) => {
  try {
    await axios.put(
      `http://127.0.0.1:5000/api/device/update-life/${maTB}`,
      {
        ThoiGianSuDung: newLife
      },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    toast.success("Đã cập nhật!");

    await fetchReport(filter.thang, filter.nam);
  } catch (err) {
    console.error(err);
    toast.error(
      "Lỗi cập nhật: " +
      (err.response?.data?.message || err.message)
    );
  }
};


  useEffect(() => {
    fetchReport(filter.thang, filter.nam);
  }, [filter.thang, filter.nam]);

  const validData = reportData.filter(
  item =>
    item.ThoiGianSuDung !== null &&
    Number(item.GiaTriKhauHaoThang) > 0
);

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px' }}>
        <h1>Khấu hao</h1>
        <div className="filter-card">
        <label>Chọn tháng:</label>
        <select 
          value={filter.thang} 
          onChange={(e) => setFilter({ ...filter, thang: parseInt(e.target.value) })}
        >
          {[...Array(12).keys()].map(i => (
            <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
          ))}
        </select>

        <label>Chọn năm:</label>
        <select 
          value={filter.nam} 
          onChange={(e) => setFilter({ ...filter, nam: parseInt(e.target.value) })}
        >
          {[2024, 2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>



        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div className="card">Nguyên giá: {summary.nguyenGia.toLocaleString('vi-VN')} đ</div>
          <div className="card">KH tháng: {summary.khauHao.toLocaleString('vi-VN')} đ</div>
          <div className="card">Lũy kế: {summary.luyKe.toLocaleString('vi-VN')} đ</div>
          <div className="card">Còn lại: {summary.conLai.toLocaleString('vi-VN')} đ</div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <h3>Biểu đồ khấu hao thiết bị</h3>
          <DepreciationChart
            data={validData.map(item => ({
              ...item,
              GiaTriKhauHaoThang: Number(item.GiaTriKhauHaoThang)
            }))}
            xKey="TenThietBi"
            yKey="GiaTriKhauHaoThang"
          />      
        </div>
        
        <div style={{ marginBottom: '20px', gap: '10px', display: 'flex' }}>
            <button onClick={handleRunDepreciation} className="btn-primary">Chạy khấu hao tháng</button>
            <button onClick={exportToExcel} className="btn-secondary" style={{ padding: '12px 24px', cursor: 'pointer' }}>Xuất Excel</button>
        </div>

        <table className="depreciation-table">
          <thead>
          <tr>
            <th>Mã TS</th>
            <th>Tên TS</th>
            <th>Nguyên giá</th>
            <th>TG sử dụng</th>
            <th>KH tháng</th>
            <th>Lũy kế</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
          <tbody>
          {reportData.map((item) => (
            <tr key={item.MaTB}>
              <td>TB{String(item.MaTB).padStart(3, "0")}</td>
              <td>{item.TenThietBi}</td>
              <td>{Number(item.NguyenGia || 0).toLocaleString("vi-VN")} đ</td>

              <td>
                <input
                  type="number"
                  defaultValue={item.ThoiGianSuDung || ""}
                  min="1"
                  onBlur={(e) =>
                    updateDeviceLife(item.MaTB, Number(e.target.value))
                  }
                  style={{ width: "70px" }}
                />
                {" "}năm
              </td>

              <td>
                {Number(item.GiaTriKhauHaoThang || 0).toLocaleString("vi-VN")} đ
              </td>

              <td>
                {Number(item.GiaTriLuyKe || 0).toLocaleString("vi-VN")} đ
              </td>

              <td>
                {item.TrangThai || "Không xác định"}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </main>
    </div>
  );
}