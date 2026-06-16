import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DepreciationChart = ({ data, xKey = "label", yKey = "GiaTriConLai" }) => {
  if (!data || data.length === 0) {
    return (
      <div className="depre-empty-chart">
        <span>Chưa có dữ liệu lịch sử khấu hao</span>
      </div>
    );
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
        <defs>
          <linearGradient id="depreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#315a58" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#315a58" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: '#9a948a' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
          tick={{ fontSize: 11, fill: '#9a948a' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(value), "Giá trị còn lại"]}
          contentStyle={{
            background: '#2b2a28',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            padding: '10px 14px',
            color: '#f5f2eb',
            fontSize: '13px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
          labelStyle={{ color: '#9a948a', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}
          cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke="#5ba8a4"
          strokeWidth={2.5}
          fill="url(#depreGradient)"
          dot={{ r: 3.5, fill: '#315a58', stroke: '#5ba8a4', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: '#5ba8a4', stroke: '#2b2a28', strokeWidth: 2.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default DepreciationChart;