import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DepreciationChart = ({ data, xKey = "Thang", yKey = "TongKhauHaoThang" }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        Chưa có dữ liệu khấu hao
      </div>
    );
  }




  const formatCurrency = (value) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey={xKey} 
          tick={{ fontSize: 12 }} 
        />
        <YAxis 
          tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} 
          tick={{ fontSize: 12 }} 
        />
        <Tooltip 
          formatter={(value) => [formatCurrency(value), "Khấu hao"]}
          cursor={{ fill: '#f0f0f0' }}
        />
        <Bar dataKey={yKey} fill="#2563eb" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#2563eb" : "#60a5fa"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default DepreciationChart;