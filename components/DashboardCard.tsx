
import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  colorClass: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon, trend, colorClass }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        {trend && <p className="text-xs text-slate-400 mt-2 font-medium">{trend}</p>}
      </div>
      <div className={`p-3 rounded-xl ${colorClass}`}>
        {icon}
      </div>
    </div>
  );
};

export default DashboardCard;
