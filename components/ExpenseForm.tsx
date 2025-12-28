
import React, { useState } from 'react';
import { ExpenseCategory, PaymentType, Expense } from '../types';

interface ExpenseFormProps {
  onSubmit: (expense: Omit<Expense, 'id'>) => void;
  onCancel: () => void;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    amount: '',
    category: ExpenseCategory.OTHER,
    payee: '',
    type: PaymentType.PARTIAL,
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.payee) return;
    
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      category: formData.category as ExpenseCategory,
      type: formData.type as PaymentType,
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl max-w-lg w-full">
      <h2 className="text-xl font-bold mb-6 text-slate-800">New Construction Expense</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
            <input
              type="number"
              required
              className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              required
              className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select
            className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
          >
            {Object.values(ExpenseCategory).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Paid To / Vendor Name</label>
          <input
            type="text"
            required
            className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.payee}
            onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
            placeholder="e.g. Electrician Sharma, Paints Store"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
          <div className="flex gap-2 flex-wrap">
            {Object.values(PaymentType).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, type })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  formData.type === type 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Description</label>
          <textarea
            className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Details of materials or specific work done..."
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Add Expense
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseForm;
