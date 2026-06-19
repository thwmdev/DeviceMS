import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

export default function DeviceDepreChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "14px" }}>
        Chưa có lịch sử khấu hao cho thiết bị này.
      </div>
    );
  }

  const chartData = data.map((item) => ({
    label: `T${item.Thang}/${String(item.Nam).slice(-2)}`,
    conLai: Number(item.GiaTriConLai || 0),
    luyKe: Number(item.GiaTriLuyKe || 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(value),
            name === "conLai" ? "Giá trị còn lại" : "Khấu hao lũy kế",
          ]}
          contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
        />
        <Legend
          formatter={(value) => (value === "conLai" ? "Giá trị còn lại" : "Khấu hao lũy kế")}
          wrapperStyle={{ fontSize: "13px" }}
        />
        <Line
          type="monotone" dataKey="conLai"
          stroke="#ef4444" strokeWidth={2.5}
          dot={{ r: 4, fill: "#ef4444" }} activeDot={{ r: 6 }}
        />
        <Line
          type="monotone" dataKey="luyKe"
          stroke="#10b981" strokeWidth={2.5}
          dot={{ r: 4, fill: "#10b981" }} activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
