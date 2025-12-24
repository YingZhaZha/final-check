
import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { CHECKLIST_DATA, INSPECTOR_REQUIREMENTS } from './constants';
import { AppState, ChecklistSession, CheckEntry, SectionConfig } from './types';
import { CheckItem } from './components/CheckItem';
import { generatePDF } from './utils/pdfGenerator';
import SignatureCanvas from 'react-signature-canvas';
import html2canvas from 'html2canvas';
import Webcam from 'react-webcam';
import { 
  Plane, User, Calendar, ChevronRight, CheckCircle2, 
  AlertTriangle, RotateCcw, PenTool, Camera, Download, LayoutList, Share2, FileCheck, Edit2, X, Trash2, Wand2, Undo2, Smartphone, RotateCw, ArrowLeft, ClipboardList, RefreshCw, History, ShieldCheck, Wrench, Send, Star
} from 'lucide-react';
import { format } from 'date-fns';

const waitForImages = (element: HTMLElement) => {
    const imgs = element.querySelectorAll('img');
    return Promise.all(Array.from(imgs).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        });
    }));
};

const cleanText = (text: string) => {
  return text.replace(/[\(（][^\)）]*[\)）]/g, '').trim();
};

const HIGHLIGHT_RED_IDS = ['2_7', '2_8', '2_14', '2_15', '2_16', '2_25', '2_26'];

const REPORT_REQUIREMENTS = [
  "1、由相应飞机行业负责人及L3授权人员施行。",
  "2、必须在交机前半天执行最终检查工作并且临交机前再进行一次客货仓FOD 检查。",
  "3、必须严格按照步骤逐项检查确认！",
  "4、涉及门上工作，必须双人互检！"
];

const APP_VERSION = 'v3.2.0';

const CHANGELOGS = [
  {
    version: 'v3.2.0',
    date: format(new Date(), 'yyyy-MM-dd'),
    changes: [
      '新增：回顾功能 (星标)，归入缺陷栏',
      '优化：术语统一为“缺陷”',
      '优化：整改界面图片支持原图预览',
      '优化：报告时间戳颜色变淡，图片比例保持'
    ]
  },
  {
    version: 'v3.1.0',
    date: '2025-06-05',
    changes: [
      '新增：缺陷记录与整改流程分离',
      '新增：历史记录支持多次整改',
      '新增：问题列表批量分享功能',
      '优化：整改界面操作体验'
    ]
  }
];

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('checklist_v2_state');
    const defaultState = {
      step: 'welcome' as const,
      info: { registration: '', inspectorName: '', date: format(new Date(), 'yyyy-MM-dd') },
      session: {},
      signature: null,
      selfie: null,
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
             ...defaultState,
             ...parsed,
             info: { ...defaultState.info, ...parsed.info }
        };
      } catch (e) {
        console.error("Failed to parse state", e);
      }
    }
    return defaultState;
  });

  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'flagged'>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<File | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSignatureOverlay, setShowSignatureOverlay] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  
  const [autoCheckedIds, setAutoCheckedIds] = useState<string[]>([]);
  
  const sigPadRef = useRef<SignatureCanvas>(null);
  const sigContainerRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<Webcam>(null);
  
  const printRef = useRef<HTMLDivElement>(null);
  const reportHeaderRef = useRef<HTMLDivElement>(null); 
  const allIssuesExportRef = useRef<HTMLDivElement>(null); 
  const issuesRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number | null>(null);

  const isAdmin = state.info.inspectorName === '802711';

  useEffect(() => {
    window.history.replaceState({ step: state.step }, '', '');

    const handlePopState = (event: PopStateEvent) => {
      if (showSignatureOverlay) {
        setShowSignatureOverlay(false);
        window.history.pushState({ step: state.step }, '', '');
        return;
      }
      if (generatedFile) {
        setGeneratedFile(null);
        window.history.pushState({ step: state.step }, '', '');
        return;
      }
      if (event.state?.step) {
        setState(prev => ({ ...prev, step: event.state.step }));
      } else {
        setState(prev => ({ ...prev, step: 'welcome' }));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showSignatureOverlay, generatedFile, state.step]);

  useLayoutEffect(() => {
    if (showSignatureOverlay && sigPadRef.current && sigContainerRef.current) {
      const canvas = sigPadRef.current.getCanvas();
      const container = sigContainerRef.current;
      const timer = setTimeout(() => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = container.offsetWidth * ratio;
        canvas.height = container.offsetHeight * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        sigPadRef.current?.clear();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showSignatureOverlay]);

  const setStep = (newStep: AppState['step']) => {
    if (state.step !== newStep) {
      window.history.pushState({ step: newStep }, '', '');
      setState(prev => ({ ...prev, step: newStep }));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;
    const threshold = 60;
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        if (filterMode === 'all') setFilterMode('pending');
        else if (filterMode === 'pending') setFilterMode('flagged');
      } else {
        if (filterMode === 'flagged') setFilterMode('pending');
        else if (filterMode === 'pending') setFilterMode('all');
      }
    }
    touchStartRef.current = null;
  };

  useEffect(() => {
    localStorage.setItem('checklist_v2_state', JSON.stringify(state));
  }, [state]);

  const updateSession = (uniqueId: string, updates: Partial<CheckEntry>) => {
    setState(prev => ({
      ...prev,
      session: {
        ...prev.session,
        [uniqueId]: { ...(prev.session[uniqueId] || { status: 'unchecked', photos: [] }), ...updates }
      }
    }));
  };

  const handleConfirmReset = () => {
     setState({
         step: 'welcome',
         info: { registration: '', inspectorName: '', date: format(new Date(), 'yyyy-MM-dd') },
         session: {},
         signature: null,
         selfie: null,
     });
     localStorage.removeItem('checklist_v2_state');
     setGeneratedFile(null);
     setFilterMode('all');
     setAutoCheckedIds([]);
     setShowResetConfirm(false);
     window.scrollTo(0, 0);
  };

  const toggleAutoCheck = () => {
    if (autoCheckedIds.length > 0) {
      const newSession = { ...state.session };
      autoCheckedIds.forEach(id => {
        if (newSession[id]?.status === 'ok') {
          newSession[id] = { ...newSession[id], status: 'unchecked', timestamp: null };
        }
      });
      setState(prev => ({ ...prev, session: newSession }));
      setAutoCheckedIds([]);
    } else {
      const newAutoChecked: string[] = [];
      const newSession = { ...state.session };
      const timestamp = new Date().toISOString();
      CHECKLIST_DATA.forEach(section => {
        section.items.forEach(item => {
          if (item.type === 'simple') {
            if (!newSession[item.id] || newSession[item.id].status === 'unchecked') {
               newSession[item.id] = { ...(newSession[item.id] || { photos: [] }), status: 'ok', timestamp };
               newAutoChecked.push(item.id);
            }
          } else {
            item.subItems?.forEach(sub => {
              const uid = `${item.id}_${sub.id}`;
              if (!newSession[uid] || newSession[uid].status === 'unchecked') {
                newSession[uid] = { ...(newSession[uid] || { photos: [] }), status: 'ok', timestamp };
                newAutoChecked.push(uid);
              }
            });
          }
        });
      });
      setState(prev => ({ ...prev, session: newSession }));
      setAutoCheckedIds(newAutoChecked);
    }
  };

  const getStats = () => {
    let total = 0, checked = 0, flagged = 0;
    CHECKLIST_DATA.forEach(section => {
      section.items.forEach(item => {
        if (item.type === 'simple') {
          total++;
          const entry = state.session[item.id];
          const st = entry?.status;
          if ((st === 'ok' || st === 'na') && !entry?.isStarred) checked++;
          if (st === 'flagged' || entry?.isStarred) flagged++;
        } else {
          item.subItems?.forEach(sub => {
            total++;
            const entry = state.session[`${item.id}_${sub.id}`];
            const st = entry?.status;
            if ((st === 'ok' || st === 'na') && !entry?.isStarred) checked++;
            if (st === 'flagged' || entry?.isStarred) flagged++;
          });
        }
      });
    });
    const checkedPercent = total > 0 ? (checked / total) * 100 : 0;
    const flaggedPercent = total > 0 ? (flagged / total) * 100 : 0;
    const totalPercent = total > 0 ? ((checked + flagged) / total) * 100 : 0;
    
    return { total, checked, flagged, checkedPercent, flaggedPercent, totalPercent };
  };

  const flattenItemsForReport = (section: SectionConfig) => {
    const items: { uniqueId: string, label: string, config: any, subLabel?: string }[] = [];
    section.items.forEach(item => {
      if (item.type === 'simple') {
        items.push({ uniqueId: item.id, label: item.text, config: item });
      } else {
        item.subItems?.forEach(sub => {
          items.push({ uniqueId: `${item.id}_${sub.id}`, label: item.text, subLabel: sub.label, config: item });
        });
      }
    });
    return items;
  };

  const handleShare = async () => {
    if (!generatedFile) return;
    if (navigator.canShare && navigator.canShare({ files: [generatedFile] })) {
      try {
        await navigator.share({
          files: [generatedFile],
          title: `B-${state.info.registration} Final Inspection Report`,
          text: 'Please check the attached final inspection report.'
        });
      } catch (error) { console.error('Sharing failed', error); }
    } else {
      const url = URL.createObjectURL(generatedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedFile.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownload = () => {
    if (!generatedFile) return;
    const url = URL.createObjectURL(generatedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTimeout(() => {
        alert('报告下载成功！');
    }, 500);
  };

  const handleShareIssues = async () => {
    if (!allIssuesExportRef.current) {
        alert("无法找到导出内容，请重试");
        return;
    }
    
    if (navigator.vibrate) navigator.vibrate(50);
    allIssuesExportRef.current.style.display = 'block';

    try {
        await waitForImages(allIssuesExportRef.current);
        await new Promise(resolve => setTimeout(resolve, 300));

        const canvas = await html2canvas(allIssuesExportRef.current, {
            scale: 2.0,
            useCORS: true,
            backgroundColor: '#f8fafc'
        });

        canvas.toBlob(async (blob) => {
            if (!blob) {
                if (allIssuesExportRef.current) allIssuesExportRef.current.style.display = 'none';
                return;
            }
            const filename = `Defects_B-${state.info.registration}_${format(new Date(), 'yyyyMMdd_HHmm')}.jpg`;
            const file = new File([blob], filename, { type: 'image/jpeg' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: `Defects Report: B-${state.info.registration}`,
                        text: `Found defects on B-${state.info.registration}. Please handle.`
                    });
                } catch (e) { }
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
            if (allIssuesExportRef.current) allIssuesExportRef.current.style.display = 'none';
        }, 'image/jpeg', 0.85);
    } catch (e) {
        console.error("Capture failed", e);
        if (allIssuesExportRef.current) allIssuesExportRef.current.style.display = 'none';
        alert("图片生成失败，请重试");
    }
  };

  const captureSelfie = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
        setState(prev => ({ ...prev, selfie: imageSrc }));
    }
  }, [webcamRef]);

  const finalizeSignature = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
       const originalCanvas = sigPadRef.current.getCanvas();
       const tempCanvas = document.createElement('canvas');
       tempCanvas.width = originalCanvas.height;
       tempCanvas.height = originalCanvas.width;
       const ctx = tempCanvas.getContext('2d');
       if (ctx) {
          ctx.save();
          ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
          ctx.rotate(-90 * Math.PI / 180);
          ctx.drawImage(originalCanvas, -originalCanvas.width / 2, -originalCanvas.height / 2);
          ctx.restore();
          setState(prev => ({ ...prev, signature: tempCanvas.toDataURL("image/png") }));
          setShowSignatureOverlay(false);
       }
    }
  };
  
  const getRectifiedOrFlaggedItems = () => {
    const items = CHECKLIST_DATA.map(s => flattenItemsForReport(s)).flat();
    return items.filter(item => {
        const entry = state.session[item.uniqueId];
        return entry && (entry.status === 'flagged' || entry.rectification || (entry.history && entry.history.length > 0));
    });
  };
  
  const getItemsForBatchShare = () => {
      // Only sharing active issues for the batch share image
      return getRectifiedOrFlaggedItems().filter(i => state.session[i.uniqueId]?.status === 'flagged');
  };

  const handleGeneratePDF = async () => {
      if (!printRef.current) return;
      setIsGenerating(true);
      const generatePromise = generatePDF(state, printRef.current, reportHeaderRef.current);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 60000));

      try {
          const file = await Promise.race([generatePromise, timeoutPromise]) as File;
          setGeneratedFile(file);
      } catch (e) {
          console.error(e);
          alert("报告生成失败。建议：\n1. 减少单次生成的照片数量\n2. 关闭后台其他应用释放内存\nError: " + e);
      } finally {
          setIsGenerating(false);
      }
  };

  if (state.step === 'welcome') {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 text-slate-900 flex flex-col items-center overflow-y-auto p-6 safe-area-inset-bottom relative">
        <div className="absolute top-6 right-6 text-[10px] text-slate-300 font-mono z-20">© 802711</div>
        {showChangelog && (
            <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200" onClick={() => setShowChangelog(false)}>
                <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowChangelog(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><X size={18} /></button>
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><History size={20} className="text-blue-600"/> 更新日志</h3>
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                        {CHANGELOGS.map((log, idx) => (
                            <div key={idx} className="relative pl-8 pb-8 border-l-2 border-slate-300 last:border-0 last:pb-0">
                                <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white z-10"></div>
                                <div className="flex justify-between items-baseline mb-2">
                                    <span className="font-bold text-slate-800">{log.version}</span>
                                    <span className="text-xs font-mono text-slate-400">{log.date}</span>
                                </div>
                                <ul className="space-y-1.5">
                                    {log.changes.map((change, cIdx) => (
                                        <li key={cIdx} className="text-sm text-slate-600 leading-snug flex items-start gap-2">
                                            <span className="text-blue-400 text-[10px] mt-1 shrink-0">●</span> {change}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div className="flex-1 w-full max-w-md flex flex-col justify-evenly py-2 min-h-[500px]">
            <div className="text-center space-y-4 pt-2 shrink-0">
                <div className="bg-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
                  <Plane size={42} className="text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">最终检查清单</h1>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Final Inspection Card</p>
                        <button 
                            onClick={() => setShowChangelog(true)} 
                            className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors"
                        >
                            {APP_VERSION}
                        </button>
                    </div>
                </div>
            </div>

          <div className="bg-white p-6 rounded-[2rem] space-y-5 shadow-sm border border-slate-100 w-full shrink-0">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block pl-1">注册号 / REG</label>
              <div className="flex bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden focus-within:border-blue-500 transition-all relative">
                <div className="px-4 py-4 text-slate-500 font-mono font-bold text-lg bg-slate-100 border-r border-slate-200 flex items-center select-none z-10 shrink-0">B-</div>
                <input type="text" className="flex-1 bg-transparent px-4 text-xl font-black uppercase outline-none text-slate-800 z-10 min-w-0" placeholder="XXXX" value={state.info.registration} onChange={e => setState(s => ({...s, info: {...s.info, registration: e.target.value.toUpperCase()}}))} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block pl-1">检查员 / Inspector</label>
              <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200 px-4 py-1 focus-within:border-blue-500 transition-all">
                {isAdmin ? <ShieldCheck size={18} className="text-blue-500 mr-3 shrink-0" /> : <User size={18} className="text-slate-400 mr-3 shrink-0" />}
                <input type="text" className="flex-1 bg-transparent py-4 font-bold text-base outline-none text-slate-800 min-w-0" placeholder="请输入姓名" value={state.info.inspectorName} onChange={e => setState(s => ({...s, info: {...s.info, inspectorName: e.target.value}}))} />
              </div>
            </div>
            <button disabled={!state.info.registration || !state.info.inspectorName} onClick={() => setStep('inspect')} className={`w-full text-white font-bold py-4 rounded-2xl text-lg shadow-xl disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 ${isAdmin ? 'bg-indigo-600 shadow-indigo-200' : 'bg-[#007AFF] shadow-blue-200'}`}>
                {isAdmin ? '管理员模式检查' : '开始检查'} <ChevronRight size={20} />
            </button>
          </div>

          <div className="bg-orange-50/60 p-5 rounded-2xl border border-orange-100 text-left w-full shrink-0">
            <strong className="text-red-600 text-xs font-black uppercase tracking-wider block mb-2 flex items-center gap-2"><AlertTriangle size={14}/> 务必注意 / ATTENTION</strong>
            <div className="space-y-1.5 text-[11px] text-orange-800 leading-snug font-bold opacity-80">
               {INSPECTOR_REQUIREMENTS.map((req, i) => (
                  <p key={i}>{req}</p>
               ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.step === 'inspect') {
    const stats = getStats();
    const tabIndex = filterMode === 'all' ? 0 : filterMode === 'pending' ? 1 : 2;
    return (
      <div className="min-h-screen bg-slate-100 pb-24 flex flex-col overflow-x-hidden">
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">清除所有数据？</h3>
              <div className="flex flex-col gap-3">
                <button onClick={handleConfirmReset} className="w-full bg-red-600 text-white font-bold py-4 rounded-xl">确认并返回首页</button>
                <button onClick={() => setShowResetConfirm(false)} className="w-full bg-slate-100 text-slate-600 font-bold py-4 rounded-xl">取消</button>
              </div>
            </div>
          </div>
        )}

        {isEditingInfo && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setIsEditingInfo(false)}>
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center">
                 <h3 className="text-xl font-bold text-slate-800">编辑信息</h3>
                 <button onClick={() => setIsEditingInfo(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
               </div>
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5 ml-1">注册号 / Registration</label>
                   <div className="flex items-center bg-slate-50 border-2 border-slate-100 focus-within:border-blue-500 rounded-2xl px-4 h-14 transition-colors">
                      <span className="font-bold text-slate-400 mr-1 text-lg shrink-0">B-</span>
                      <input className="bg-transparent flex-1 font-bold text-xl outline-none uppercase text-slate-800 min-w-0" value={state.info.registration} onChange={e => setState(s => ({...s, info: {...s.info, registration: e.target.value.toUpperCase()}}))} />
                   </div>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-400 uppercase block mb-1.5 ml-1">检查员 / Inspector</label>
                   <div className="flex items-center bg-slate-50 border-2 border-slate-100 focus-within:border-blue-500 rounded-2xl px-4 h-14 transition-colors">
                      <input className="bg-transparent flex-1 font-bold text-xl outline-none text-slate-800 min-w-0" value={state.info.inspectorName} onChange={e => setState(s => ({...s, info: {...s.info, inspectorName: e.target.value}}))} />
                   </div>
                 </div>
               </div>
               <button onClick={() => setIsEditingInfo(false)} className="w-full h-14 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-[0.98] transition-all">保存更改</button>
            </div>
          </div>
        )}

        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur shadow-sm border-b border-slate-200">
           <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center bg-slate-50 rounded-lg p-1 -ml-1 active:bg-slate-100 transition-colors cursor-pointer group" onClick={() => setIsEditingInfo(true)}>
                    <div className="flex flex-col px-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">注册号 REG</div>
                        <div className="text-xl font-black text-slate-900 font-mono leading-none">B-{state.info.registration || '___'}</div>
                    </div>
                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                    <div className="flex flex-col px-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">检查员 INSPECTOR</div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-1 leading-none truncate max-w-[100px]">
                            {isAdmin && <ShieldCheck size={12} className="text-blue-500" />}
                            {state.info.inspectorName || '点击输入'}
                        </div>
                    </div>
                    <div className="px-1 text-slate-300 group-hover:text-blue-500 transition-colors"><Edit2 size={14} /></div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">日期 DATE</div>
                    <div className="text-base font-bold text-slate-900 font-mono leading-none">{state.info.date}</div>
                </div>
           </div>
           
           <div className="h-1.5 w-full bg-slate-100 flex">
                <div className="bg-emerald-500 h-full transition-all duration-500 ease-out" style={{width: `${stats.checkedPercent}%`}} />
                <div className="bg-red-500 h-full transition-all duration-500 ease-out" style={{width: `${stats.flaggedPercent}%`}} />
           </div>
           
           <div className="flex border-t border-slate-100 bg-white">
             <button onClick={() => setFilterMode('all')} className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${filterMode === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400'}`}>全部</button>
             <button onClick={() => setFilterMode('pending')} className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${filterMode === 'pending' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400'}`}>未检 ({stats.total - (stats.checked)})</button>
             <button onClick={() => setFilterMode('flagged')} className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all relative flex items-center justify-center gap-2 ${stats.flagged > 0 ? 'text-red-600 font-black' : 'text-slate-400'} ${filterMode === 'flagged' ? 'border-red-500' : 'border-transparent'}`}>
                缺陷/回顾 ({stats.flagged})
                {/* Batch Share Button in Tab Header */}
                {stats.flagged > 0 && filterMode === 'flagged' && (
                    <div 
                       onClick={(e) => { e.stopPropagation(); handleShareIssues(); }}
                       className="ml-1 p-1 bg-red-100 text-red-600 rounded-md active:scale-90 transition-transform shadow-sm"
                    >
                        <Share2 size={12} />
                    </div>
                )}
             </button>
           </div>
        </div>
        
        <div className="flex-1 overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="tabs-container" style={{ transform: `translateX(-${tabIndex * 33.333}%)` }}>
            {['all', 'pending', 'flagged'].map((mode) => (
              <div key={mode} className="tab-pane p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] pb-24">
                {CHECKLIST_DATA.map(section => {
                   const items = section.items.filter(item => {
                      if (mode === 'all') return true;
                      if (item.type === 'simple') {
                          const st = state.session[item.id]?.status || 'unchecked';
                          const isStarred = state.session[item.id]?.isStarred;
                          // Pending: Unchecked OR Starred
                          // Flagged: Flagged OR Starred
                          if (mode === 'pending') return st === 'unchecked' || isStarred;
                          if (mode === 'flagged') return st === 'flagged' || isStarred;
                          return true;
                      } else {
                          const subIds = item.subItems?.map(s => `${item.id}_${s.id}`) || [];
                          if (mode === 'pending') return subIds.some(id => (state.session[id]?.status || 'unchecked') === 'unchecked' || state.session[id]?.isStarred);
                          if (mode === 'flagged') return subIds.some(id => state.session[id]?.status === 'flagged' || state.session[id]?.isStarred);
                          return true;
                      }
                   });
                   if (items.length === 0) return null;
                   return (
                     <div key={section.id}>
                       <h3 className="px-2 mb-2 text-sm font-black text-slate-400 uppercase tracking-wider py-2">{section.title}</h3>
                       <div className="flex flex-col gap-3">
                         {items.map(item => {
                           if (item.type === 'simple') {
                             return <CheckItem key={item.id} uniqueId={item.id} label={item.text} requiresInput={item.requiresInput} inputLabel={item.inputLabel} pressureType={item.pressureType} entry={state.session[item.id]} onUpdate={updateSession} info={state.info} />;
                           } else {
                             const subIds = item.subItems?.map(sub => `${item.id}_${sub.id}`) || [];
                             const subEntries = subIds.map(id => state.session[id]);
                             const hasFlagged = subEntries.some(e => e?.status === 'flagged');
                             const isAllCompleted = subEntries.every(e => e?.status === 'ok' || e?.status === 'na');
                             const isHighlight = HIGHLIGHT_RED_IDS.includes(item.id);
                             let multiContainerStyles = "rounded-2xl p-4 shadow-sm border border-slate-200 bg-white border-l-[6px] border-l-blue-500";
                             if (hasFlagged) {
                               multiContainerStyles = "rounded-2xl p-4 shadow-sm bg-red-50 border-red-500 border-l-[6px]";
                             } else if (isAllCompleted) {
                               multiContainerStyles = "rounded-2xl p-4 shadow-sm bg-emerald-50/20 border-emerald-500 border-l-[6px]";
                             }
                             
                             const isSpecialLayout = item.id === '2_16';
                             const gridClass = isSpecialLayout 
                                ? 'flex flex-col w-full gap-3' // Special Vertical Stack
                                : (item.layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2');

                             return (
                               <div key={item.id} className={`${multiContainerStyles} transition-all duration-300`}>
                                 <div className={`font-bold text-[15px] mb-4 leading-relaxed border-b border-slate-50 pb-2 ${isHighlight ? 'text-red-600' : (hasFlagged ? 'text-red-900' : isAllCompleted ? 'text-emerald-900' : 'text-slate-900')}`}>{item.text}</div>
                                 <div className={gridClass}>
                                     {item.subItems?.map((sub, idx) => {
                                         // Special wrapper logic for 2_16 to achieve staggering
                                         const wrapperClass = isSpecialLayout
                                             ? `w-[75%] ${idx % 2 === 0 ? 'self-start' : 'self-end'}`
                                             : '';

                                         return (
                                             <div key={`${item.id}_${sub.id}`} className={wrapperClass}>
                                                 <CheckItem 
                                                   uniqueId={`${item.id}_${sub.id}`} 
                                                   label={sub.label} 
                                                   entry={state.session[`${item.id}_${sub.id}`]} 
                                                   onUpdate={updateSession} 
                                                   isSubItem={true} 
                                                   requiresInput={item.requiresInput}
                                                   inputLabel={item.inputLabel}
                                                   pressureType={item.pressureType}
                                                   info={state.info}
                                                 />
                                             </div>
                                         );
                                     })}
                                 </div>
                               </div>
                             );
                           }
                         })}
                       </div>
                     </div>
                   );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 pb-6 px-6 z-40 flex gap-4 shadow-xl">
           <button onClick={() => setShowResetConfirm(true)} className="w-12 h-12 flex items-center justify-center rounded-xl bg-red-50 text-red-500 border border-red-100"><Trash2 size={22} /></button>
           {isAdmin && (
             <button onClick={toggleAutoCheck} className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all ${autoCheckedIds.length > 0 ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{autoCheckedIds.length > 0 ? <Undo2 size={22}/> : <Wand2 size={22} />}</button>
           )}
           <button onClick={() => setStep('sign')} className={`flex-1 rounded-xl font-bold text-lg text-white shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${stats.checked === stats.total ? 'bg-emerald-600' : 'bg-slate-800'}`}>
             {stats.checked === stats.total ? <><CheckCircle2 /> 完成并签署</> : '检查并导出'}
           </button>
        </div>
      </div>
    );
  }

  if (state.step === 'sign') {
    const stats = getStats();
    const allFlatItems = CHECKLIST_DATA.map(s => flattenItemsForReport(s)).flat();
    const pendingItems = allFlatItems.filter(item => {
        const s = state.session[item.uniqueId];
        return (s?.status || 'unchecked') === 'unchecked';
    });
    // Flagged for sign check now includes Starred items because they need review!
    const flaggedItems = getItemsForBatchShare(); 
    // Wait, getItemsForBatchShare only filters status==='flagged' currently.
    // For signing, we should block if there are flagged OR starred items?
    // "Review" items are not technically blockers for signing unless process requires them cleared.
    // Assuming Starred items are meant to be cleared (unstarred) before signing? Or just informational?
    // User said "归为待处理项目类" (Classify as pending category). Pending usually blocks signing completion check.
    
    const starredItems = allFlatItems.filter(item => state.session[item.uniqueId]?.isStarred);

    const isAllCompleted = pendingItems.length === 0;
    const hasIssues = flaggedItems.length > 0;
    const hasStarred = starredItems.length > 0;
    const canSign = isAllCompleted && !hasIssues && !hasStarred;

    return (
       <div className="min-h-screen bg-slate-100 flex flex-col">
         {showSignatureOverlay && (
           <div className="fixed inset-0 z-[100] bg-white flex flex-col">
              <div className="absolute top-4 left-6 z-10 flex flex-col gap-2">
                <span className="bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full text-white text-[10px] font-bold flex items-center gap-1"><Smartphone className="rotate-90" size={12}/> 请横屏持机签署</span>
              </div>
              <div ref={sigContainerRef} className="flex-1 relative bg-white overflow-hidden sig-canvas-container">
                <SignatureCanvas ref={sigPadRef} canvasProps={{ className: 'sigCanvas' }} penColor='black' velocityFilterWeight={0.6} minWidth={1.5} maxWidth={5.5} />
              </div>
              <div className="absolute bottom-6 w-full flex justify-center gap-6 z-20 pointer-events-none">
                 <button onClick={() => sigPadRef.current?.clear()} className="pointer-events-auto w-12 h-12 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center rotate-90 shadow-md active:bg-slate-100"><Trash2 size={20} /></button>
                 <button onClick={finalizeSignature} className="pointer-events-auto w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center rotate-90 shadow-lg active:scale-95"><CheckCircle2 size={20} /></button>
                 <button onClick={() => setShowSignatureOverlay(false)} className="pointer-events-auto w-12 h-12 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center rotate-90 shadow-sm active:bg-slate-100"><X size={20} /></button>
              </div>
           </div>
         )}
         <div className="flex-1 overflow-y-auto pb-24">
            <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                 <h2 className="text-xl font-bold text-slate-800">签署报告</h2>
                 <div className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">B-{state.info.registration}</div>
            </div>
            <div className="p-4 space-y-6">
               {!canSign && !isAdmin && (
                   <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                       <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                           <ClipboardList className="text-blue-500" size={20}/>
                           <h2 className="font-bold text-lg text-slate-800">待处理项目 ({flaggedItems.length + pendingItems.length + starredItems.length})</h2>
                       </div>
                       <div className="p-5 space-y-8">
                           {(hasIssues || hasStarred) && (
                               <div ref={issuesRef} className="bg-white rounded-xl">
                                   <div className="flex items-center justify-between mb-3 pb-2 border-b border-red-100">
                                       <h3 className="flex items-center gap-2 text-red-600 font-black text-sm uppercase tracking-wider">
                                           <AlertTriangle size={16} /> 存在缺陷 / 回顾
                                       </h3>
                                       <button 
                                          onClick={handleShareIssues} 
                                          data-html2canvas-ignore
                                          className="flex items-center gap-1.5 text-xs font-bold bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 active:scale-95 transition-all shadow-sm"
                                       >
                                           <Share2 size={14}/> 生成图片分享
                                       </button>
                                   </div>
                                   
                                   <div className="space-y-3">
                                       {[...flaggedItems, ...starredItems].filter((v,i,a)=>a.findIndex(t=>(t.uniqueId===v.uniqueId))===i).map(item => (
                                           <CheckItem 
                                               key={item.uniqueId} 
                                               uniqueId={item.uniqueId} 
                                               label={item.label} 
                                               subLabel={item.subLabel}
                                               entry={state.session[item.uniqueId]} 
                                               onUpdate={updateSession}
                                               requiresInput={item.config.requiresInput}
                                               inputLabel={item.config.inputLabel}
                                               pressureType={item.config.pressureType}
                                               isSubItem={true}
                                               info={state.info}
                                           />
                                       ))}
                                   </div>
                               </div>
                           )}

                           {pendingItems.length > 0 && (
                               <div>
                                   <h3 className="flex items-center gap-2 text-slate-400 font-bold text-sm uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">
                                       <div className="w-4 h-4 rounded-full border-2 border-slate-300" /> 未检查 (Pending)
                                   </h3>
                                   <div className="space-y-3">
                                       {pendingItems.map(item => (
                                           <CheckItem 
                                               key={item.uniqueId} 
                                               uniqueId={item.uniqueId} 
                                               label={item.label} 
                                               subLabel={item.subLabel}
                                               entry={state.session[item.uniqueId]} 
                                               onUpdate={updateSession}
                                               requiresInput={item.config.requiresInput}
                                               inputLabel={item.config.inputLabel}
                                               pressureType={item.config.pressureType}
                                               isSubItem={true}
                                               info={state.info}
                                           />
                                       ))}
                                   </div>
                               </div>
                           )}
                       </div>
                   </div>
               )}

               {(canSign || isAdmin) && (
                   <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div className={`${isAdmin ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'} border rounded-2xl p-6 text-center`}>
                           <div className={`w-16 h-16 ${isAdmin ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'} rounded-full flex items-center justify-center mx-auto mb-3`}>
                             {isAdmin ? <ShieldCheck size={32} /> : <CheckCircle2 size={32} />}
                           </div>
                           <h3 className={`text-lg font-bold ${isAdmin ? 'text-indigo-800' : 'text-emerald-800'}`}>
                               {isAdmin ? '管理员模式就绪' : '已就绪'}
                           </h3>
                           <p className={`${isAdmin ? 'text-indigo-600' : 'text-emerald-600'} text-sm`}>
                               {isAdmin ? '您可以强制生成报告 (忽略检查项和签名)' : '请依次拍照签名后再生成报告'}
                           </p>
                       </div>

                       <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex flex-col items-center">
                            <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center justify-center gap-2"><Camera size={20}/> 检查员自拍确认</h3>
                            <div className="flex flex-col items-center gap-4">
                                {state.selfie ? (
                                    <div className="relative w-40 h-40 rounded-xl overflow-hidden shadow-md border-2 border-white">
                                        <img src={state.selfie} className="w-full h-full object-cover" />
                                        <button onClick={() => setState(s => ({...s, selfie: null}))} className="absolute top-1 right-1 p-1 bg-white/80 rounded-full text-slate-600 shadow-sm backdrop-blur">
                                            <RefreshCw size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-40 h-40 bg-slate-200 rounded-xl overflow-hidden relative shadow-inner border-2 border-slate-300">
                                        <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} className="w-full h-full object-cover" mirrored={true} disablePictureInPicture={false} forceScreenshotSourceSize={false} imageSmoothing={true} onUserMedia={() => {}} onUserMediaError={() => {}} screenshotQuality={0.92} />
                                    </div>
                                )}

                                {!state.selfie && (
                                    <button onClick={captureSelfie} className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold shadow-lg text-sm flex items-center gap-2 active:scale-95 transition-transform">
                                        <Camera size={16} /> 拍照确认
                                    </button>
                                )}
                            </div>
                       </div>

                       <div onClick={() => { if (!state.selfie && !isAdmin) { alert("请先完成自拍确认"); return; } setShowSignatureOverlay(true); }} className={`bg-white rounded-2xl border-2 border-dashed flex flex-col items-center justify-center min-h-[180px] relative transition-all ${state.signature ? 'border-blue-200 bg-blue-50/20' : 'border-slate-300 text-slate-400 active:bg-slate-50'}`}>
                         {state.signature ? (
                           <>
                            <img src={state.signature} className="h-32 object-contain" />
                            <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded-full text-[10px] font-bold"><PenTool size={10}/> 重签</div>
                           </>
                         ) : (
                           <>
                             <PenTool size={48} className="mb-2 opacity-20" />
                             <span className="font-bold">点击开始横屏签名</span>
                           </>
                         )}
                       </div>
                   </div>
               )}
            </div>
         </div>
         <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 pb-6 px-6 z-40 flex gap-4">
             <button onClick={() => setStep('inspect')} className="px-6 py-4 rounded-xl font-bold bg-slate-100 text-slate-600">返回</button>
             <button disabled={(!isAdmin && (!canSign || !state.signature || !state.selfie)) || isGenerating} onClick={handleGeneratePDF} className={`flex-1 rounded-xl font-bold text-white shadow-xl flex items-center justify-center gap-2 ${(canSign && state.signature && state.selfie) || isAdmin ? (isAdmin ? 'bg-indigo-600' : 'bg-blue-600') : 'bg-slate-300'}`}>
                {isGenerating ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : <><Download /> {isAdmin ? '强制生成报告' : '生成报告'}</>}
             </button>
         </div>

         <div ref={reportHeaderRef} style={{ position: 'absolute', top: -9999, left: -9999, width: '210mm' }} className="bg-white px-6 py-2 border-b border-black/50 flex items-center justify-between">
            <div className="text-xs font-bold text-black">注册号 REG: B-{state.info.registration}</div>
            <div className="text-xs font-bold text-black flex items-center gap-2">
                检查员 Inspector: {state.info.inspectorName}
                {state.signature && <img src={state.signature} className="h-6 object-contain" />}
            </div>
            <div className="text-xs font-bold text-black">日期 Date: {state.info.date}</div>
         </div>

         <div className="fixed top-0 left-[-9999px] w-[210mm] bg-white text-black pointer-events-none" ref={printRef}>
            <div id="print-container" style={{ WebkitFontSmoothing: 'antialiased', textRendering: 'geometricPrecision' }}>
               <div className="break-inside-avoid p-6 pb-0">
                   <div className="border-4 border-black p-4 mb-4 flex flex-col items-center justify-center">
                       <h1 className="text-2xl font-black text-black leading-none mb-2">飞机最终检查单 AIRCRAFT FINAL INSPECTION</h1>
                       <div className="text-sm font-bold text-black tracking-[0.2em] uppercase">客舱车间 CABIN WORKSHOP</div>
                   </div>
                   
                   <div className="flex border-2 border-black mb-2 bg-slate-50">
                     <div className="flex-1 p-3 flex flex-col justify-center gap-4">
                         <div>
                             <div className="text-[10px] font-bold text-slate-500 uppercase">注册号 REG</div>
                             <div className="text-2xl font-black font-mono text-black">B-{state.info.registration}</div>
                         </div>
                         <div>
                             <div className="text-[10px] font-bold text-slate-500 uppercase">日期 DATE</div>
                             <div className="text-xl font-bold font-mono text-black">{state.info.date}</div>
                         </div>
                     </div>

                     <div className="flex-1 p-3 border-l-2 border-black flex flex-col justify-between">
                        <div>
                             <div className="text-[10px] font-bold text-slate-500 uppercase">检查员 INSPECTOR</div>
                             <div className="text-xl font-bold text-black">{state.info.inspectorName}</div>
                        </div>
                        <div className="mt-2">
                             <div className="text-[10px] font-bold text-slate-500 uppercase">签名 SIGNATURE</div>
                             {state.signature && <img src={state.signature} className="h-12 object-contain -ml-2" />}
                        </div>
                     </div>

                     <div className="w-32 border-l-2 border-black bg-white p-1">
                        {state.selfie ? (
                            <img src={state.selfie} className="w-full h-full object-cover block" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs uppercase text-center">No Photo</div>
                        )}
                     </div>
                   </div>

                   <div className="border-2 border-black border-t-0 p-3 mb-4 bg-white">
                      <div className="font-bold text-black mb-1 border-b border-slate-300 pb-1">检查要求 / REQUIREMENTS</div>
                      {REPORT_REQUIREMENTS.map((req, i) => (
                        <div key={i} className="text-sm font-bold text-red-600 leading-snug mb-0.5 last:mb-0">{req}</div>
                      ))}
                   </div>
               </div>
               
               {/* Main Checklist */}
               <div className="px-6 space-y-4">
                 {CHECKLIST_DATA.map(section => (
                   <div key={section.id} className="section-block">
                      <div className="break-inside-avoid bg-black text-white font-black px-4 py-2 text-xl uppercase mb-1 flex items-center justify-center tracking-wider">{cleanText(section.title)}</div>
                      <div className="">
                          {flattenItemsForReport(section).map((item, idx) => {
                             const entry = state.session[item.uniqueId];
                             const status = entry?.status || 'unchecked';
                             const isHighlight = HIGHLIGHT_RED_IDS.includes(item.uniqueId);

                             return (
                               <div key={item.uniqueId} className={`flex border border-slate-400 break-inside-avoid -mt-[1px] relative z-10 ${idx%2===0 ? 'bg-white':'bg-slate-50'}`}>
                                 <div className="p-2 pl-3 w-3/4 border-r border-slate-400 text-sm flex items-center">
                                   <div className={`font-bold leading-snug ${isHighlight ? 'text-red-600' : 'text-black'}`}>
                                     {cleanText(item.label)} 
                                     {item.subLabel && (
                                         <span className="bg-slate-200 inline-flex items-center justify-center h-6 px-2 rounded-md text-xs ml-2 text-black font-black leading-none pt-[1px]">
                                             {cleanText(item.subLabel)}
                                         </span>
                                     )}
                                   </div>
                                 </div>
                                 <div className="p-2 w-1/4 flex flex-col items-center justify-center">
                                    <div className="flex items-center justify-center gap-2 h-full my-auto">
                                        {status === 'ok' && <span className="font-black text-emerald-800 text-xl leading-none">OK</span>}
                                        {status === 'na' && <span className="font-bold text-slate-400 text-sm">N/A</span>}
                                        {status === 'flagged' && <span className="font-bold text-white bg-red-600 px-2 py-0.5 rounded text-xs">ISSUE</span>}
                                        
                                        {entry?.timestamp && (
                                        <span className="text-base text-black font-mono font-bold leading-none translate-y-[1px]">
                                            {format(new Date(entry.timestamp), 'HH:mm')}
                                        </span>
                                        )}
                                    </div>
                                   {entry?.value && (
                                     <div className={`mt-1 text-[10px] border border-black inline-block px-1 rounded font-bold ${entry.value === 'RED' ? 'bg-red-500 text-white' : entry.value === 'YELLOW' ? 'bg-yellow-400 text-black' : entry.value === 'GREEN' ? 'bg-emerald-500 text-white' : 'bg-white text-black'}`}>{entry.value} PSI</div>
                                   )}
                                 </div>
                               </div>
                             );
                          })}
                      </div>
                   </div>
                 ))}
               </div>

               {/* Rectification & Defects Section - Support History */}
               {getRectifiedOrFlaggedItems().length > 0 && (
                 <div className="px-6 mt-8 pt-4 border-t-2 border-slate-300">
                    <div className="bg-slate-900 text-white font-black px-4 py-3 text-xl uppercase mb-4 flex items-center justify-center tracking-wider break-inside-avoid">
                        故障及整改记录 / DEFECTS & RECTIFICATION RECORDS
                    </div>
                    <div className="space-y-6">
                        {getRectifiedOrFlaggedItems().map((item, i) => {
                            const entry = state.session[item.uniqueId];
                            const allRecords = [
                                ...(entry.history || []),
                                { 
                                    issueNote: entry.issueNote, 
                                    issuePhotos: entry.issuePhotos, 
                                    rectification: entry.rectification,
                                    timestamp: entry.timestamp,
                                    isCurrent: true 
                                }
                            ].filter(r => r.issueNote || r.rectification);

                            return (
                                <div key={i} className="border-2 border-slate-400 p-0 flex flex-col bg-white break-inside-avoid">
                                    <div className="bg-slate-100 p-2 border-b-2 border-slate-400 font-bold text-black flex justify-between items-center">
                                        <span>#{i+1} - {cleanText(item.label)} {item.subLabel ? `(${item.subLabel})` : ''}</span>
                                        <span className="text-xs bg-slate-200 px-2 py-1 rounded">ID: {item.uniqueId}</span>
                                    </div>
                                    
                                    {allRecords.map((rec: any, idx) => (
                                        <div key={idx} className={`flex ${idx > 0 ? 'border-t-2 border-slate-300' : ''}`}>
                                            {/* Issue Column */}
                                            <div className="flex-1 p-3 border-r-2 border-slate-400">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase">发现问题 FINDING {rec.isCurrent ? '(CURRENT)' : '(HISTORY)'}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{rec.timestamp ? format(new Date(rec.timestamp), 'HH:mm') : ''}</div>
                                                </div>
                                                <div className="font-bold text-red-600 text-sm mb-2">{rec.issueNote || '未记录详细描述'}</div>
                                                {rec.issuePhotos && rec.issuePhotos.length > 0 && (
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        {rec.issuePhotos.map((p: string, pIdx: number) => (
                                                            <div key={pIdx} className="w-full h-32 border border-slate-200 bg-black/5 flex items-center justify-center overflow-hidden">
                                                                <img src={p} className="max-w-full max-h-full object-contain" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Rectification Column */}
                                            <div className="flex-1 p-3 bg-emerald-50/30">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase">整改措施 RECTIFICATION</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{rec.rectification?.timestamp ? format(new Date(rec.rectification.timestamp), 'HH:mm') : ''}</div>
                                                </div>
                                                <div className="font-bold text-emerald-800 text-sm mb-2">{rec.rectification?.method || (rec.isCurrent && entry.status === 'flagged' ? '待整改 (Pending)' : '已解决')}</div>
                                                
                                                {rec.rectification?.photos && rec.rectification.photos.length > 0 && (
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        {rec.rectification.photos.map((p: string, pIdx: number) => (
                                                             <div key={pIdx} className="w-full h-32 border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                                                                <img src={p} className="max-w-full max-h-full object-contain" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                 </div>
               )}
            </div>
         </div>
         {generatedFile && (
           <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
             <div className="bg-white rounded-3xl p-8 w-full max-sm text-center space-y-6">
                 <FileCheck size={64} className="text-blue-500 mx-auto" />
                 <div><h3 className="text-2xl font-bold text-slate-900">报告已成功签署</h3></div>
                 <div className="space-y-3">
                   <button onClick={handleShare} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2"><Share2 size={24} /> 分享 PDF 报告</button>
                   <button onClick={handleDownload} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2"><Download size={24} /> 下载 PDF 报告</button>
                   <button onClick={() => setGeneratedFile(null)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">返回</button>
                   <button onClick={handleConfirmReset} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold text-sm">检查下一架飞机</button>
                 </div>
             </div>
           </div>
         )}
         
         {/* Hidden Batch Share Image Template */}
         <div 
             ref={allIssuesExportRef} 
             style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '600px', backgroundColor: '#f8fafc', padding: '40px', borderRadius: '24px', zIndex: -1 }}
         >
             <div className="border-b-4 border-slate-900 pb-6 mb-8 flex items-end justify-between">
                <div>
                   <h2 className="text-4xl font-black text-slate-900 leading-none">发现报告</h2>
                   <div className="text-base font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">FINDING REPORT</div>
                </div>
             </div>
             
             <div className="flex justify-between bg-white p-6 rounded-3xl border border-slate-200 mb-10 shadow-sm">
                <div><div className="text-xs font-bold text-slate-400 uppercase mb-1">注册号 REG</div><div className="text-3xl font-black text-slate-900 font-mono">B-{state.info.registration}</div></div>
                <div><div className="text-xs font-bold text-slate-400 uppercase mb-1">检查员 INSPECTOR</div><div className="text-2xl font-bold text-slate-900">{state.info.inspectorName}</div></div>
                <div className="text-right"><div className="text-xs font-bold text-slate-400 uppercase mb-1">日期 DATE</div><div className="text-2xl font-mono font-bold text-slate-900">{state.info.date}</div></div>
             </div>

             <div className="space-y-12">
                 {getItemsForBatchShare().map((item, idx) => {
                     const entry = state.session[item.uniqueId];
                     return (
                         <div key={item.uniqueId} className="break-inside-avoid">
                             <div className="bg-white border-l-[16px] border-red-500 pl-8 py-6 mb-6 rounded-r-3xl shadow-xl border-y border-r border-slate-200">
                                <div className="text-xs font-bold text-red-400 uppercase mb-2 tracking-wider">Finding #{idx + 1}</div>
                                {item.subLabel && (
                                    <div className="mb-4">
                                        <span className="inline-block bg-slate-900 text-white text-xl font-black px-4 py-1.5 rounded-lg shadow-sm uppercase">
                                            {cleanText(item.subLabel)}
                                        </span>
                                    </div>
                                )}
                                <div className="text-2xl font-bold text-slate-900 leading-tight">{cleanText(item.label)}</div>
                             </div>

                             {entry?.issueNote && (
                               <div className="mb-6 px-2">
                                 <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-yellow-400 rounded-full"></div>
                                    <div className="text-sm font-bold text-slate-400 uppercase">备注 / Note</div>
                                 </div>
                                 <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-200 text-xl font-medium text-slate-800 leading-relaxed shadow-sm">
                                    {entry.issueNote}
                                 </div>
                               </div>
                             )}

                             {entry?.issuePhotos && entry.issuePhotos.length > 0 && (
                               <div className="px-2">
                                   <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                        <div className="text-sm font-bold text-slate-400 uppercase">现场照片 / Photos</div>
                                   </div>
                                   <div className="flex flex-col gap-6">
                                     {entry.issuePhotos.map((p, pIdx) => (
                                       <div key={pIdx} className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-white relative">
                                         <img src={p} className="w-full h-auto block" />
                                         <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-bold">
                                              Photo {pIdx + 1}
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                               </div>
                             )}
                             
                             {idx < getItemsForBatchShare().length - 1 && <div className="border-b-4 border-slate-200 my-10"></div>}
                         </div>
                     );
                 })}
             </div>
             
             <div className="mt-16 pt-8 border-t-2 border-slate-200 flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wide">
                  <span>Aircraft Final Inspection App</span>
                  <span>生成时间 Generated: {new Date().toLocaleTimeString()}</span>
             </div>
         </div>
       </div>
    );
  }
  return null;
}
