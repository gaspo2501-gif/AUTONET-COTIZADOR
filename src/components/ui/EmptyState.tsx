import React from 'react';

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="autonet-card border-dashed px-6 py-14 text-center">
    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">{icon}</div>
    <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
    {description && <p className="text-[13px] text-slate-500 max-w-sm mx-auto mt-1">{description}</p>}
    {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
  </div>
);
