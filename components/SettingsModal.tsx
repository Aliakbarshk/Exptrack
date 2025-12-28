
import React, { useState, useRef, useEffect } from 'react';
import { AppTheme, ContractInfo } from '../types';
import { storageService } from '../services/storageService';

interface SettingsModalProps {
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  contract: ContractInfo;
  onUpdateContract: (info: ContractInfo) => void;
  onImport: (expenses: any[], contract: ContractInfo) => void;
  expenses: any[];
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  currentTheme, onThemeChange, contract, onUpdateContract, onImport, expenses, onClose 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('exptrack_custom_api_key') || '');

  const handleExport = () => {
    storageService.exportData(expenses, contract);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('exptrack_custom_api_key', newKey);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await storageService.importData(file);
        onImport(data.expenses, data.contract);
        alert("Site Data Synced.");
      } catch (err) {
        alert("Import failed.");
      }
    }
  };

  const themes: { id: AppTheme, name: string, color: string, desc: string }[] = [
    { id: 'classic', name: 'Premium Classic', color: 'bg-slate-900', desc: 'Sleek business blue.' },
    { id: 'construction', name: 'High-Vis Safety', color: 'bg-yellow-500', desc: 'Vibrant for site use.' },
    { id: 'midnight', name: 'Stealth Black', color: 'bg-indigo-600', desc: 'OLED dark mode.' },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] shadow-3xl max-w-lg w-full border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto scrollbar-hide">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">Site Config</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Project Administration</p>
        </div>
        <button onClick={onClose} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-[2rem] active:scale-90 transition-all">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="space-y-12">
        {/* Site Budget Management */}
        <section className="space-y-6">
          <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-indigo-500 ml-4">Budget Ledger</label>
          <div className="bg-slate-50 dark:bg-slate-800/40 p-10 rounded-[3rem] border space-y-8">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Total Site Value (₹)</label>
              <input 
                type="number"
                value={contract.totalValue}
                onChange={(e) => onUpdateContract({ ...contract, totalValue: Number(e.target.value) })}
                className="w-full bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 font-black text-3xl outline-none focus:border-indigo-500 transition-colors shadow-inner"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Site/Project Name</label>
              <input 
                type="text"
                value={contract.projectName}
                onChange={(e) => onUpdateContract({ ...contract, projectName: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 font-black text-xl outline-none focus:border-indigo-500 transition-colors shadow-inner"
                placeholder="My Site 123"
              />
            </div>
          </div>
        </section>

        {/* API Key Management */}
        <section className="space-y-6">
          <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-blue-500 ml-4">API Configuration</label>
          <div className="bg-slate-50 dark:bg-slate-800/40 p-10 rounded-[3rem] border space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your API Key</p>
            <input 
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              className="w-full bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 font-bold text-sm outline-none focus:border-blue-500 transition-colors shadow-inner"
              placeholder="Paste your key here..."
            />
            <p className="text-[9px] text-slate-400 font-bold leading-relaxed px-1">
              You can type or paste your own key here. If empty, the system will use the default project key.
            </p>
          </div>
        </section>

        {/* Data Sync */}
        <section className="space-y-6">
          <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-emerald-500 ml-4">Data Portability</label>
          <div className="grid grid-cols-2 gap-5">
            <button 
              onClick={handleExport}
              className="flex flex-col items-center justify-center gap-3 p-8 bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-800 rounded-[2.5rem] active:scale-95 transition-all shadow-sm"
            >
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Export PDF</span>
            </button>
            <button 
              onClick={handleImportClick}
              className="flex flex-col items-center justify-center gap-3 p-8 bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-100 dark:border-emerald-800 rounded-[2.5rem] active:scale-95 transition-all shadow-sm"
            >
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Sync Data</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
          </div>
        </section>

        {/* Theme Configuration */}
        <section className="space-y-6">
          <label className="block text-[11px] font-black uppercase tracking-[0.3em] text-amber-500 ml-4">Visual Experience</label>
          <div className="space-y-3">
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => onThemeChange(t.id)}
                className={`w-full flex items-center gap-6 p-6 rounded-[2.5rem] border-2 transition-all text-left ${
                  currentTheme === t.id 
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-900/20' 
                    : 'border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className={`w-14 h-14 rounded-3xl ${t.color} flex-shrink-0 shadow-xl`} />
                <div className="flex-1">
                  <p className="font-black text-lg text-slate-800 dark:text-slate-100 leading-none mb-1">{t.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <button 
          onClick={onClose}
          className="w-full py-8 bg-slate-900 dark:bg-indigo-600 text-white rounded-[3rem] font-black text-2xl shadow-3xl active:scale-[0.98] transition-all"
        >
          Save Site Profile
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;
