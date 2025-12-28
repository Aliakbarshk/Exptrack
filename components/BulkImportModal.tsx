
import React, { useState } from 'react';
import { parseBulkExpenses } from '../services/geminiService';
import { Expense, ExpenseCategory, PaymentType } from '../types';

interface BulkImportModalProps {
  onImport: (expenses: Expense[]) => void;
  onClose: () => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onImport, onClose }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Partial<Expense>[] | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await parseBulkExpenses(text);
      setPreview(parsed);
    } catch (err) {
      setError('AI could not parse this text. Try being more descriptive (e.g., "Paid 5000 to John for POP").');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    const finalExpenses: Expense[] = preview.map(p => ({
      id: crypto.randomUUID(),
      amount: p.amount || 0,
      category: (p.category as ExpenseCategory) || ExpenseCategory.OTHER,
      payee: p.payee || 'Unknown',
      type: (p.type as PaymentType) || PaymentType.PARTIAL,
      notes: p.notes || '',
      date: p.date || new Date().toISOString().split('T')[0]
    }));
    onImport(finalExpenses);
    onClose();
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
      <h2 className="text-2xl font-bold mb-2 text-slate-800">Bulk Paste Expenses</h2>
      <p className="text-slate-500 text-sm mb-6">Paste your notes or messages. AI will extract multiple expenses automatically.</p>
      
      {!preview ? (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <textarea
            className="flex-1 w-full border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            placeholder="Example: Paid 2000 for paint and 1500 to POP worker yesterday. Also gave 5000 advance to electrician today."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2 text-slate-500 font-medium">Cancel</button>
            <button 
              onClick={handleAnalyze} 
              disabled={loading || !text.trim()}
              className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing...
                </>
              ) : 'Analyze Text'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {preview.map((p, i) => (
              <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-blue-600 uppercase">{p.category}</div>
                  <div className="text-sm font-semibold text-slate-800">{p.payee}</div>
                  <div className="text-[10px] text-slate-400">{p.date} • {p.type}</div>
                </div>
                <div className="text-lg font-bold text-slate-900">₹{p.amount?.toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => setPreview(null)} className="flex-1 py-2 text-slate-500 font-medium border border-slate-200 rounded-xl">Back to Edit</button>
            <button onClick={handleConfirm} className="flex-1 bg-green-600 text-white py-2 rounded-xl font-bold hover:bg-green-700">Add All Records</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkImportModal;
