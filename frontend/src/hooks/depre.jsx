import { useState, useCallback } from 'react';
import axios from 'axios';

export const useDepreciation = () => {
    const [devices, setDevices] = useState([]);
    const [formData, setFormData] = useState({ method: "straight-line", usefulLife: 5, residualValue: 0 });
    const token = localStorage.getItem("token");

const fetchDevices = useCallback(async () => {
    const token = localStorage.getItem("token");
    
    if (!token) {
        console.warn("Chưa có token, vui lòng đăng nhập lại!");
        return;
    }

    try {
        const res = await axios.get("http://127.0.0.1:5000/api/device/list?limit=100", { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        setDevices(res.data.data || []);
    } catch (err) { 
        console.error("Lỗi khi tải danh sách thiết bị:", err);
    }
}, []); 

    const calculatePreview = (cost, salvage, life, method) => {
        if (!life || life <= 0) return 0;
        const c = Number(cost), s = Number(salvage), l = Number(life);
        const result = method === "straight-line" ? (c - s) / l : (c * 2) / l;
        return Math.max(0, result);
    };

    const saveConfig = async (maTB, data) => {
        return await axios.post("http://127.0.0.1:5000/api/depreciation", 
            { ...data, MaTB: maTB }, 
            { headers: { Authorization: `Bearer ${token}` } });
    };

    const fetchConfig = async (maTB) => {
        try {
            const res = await axios.get(`http://127.0.0.1:5000/api/depreciation/detail/${maTB}`, 
                { headers: { Authorization: `Bearer ${token}` } });
            if (res.data) setFormData({ method: res.data.PhuongPhapTinh, usefulLife: res.data.ThoiGianSuDung, residualValue: res.data.GiaTriThuHoi });
        } catch { setFormData({ method: "straight-line", usefulLife: 5, residualValue: 0 }); }
    };

    const fetchHistory = async (maTB) => {
    try {
        const res = await axios.get(`http://127.0.0.1:5000/api/depreciation/history/${maTB}`, 
            { headers: { Authorization: `Bearer ${token}` } });
        return res.data || [];
    } catch (err) {
        console.error("Lỗi lấy lịch sử:", err);
        return [];
    }
};

return { devices, formData, setFormData, fetchDevices, calculatePreview, saveConfig, fetchConfig, fetchHistory };

};