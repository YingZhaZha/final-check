
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
  AlertTriangle, RotateCcw, PenTool, Camera, Download, LayoutList, Share2, FileCheck, Edit2, X, Trash2, Wand2, Undo2, Smartphone, RotateCw, ArrowLeft, ClipboardList, RefreshCw, History, ShieldCheck, Wrench, Send, Star, Check
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

// Req 2: Version Update
const APP_VERSION = 'v3.3.0';

const CHANGELOGS = [
  {
    version: 'v3.3.0',
    date: format(new Date(), 'yyyy-MM-dd'),
    changes: [
      '新增：完成整改后自动加入待回顾列表',
      '优化：缺陷提交弹窗按钮布局调整',
      '优化：历史记录全汉化，精确到时间',
      '修复：批量分享按钮点击无效问题'
    ]
  },
  {
    version: 'v3.2.0',
    date: '2025-12-24',
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
        [uniqueId]: { ...(prev.session[uniqueId] || { status: 'unchecked', photos: [], issuePhotos: [] }), ...updates }
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
               newSession[item.id] = { ...(newSession[item.id] || { photos: [], issuePhotos: [] }), status: 'ok', timestamp };
               newAutoChecked.push(item.id);
            }
          } else {
            item.subItems?.forEach(sub => {
              const uid = `${item.id}_${sub.id}`;
              if (!newSession[uid] || newSession[uid].status === 'unchecked') {
                newSession[uid] = { ...(newSession[uid] || { photos: [], issuePhotos: [] }), status: 'ok', timestamp };
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
    let total = 0, checked = 0, flagged = 0, starred = 0;
    CHECKLIST_DATA.forEach(section => {
      section.items.forEach(item => {
        if (item.type === 'simple') {
          total++;
          const entry = state.session[item.id];
          const st = entry?.status;
          if ((st === 'ok' || st === 'na') && !entry?.isStarred) checked++;
          if (st === 'flagged') flagged++;
          if (entry?.isStarred) starred++;
        } else {
          item.subItems?.forEach(sub => {
            total++;
            const entry = state.session[`${item.id}_${sub.id}`];
            const st = entry?.status;
            if ((st === 'ok' || st === 'na') && !entry?.isStarred) checked++;
            if (st === 'flagged') flagged++;
            if (entry?.isStarred) starred++;
          });
        }
      });
    });
    // Total issues for the red progress bar includes flagged and starred
    const totalIssues = flagged + starred;
    
    const checkedPercent = total > 0 ? (checked / total) * 100 : 0;
    const flaggedPercent = total > 0 ? (totalIssues / total) * 100 : 0;
    const totalPercent = total > 0 ? ((checked + totalIssues) / total) * 100 : 0;
    
    return { total, checked, flagged, starred, totalIssues, checkedPercent, flaggedPercent, totalPercent };
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

  // Helper to find section title for item
  // Req 5: Remove ordinal (e.g., "一、")
  const getSectionTitle = (id: string) => {
    const section = CHECKLIST_DATA.find(s => 
      s.items.some(i => 
        i.id === id || (i.subItems && i.subItems.some(sub => `${i.id}_${sub.id}` === id))
      )
    );
    if (!section) return '';
    // Remove "一、", "1.", etc from start
    return section.title.replace(/^[一二三四五六七八九十\d]+[、\.]\s*/, '').split('(')[0].trim();
  };

  // Req 4: Helper to find parent item label
  const getParentLabel = (id: string) => {
      // ID format is either "1_1" or "1_1_sub1"
      // If it has 3 parts or came from a multi item, we need to find the parent.
      // But based on my logic, subItems ids are like "2_16_L1".
      // Let's iterate.
      for (const section of CHECKLIST_DATA) {
          for (const item of section.items) {
              if (item.subItems) {
                  const sub = item.subItems.find(s => `${item.id}_${s.id}` === id);
                  if (sub) {
                      return item.text; // Return the full parent text
                  }
              }
          }
      }
      return null;
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
        {/* ... Changelog Modal ... */}
        {showChangelog && (
            <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200" onClick={() => setShowChangelog(false)}>
                {/* ... */}
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

        <div className="flex-1 w-full max-w-md flex flex-col py-2 min-h-[500px] gap-6">
            <div className="flex items-center justify-center gap-6 pt-4 shrink-0">
                {/* Updated Icon - Green Paper Plane with Check Badge */}
                <div className="relative w-20 h-20 shrink-0">
                    <Send size={70} className="text-[#22c55e] -rotate-12 absolute top-0 left-0 drop-shadow-sm" strokeWidth={1.5} fill="white" />
                    <div className="absolute bottom-1 right-0 bg-[#22c55e] rounded-full p-1.5 border-4 border-slate-50">
                        <Check size={14} className="text-white" strokeWidth={3} />
                    </div>
                </div>
                
                <div className="text-left">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">最终检查清单</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Final Inspection</p>
                        <button 
                            onClick={() => setShowChangelog(true)} 
                            className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors"
                        >
                            {APP_VERSION}
                        </button>
                    </div>
                </div>
            </div>

          <div className="bg-white p-5 rounded-[1.5rem] space-y-4 shadow-sm border border-slate-100 w-full shrink-0">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block pl-1">注册号 / REG</label>
              <div className="flex bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-blue-500 transition-all relative">
                <div className="px-4 py-3.5 text-slate-500 font-mono font-bold text-lg bg-slate-100 border-r border-slate-200 flex items-center select-none z-10 shrink-0">B-</div>
                <input type="text" className="flex-1 bg-transparent px-4 text-xl font-black uppercase outline-none text-slate-800 z-10 min-w-0" placeholder="XXXX" value={state.info.registration} onChange={e => setState(s => ({...s, info: {...s.info, registration: e.target.value.toUpperCase()}}))} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block pl-1">检查员 / Inspector</label>
              <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 px-4 py-0.5 focus-within:border-blue-500 transition-all">
                {isAdmin ? <ShieldCheck size={18} className="text-blue-500 mr-3 shrink-0" /> : <User size={18} className="text-slate-400 mr-3 shrink-0" />}
                <input type="text" className="flex-1 bg-transparent py-3.5 font-bold text-base outline-none text-slate-800 min-w-0" placeholder="请输入姓名" value={state.info.inspectorName} onChange={e => setState(s => ({...s, info: {...s.info, inspectorName: e.target.value}}))} />
              </div>
            </div>
            <button disabled={!state.info.registration || !state.info.inspectorName} onClick={() => setStep('inspect')} className={`w-full text-white font-bold py-3.5 rounded-xl text-lg shadow-xl disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 ${isAdmin ? 'bg-indigo-600 shadow-indigo-200' : 'bg-[#007AFF] shadow-blue-200'}`}>
                {isAdmin ? '管理员模式检查' : '开始检查'} <ChevronRight size={20} />
            </button>
          </div>

          <div className="bg-orange-50/60 p-6 rounded-3xl border border-orange-100 text-left w-full flex-1 flex flex-col justify-center">
            <strong className="text-red-600 text-sm font-black uppercase tracking-wider block mb-4 flex items-center gap-2"><AlertTriangle size={16}/> 务必注意 / ATTENTION</strong>
            <div className="space-y-2.5 text-xs text-orange-800 leading-relaxed font-bold opacity-80">
               {INSPECTOR_REQUIREMENTS.map((req, i) => (
                  <p key={i}>{req}</p>
               ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-4 w-full text-center text-[10px] text-slate-300 font-mono z-20">
            Powered By 802711
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
           
           {/* Req 3: Fix Batch Share Button & Split Defect/Review Label */}
           <div className="flex border-t border-slate-100 bg-white">
             <div onClick={() => setFilterMode('all')} className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer text-center ${filterMode === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400'}`}>全部</div>
             <div onClick={() => setFilterMode('pending')} className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer text-center ${filterMode === 'pending' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400'}`}>未检 ({stats.total - (stats.checked)})</div>
             <div onClick={() => setFilterMode('flagged')} className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all relative flex items-center justify-center gap-1 cursor-pointer ${filterMode === 'flagged' ? 'border-red-500' : 'border-transparent'}`}>
                {/* Split Defect / Review Text */}
                <span className={stats.flagged > 0 ? 'text-red-600' : 'text-slate-400'}>缺陷 {stats.flagged}</span>
                <span className="text-slate-300 mx-0.5">/</span>
                <span className={stats.starred > 0 ? 'text-yellow-500' : 'text-slate-400'}>回顾 {stats.starred}</span>
                
                {(stats.flagged > 0 || stats.starred > 0) && filterMode === 'flagged' && (
                    <div 
                       onClick={(e) => { e.stopPropagation(); handleShareIssues(); }}
                       className="ml-2 p-1.5 bg-red-50 text-red-600 rounded-md active:scale-90 transition-transform shadow-sm cursor-pointer hover:bg-red-100"
                    >
                        <Share2 size={12} />
                    </div>
                )}
             </div>
           </div>
        </div>
        
        <div className="flex-1 overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* ... existing tab content code ... */}
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
                             return <CheckItem key={item.id} uniqueId={item.id} label={item.text} requiresInput={item.requiresInput} inputLabel={item.inputLabel} pressureType={item.pressureType} entry={state.session[item.id]} onUpdate={updateSession} info={state.info} sectionTitle={cleanText(section.title)} />;
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
                                                   sectionTitle={cleanText(section.title)}
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
        
        {/* Footer Buttons */}
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
  return null;
}
