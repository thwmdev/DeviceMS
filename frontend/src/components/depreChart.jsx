import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DepreciationChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="Thang" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="TongKhauHaoThang" fill="#8884d8" name="Khấu hao (VNĐ)" />
    </BarChart>
  </ResponsiveContainer>
);

export default DepreciationChart;