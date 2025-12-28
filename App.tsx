
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, AreaChart, Area } from 'recharts';
import { GoogleGenAI, Modality } from '@google/genai';
import { Expense, PaymentType, ExpenseCategory, AppTheme, ContractInfo } from './types';
import { storageService } from './services/storageService';
import { getAIInsights } from './services/geminiService';
import { addExpenseFunctionDeclaration, encode, decode, decodeAudioData } from './services/liveService';
import ExpenseForm from './components/ExpenseForm';
import SettingsModal from './components/SettingsModal';
import BulkImportModal from './components/BulkImportModal';

const App: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contract, setContract] = useState<ContractInfo>(() => storageService.getContract());
  const [activeTab, setActiveTab] = useState<'home' | 'ledger' | 'advances' | 'insights' | 'setup'>('home');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('');
  
  const [theme, setTheme] = useState<AppTheme>(() => localStorage.getItem('exptrack_theme') as AppTheme || 'classic');
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    const savedExpenses = storageService.getExpenses();
    setExpenses(savedExpenses);
    setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, []);

  useEffect(() => {
    storageService.saveExpenses(expenses);
    storageService.saveContract(contract);
    setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [expenses, contract]);

  useEffect(() => {
    localStorage.setItem('exptrack_theme', theme);
    if (theme === 'midnight') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleAddExpense = (newExpense: Omit<Expense, 'id'>) => {
    const expenseWithId: Expense = { ...newExpense, id: crypto.randomUUID() };
    setExpenses(prev => [expenseWithId, ...prev]);
    setIsFormOpen(false);
  };

  const handleBulkImport = (newExpenses: Expense[]) => {
    setExpenses(prev => [...newExpenses, ...prev]);
    setIsBulkOpen(false);
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('Permanently delete this entry?')) {
      setExpenses(prev => prev.filter(e => e.id !== id));
    }
  };

  const startLiveAssistant = async () => {
    try {
      setLiveStatus('connecting');
      setIsLiveOpen(true);
      
      const customKey = localStorage.getItem('exptrack_custom_api_key');
      const apiKey = customKey || process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey as string });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await inputCtx.resume();
      await outputCtx.resume();
      
      audioContextRef.current = { input: inputCtx, output: outputCtx };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }, 
          },
          tools: [{ functionDeclarations: [addExpenseFunctionDeclaration] }],
          systemInstruction: `You are 'Saathi', an expert construction site manager.
          Project: ${contract.projectName}. Total Budget: ₹${contract.totalValue}.
          Current Spent: ₹${stats.total}.
          
          Guidelines:
          - Support Boss in recording expenses quickly via voice.
          - Handle construction slang like 'Hazri' (Labor), 'Advance' (Advance), 'Saria/Cement' (Material).
          - Be concise. After logging, briefly confirm: "Noted sir, ₹[amount] [payee] ke liye. Balance ₹[remaining] bacha hai."
          - Speak in professional site Hinglish.`,
        },
        callbacks: {
          onopen: () => {
            setLiveStatus('active');
            setIsLiveActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message) => {
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputCtx) {
              setIsAiSpeaking(true);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              activeSourcesRef.current.add(source);
              source.onended = () => {
                activeSourcesRef.current.delete(source);
                if (activeSourcesRef.current.size === 0) setIsAiSpeaking(false);
              };
            }
            if (message.serverContent?.inputTranscription) {
              setUserTranscript(message.serverContent.inputTranscription.text);
            }
            if (message.serverContent?.outputTranscription) {
              setAiTranscript(message.serverContent.outputTranscription.text);
            }
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'addExpense') {
                  const args = fc.args as any;
                  handleAddExpense({
                    amount: args.amount,
                    category: args.category as ExpenseCategory,
                    payee: args.payee,
                    type: args.type as PaymentType || PaymentType.PARTIAL,
                    notes: args.notes || '',
                    date: args.date || new Date().toISOString().split('T')[0],
                  });
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: 'Logged in site ledger.' } }
                  }));
                }
              }
            }
          },
          onclose: () => { setLiveStatus('idle'); setIsLiveActive(false); setIsAiSpeaking(false); },
          onerror: () => { setLiveStatus('error'); },
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setLiveStatus('error');
    }
  };

  const stopLiveAssistant = () => {
    if (sessionRef.current) sessionRef.current.close();
    if (audioContextRef.current) {
      audioContextRef.current.input.close();
      audioContextRef.current.output.close();
    }
    setIsLiveActive(false);
    setIsLiveOpen(false);
    setLiveStatus('idle');
  };

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const advances = expenses.filter(e => e.type === PaymentType.ADVANCE).reduce((sum, e) => sum + e.amount, 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTotal = expenses.filter(e => e.date === todayStr).reduce((sum, e) => sum + e.amount, 0);
    
    // Category Breakdown
    const catMap: Record<string, number> = {};
    expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    // Weekly Trend
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    
    const trendData = last7Days.map(date => ({
      date: date.split('-').slice(1).join('/'),
      amount: expenses.filter(e => e.date === date).reduce((s, e) => s + e.amount, 0)
    }));

    const progress = contract.totalValue > 0 ? (total / contract.totalValue) * 100 : 0;
    
    return { total, advances, todayTotal, pieData, trendData, progress };
  }, [expenses, contract]);

  const fetchInsights = async () => {
    if (expenses.length === 0) return;
    setLoadingAI(true);
    try {
      const insight = await getAIInsights(expenses);
      setAiInsight(insight);
    } catch (err) {
      setAiInsight("Unable to connect to auditor.");
    } finally {
      setLoadingAI(false);
    }
  };

  const themeConfig = {
    classic: { bg: 'bg-[#F1F5F9]', card: 'bg-white border-slate-200', accent: 'bg-[#0F172A]', text: 'text-slate-900', secondary: 'text-slate-500' },
    construction: { bg: 'bg-[#FFFBEB]', card: 'bg-white border-yellow-500 border-2', accent: 'bg-slate-900', text: 'text-slate-900', secondary: 'text-slate-600' },
    midnight: { bg: 'bg-[#020617]', card: 'bg-[#0F172A] border-slate-800', accent: 'bg-[#6366F1]', text: 'text-white', secondary: 'text-slate-400' },
  }[theme];

  return (
    <div className={`min-h-screen transition-all duration-500 pb-36 ${themeConfig.bg} ${themeConfig.text}`}>
      {/* Dynamic Site Header */}
      <header className={`sticky top-0 z-40 border-b px-6 py-6 backdrop-blur-2xl ${theme === 'midnight' ? 'bg-black/70 border-slate-800' : 'bg-white/70 border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-[1.5rem] ${themeConfig.accent} flex items-center justify-center text-white shadow-2xl rotate-3`}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black tracking-tighter uppercase leading-none italic">ExpTrack</h1>
              <span className={`text-[10px] font-black uppercase tracking-[0.3em] mt-1.5 ${themeConfig.secondary}`}>{contract.projectName || 'Site Master'}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsBulkOpen(true)} className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg active:scale-90 transition-transform flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="hidden sm:inline font-bold text-xs uppercase">Bulk Add</span>
            </button>
            <button onClick={() => setIsFormOpen(true)} className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg active:scale-90 transition-transform">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        {activeTab === 'home' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
            {/* Project Burn Controller */}
            <div className={`${themeConfig.card} p-10 rounded-[3.5rem] border shadow-2xl relative overflow-hidden`}>
              <div className={`absolute top-0 right-0 w-80 h-80 ${theme === 'midnight' ? 'bg-indigo-500/10' : 'bg-blue-500/5'} rounded-full blur-[80px] -translate-y-20 translate-x-20`} />
              
              <div className="relative z-10 space-y-10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-[11px] font-black uppercase tracking-[0.4em] mb-2 ${themeConfig.secondary}`}>Site Budget Burn</p>
                    <h3 className="text-6xl font-black tracking-tight">₹{stats.total.toLocaleString()}</h3>
                  </div>
                  <div className="text-right">
                    <p className={`text-[11px] font-black uppercase tracking-[0.4em] mb-2 ${themeConfig.secondary}`}>Contract</p>
                    <h4 className="text-2xl font-black text-indigo-500">₹{contract.totalValue.toLocaleString()}</h4>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="w-full h-6 bg-slate-100 dark:bg-white/5 rounded-3xl overflow-hidden p-1.5 shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-600 via-blue-500 to-emerald-400 rounded-2xl transition-all duration-1000 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                      style={{ width: `${Math.min(stats.progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest px-1">
                    <span className={themeConfig.secondary}>{Math.round(stats.progress)}% Consumed</span>
                    <span className="text-emerald-500">₹{(contract.totalValue - stats.total).toLocaleString()} Cash Left</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub Metrics */}
            <div className="grid grid-cols-2 gap-5">
              <div className={`${themeConfig.card} p-8 rounded-[3rem] border shadow-xl flex flex-col gap-2`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${themeConfig.secondary}`}>Site Advances</p>
                <h4 className="text-3xl font-black text-amber-500">₹{stats.advances.toLocaleString()}</h4>
              </div>
              <div className={`${themeConfig.card} p-8 rounded-[3rem] border shadow-xl flex flex-col gap-2`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${themeConfig.secondary}`}>Today's Spend</p>
                <h4 className="text-3xl font-black text-indigo-500">₹{stats.todayTotal.toLocaleString()}</h4>
              </div>
            </div>

            {/* AI Saathi Visual Quick-Trigger */}
            <button 
              onClick={startLiveAssistant}
              className="w-full p-10 bg-slate-900 dark:bg-indigo-600 rounded-[3.5rem] flex items-center gap-8 text-white shadow-3xl active:scale-[0.98] transition-all group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-20 h-20 bg-white/10 rounded-[2.5rem] flex items-center justify-center backdrop-blur-2xl group-hover:scale-110 transition-transform">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m8 0h-3m1-4V5a2 2 0 10-4 0v10a2 2 0 104 0z" /></svg>
              </div>
              <div className="text-left flex-1">
                <h4 className="text-3xl font-black tracking-tighter">Talk to Saathi</h4>
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest mt-1">Real-time Voice Logging</p>
              </div>
            </button>

            {/* Allocation Chart */}
            <div className={`${themeConfig.card} p-10 rounded-[3.5rem] border shadow-xl`}>
               <h3 className="text-xs font-black uppercase tracking-[0.4em] mb-12 text-indigo-500">Site Fund Allocation</h3>
               <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={stats.pieData} 
                        innerRadius={70} 
                        outerRadius={100} 
                        paddingAngle={8} 
                        dataKey="value"
                        animationDuration={1500}
                      >
                        {stats.pieData.map((_, i) => (
                          <Cell key={i} fill={['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i % 6]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800 }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="grid grid-cols-2 gap-4 mt-8">
                  {stats.pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i % 6] }} />
                      <span className="text-[10px] font-black uppercase tracking-tighter truncate opacity-70">{d.name}</span>
                    </div>
                  ))}
               </div>
            </div>

            {/* Spending Trend */}
            <div className={`${themeConfig.card} p-10 rounded-[3.5rem] border shadow-xl`}>
               <h3 className="text-xs font-black uppercase tracking-[0.4em] mb-12 text-indigo-500">7-Day Burn Trend</h3>
               <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.trendData}>
                      <defs>
                        <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} fontWeight={900} tick={{fill: '#94a3b8'}} />
                      <Tooltip contentStyle={{ borderRadius: '20px', fontWeight: 900 }} />
                      <Area type="monotone" dataKey="amount" stroke="#6366F1" strokeWidth={4} fillOpacity={1} fill="url(#colorAmt)" />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="space-y-8 animate-in slide-in-from-right-10 duration-700">
            <h2 className="text-4xl font-black tracking-tighter uppercase leading-none italic">Full Site Ledger</h2>
            {expenses.length === 0 ? (
              <div className="py-48 text-center opacity-10 font-black tracking-[0.5em] text-xl uppercase italic">No Transactions</div>
            ) : (
              <div className="space-y-4">
                {expenses.map((expense) => (
                  <div key={expense.id} className={`${themeConfig.card} p-8 rounded-[2.5rem] border flex items-center justify-between active:scale-[0.98] transition-all group shadow-sm hover:shadow-2xl`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`text-[9px] font-black uppercase tracking-tighter px-3 py-1 rounded-xl ${expense.type === PaymentType.ADVANCE ? 'bg-amber-500 text-white' : 'bg-indigo-500/10 text-indigo-600'}`}>
                          {expense.type}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{expense.date}</span>
                      </div>
                      <p className="font-black text-2xl tracking-tight leading-none mb-1">{expense.payee}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/60">{expense.category}</p>
                    </div>
                    <div className="text-right flex items-center gap-8">
                      <p className="text-3xl font-black tracking-tighter">₹{expense.amount.toLocaleString()}</p>
                      <button onClick={() => handleDeleteExpense(expense.id)} className="p-4 text-red-500/10 hover:text-red-500 transition-all rounded-[1.5rem] hover:bg-red-50">
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7M10 11v6m4-6v6" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'advances' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
            <h2 className="text-4xl font-black tracking-tighter uppercase leading-none italic">Site Advances</h2>
            <div className={`${themeConfig.card} p-8 rounded-[3rem] border shadow-xl bg-gradient-to-br from-amber-500/5 to-transparent mb-10`}>
               <p className="text-[11px] font-black uppercase tracking-[0.4em] mb-3 text-amber-600">Total Credit Extended</p>
               <h3 className="text-5xl font-black tracking-tighter text-amber-500">₹{stats.advances.toLocaleString()}</h3>
            </div>
            
            <div className="space-y-4">
               {expenses.filter(e => e.type === PaymentType.ADVANCE).map(expense => (
                 <div key={expense.id} className={`${themeConfig.card} p-8 rounded-[2.5rem] border border-amber-500/20 flex items-center justify-between shadow-sm`}>
                    <div>
                      <p className="font-black text-2xl tracking-tight mb-1">{expense.payee}</p>
                      <p className="text-[10px] font-black uppercase text-slate-400">{expense.date} • {expense.category}</p>
                    </div>
                    <p className="text-3xl font-black text-amber-500">₹{expense.amount.toLocaleString()}</p>
                 </div>
               ))}
               {expenses.filter(e => e.type === PaymentType.ADVANCE).length === 0 && (
                 <div className="py-40 text-center opacity-10 font-black tracking-widest text-lg uppercase">Zero Advances</div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-8 animate-in slide-in-from-left-10 duration-700">
             <h2 className="text-4xl font-black tracking-tighter uppercase leading-none italic">Site Audit</h2>
             <div className={`p-10 rounded-[4rem] ${theme === 'midnight' ? 'bg-indigo-600/5 border-indigo-500/20' : 'bg-indigo-500/5 border-indigo-100'} border-2`}>
                <div className="flex items-center gap-8 mb-16">
                   <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-3xl -rotate-6">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                   </div>
                   <div>
                      <h4 className="text-3xl font-black tracking-tighter">Saathi Pro Auditor</h4>
                      <p className={`text-[11px] font-black uppercase tracking-[0.5em] ${themeConfig.secondary}`}>Site Financial Intelligence</p>
                   </div>
                </div>
                
                <div className={`p-10 rounded-[3.5rem] ${theme === 'midnight' ? 'bg-black/40' : 'bg-white'} border shadow-inner min-h-[400px]`}>
                   {aiInsight ? (
                     <div className="prose prose-sm dark:prose-invert">
                        <p className="text-xl font-bold leading-relaxed whitespace-pre-line text-slate-800 dark:text-slate-100">{aiInsight}</p>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center h-full text-center py-20 gap-12">
                        <div className="w-28 h-28 bg-slate-50 dark:bg-white/5 rounded-[3.5rem] flex items-center justify-center animate-pulse">
                           <svg className="w-14 h-14 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p className={`text-sm font-black uppercase tracking-[0.2em] ${themeConfig.secondary}`}>Ready to audit project burn rates.</p>
                        <button onClick={fetchInsights} disabled={loadingAI} className="w-full max-w-sm py-7 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-3xl active:scale-95 transition-all">
                           {loadingAI ? 'Auditing Project...' : 'Run Site Analysis'}
                        </button>
                     </div>
                   )}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <SettingsModal 
            currentTheme={theme} 
            onThemeChange={setTheme} 
            contract={contract}
            onUpdateContract={setContract}
            onClose={() => setActiveTab('home')}
            expenses={expenses}
            onImport={(exps, ctr) => { setExpenses(exps); setContract(ctr); }}
          />
        )}
      </main>

      {/* Modern High-Vis Bottom Nav */}
      <nav className={`fixed bottom-0 left-0 right-0 h-32 border-t px-8 pb-10 backdrop-blur-3xl z-50 flex items-center justify-between ${theme === 'midnight' ? 'bg-black/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'home' ? (theme === 'midnight' ? 'text-white scale-110' : 'text-slate-900 scale-110') : 'text-slate-400'}`}>
           <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'home' ? 3.5 : 2}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
           <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
        </button>
        <button onClick={() => setActiveTab('ledger')} className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'ledger' ? (theme === 'midnight' ? 'text-white scale-110' : 'text-slate-900 scale-110') : 'text-slate-400'}`}>
           <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'ledger' ? 3.5 : 2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           <span className="text-[10px] font-black uppercase tracking-widest">Ledger</span>
        </button>

        <button onClick={() => setActiveTab('advances')} className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'advances' ? (theme === 'midnight' ? 'text-white scale-110' : 'text-slate-900 scale-110') : 'text-slate-400'}`}>
           <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'advances' ? 3.5 : 2}><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.407 2.626 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.407-2.626-1M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
           <span className="text-[10px] font-black uppercase tracking-widest">Advance</span>
        </button>

        <button onClick={() => setActiveTab('insights')} className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'insights' ? (theme === 'midnight' ? 'text-white scale-110' : 'text-slate-900 scale-110') : 'text-slate-400'}`}>
           <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'insights' ? 3.5 : 2}><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
           <span className="text-[10px] font-black uppercase tracking-widest">Insights</span>
        </button>
        <button onClick={() => setActiveTab('setup')} className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'setup' ? (theme === 'midnight' ? 'text-white scale-110' : 'text-slate-900 scale-110') : 'text-slate-400'}`}>
           <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'setup' ? 3.5 : 2}><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m12 0a2 2 0 100-4m0 4a2 2 0 110-4" /></svg>
           <span className="text-[10px] font-black uppercase tracking-widest">Setup</span>
        </button>
      </nav>

      {/* Voice Assistant Overlay - Fluid Waveform UI */}
      {isLiveOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 bg-slate-950/98 backdrop-blur-[100px] animate-in fade-in duration-1000">
           <div className="w-full max-w-sm flex flex-col items-center gap-16">
              <div className="relative flex items-center justify-center">
                 <div className={`absolute w-[400px] h-[400px] rounded-full transition-all duration-1000 blur-[120px] ${isAiSpeaking ? 'bg-indigo-500/30 scale-125' : 'bg-blue-500/10 scale-100'}`} />
                 
                 <div className={`w-72 h-72 rounded-[6rem] flex items-center justify-center transition-all duration-700 z-10 shadow-3xl ${isAiSpeaking ? 'bg-indigo-600 rotate-[45deg] scale-110' : 'bg-slate-900 rotate-0'}`}>
                    <div className="flex items-center gap-5 h-28 -rotate-[45deg]">
                       {[...Array(10)].map((_, i) => (
                         <div 
                          key={i} 
                          className={`w-4 bg-white rounded-full transition-all duration-200 ${isAiSpeaking ? 'opacity-100' : 'opacity-20'}`} 
                          style={{ 
                            height: isAiSpeaking ? `${20 + (Math.random() * 80)}%` : '15px', 
                            animationDelay: `${i * 0.05}s`,
                            animation: isAiSpeaking ? 'pulse 0.5s infinite alternate' : 'none'
                          }} 
                         />
                       ))}
                    </div>
                 </div>
              </div>

              <div className="text-center space-y-5">
                 <h2 className="text-6xl font-black text-white tracking-tighter italic uppercase">Saathi</h2>
                 <p className="text-xs font-black text-white/40 uppercase tracking-[0.5em]">{liveStatus === 'active' ? (isAiSpeaking ? 'Responding...' : 'Listening Boss') : 'Syncing Link...'}</p>
              </div>

              <div className="w-full bg-white/[0.04] p-12 rounded-[5rem] border border-white/10 shadow-3xl backdrop-blur-3xl">
                 <div className="space-y-8">
                    <div className="space-y-3">
                       <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Boss Word:</p>
                       <p className="text-white font-bold text-2xl leading-tight">{userTranscript || "..."}</p>
                    </div>
                    <div className="w-full h-px bg-white/10" />
                    <div className="space-y-3">
                       <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Site Feedback:</p>
                       <p className="text-indigo-50 text-3xl font-black tracking-tighter leading-tight italic">{aiTranscript || "Hukum karein sir."}</p>
                    </div>
                 </div>
              </div>

              <button onClick={stopLiveAssistant} className="w-28 h-28 rounded-[5rem] bg-red-500 text-white flex items-center justify-center shadow-[0_0_80px_rgba(239,68,68,0.5)] active:scale-90 transition-all hover:bg-red-600 hover:scale-110">
                 <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
           </div>
        </div>
      )}

      {/* Manual Entry Modals */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-3xl bg-slate-900/40">
          <div className="animate-in zoom-in-95 duration-300 w-full max-w-md">
            <ExpenseForm onSubmit={handleAddExpense} onCancel={() => setIsFormOpen(false)} />
          </div>
        </div>
      )}

      {/* Bulk Entry Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-3xl bg-slate-900/40">
          <div className="animate-in zoom-in-95 duration-300 w-full max-w-2xl">
            <BulkImportModal onImport={handleBulkImport} onClose={() => setIsBulkOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
