
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, AlertTriangle, Camera, ChevronDown, ChevronUp, Image as ImageIcon, Share2, Trash2, X, Wrench, RotateCcw, AlertCircle, History as HistoryIcon, ArrowRight, Star } from 'lucide-react';
import { CheckEntry, ItemStatus, HistoryEntry } from '../types';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

interface Props {
  uniqueId: string;
  label: string;
  subLabel?: string;
  requiresInput?: boolean;
  inputLabel?: string;
  pressureType?: 'number' | 'range';
  entry: CheckEntry | undefined;
  onUpdate: (id: string, updates: Partial<CheckEntry>) => void;
  isSubItem?: boolean;
  info: { registration: string; inspectorName: string; date: string };
}

// Portal Component to fix z-index/transform issues
const PortalModal: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm relative">
        {children}
      </div>
    </div>,
    document.body
  );
};

// Image Preview Modal
const ImagePreviewModal: React.FC<{ src: string | null; onClose: () => void }> = ({ src, onClose }) => {
    if (!src) return null;
    return createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-2 animate-in fade-in duration-200" onClick={onClose}>
            <button className="absolute top-4 right-4 text-white p-2 bg-white/20 rounded-full"><X size={24}/></button>
            <img src={src} className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>,
        document.body
    );
};

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200; 
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); 
        } else {
            reject(new Error("Canvas context failed"));
        }
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export const CheckItem: React.FC<Props> = ({ 
  uniqueId, label, subLabel, requiresInput, inputLabel, pressureType, entry, onUpdate, isSubItem, info
}) => {
  const status: ItemStatus = entry?.status || 'unchecked';
  const isStarred = entry?.isStarred || false;
  const [showTools, setShowTools] = useState(false);
  
  // Modals
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [showRectifyModal, setShowRectifyModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRangeAlert, setShowRangeAlert] = useState(false); // Validation alert
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Temp State for Defect Modal
  const [defectNote, setDefectNote] = useState('');
  const [defectPhotos, setDefectPhotos] = useState<string[]>([]);
  
  // Temp State for Rectify Modal
  const [rectifyMethod, setRectifyMethod] = useState('');
  const [rectifyPhotos, setRectifyPhotos] = useState<string[]>([]);

  const [isSharing, setIsSharing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  
  const defectCameraRef = useRef<HTMLInputElement>(null);
  const rectifyCameraRef = useRef<HTMLInputElement>(null);
  const normalCameraRef = useRef<HTMLInputElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  
  const longPressTimer = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const [isPressing, setIsPressing] = useState(false);
  const longPressTriggered = useRef(false);

  // --- Logic Helpers ---

  const initDefectState = () => {
    setDefectNote(entry?.issueNote || '');
    setDefectPhotos(entry?.issuePhotos || []);
  };

  const initRectifyState = () => {
    setRectifyMethod(entry?.rectification?.method || '');
    setRectifyPhotos(entry?.rectification?.photos || []);
  };

  // --- Handlers ---

  const startLongPress = () => {
    if (status !== 'unchecked') return; 
    
    // Moved validation INSIDE the timeout.
    // This ensures scrolling (which cancels the timeout) doesn't trigger the alert.
    
    longPressTriggered.current = false;
    setIsPressing(true);
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      
      // Validation happens here (after hold duration)
      if (pressureType === 'range' && entry?.value !== 'GREEN') {
         setIsPressing(false);
         setShowRangeAlert(true);
         if (navigator.vibrate) navigator.vibrate(200); // Error vibration
         return;
      }

      handleCommitOk();
      setIsPressing(false);
      if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
    }, 800) as unknown as number;
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsPressing(false);
    touchStartPos.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    startLongPress();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!longPressTimer.current || !touchStartPos.current) return;
    const moveThreshold = 10;
    const diffX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const diffY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (diffX > moveThreshold || diffY > moveThreshold) {
      cancelLongPress();
    }
  };

  const handleMainButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Prevent click processing if long press was just triggered
    if (longPressTriggered.current) {
        longPressTriggered.current = false;
        return;
    }

    if (status === 'unchecked') {
        // Disabled click to check. Long press ONLY.
        // handleCommitOk(); 
    } else if (status === 'flagged') {
        // Click on Flagged -> Go to Rectify
        initRectifyState();
        setShowRectifyModal(true);
    } else if (status === 'ok') {
        // Click on OK -> ALWAYS Reset to unchecked (Cancel mark)
        // Even if it has history, we reset. History is accessible via the text badge.
        onUpdate(uniqueId, { status: 'unchecked', timestamp: null });
        if (navigator.vibrate) navigator.vibrate(30);
    } else if (status === 'na') {
        onUpdate(uniqueId, { status: 'unchecked', timestamp: null });
    }
  };

  const handleCommitOk = () => {
    if (requiresInput && !entry?.value && pressureType === 'number') {
      alert(`请先填写 ${inputLabel || '信息'}`);
      return;
    }
    onUpdate(uniqueId, { status: 'ok', timestamp: new Date().toISOString() });
  };

  const handleStarClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newStarState = !isStarred;
      onUpdate(uniqueId, { isStarred: newStarState });
  };

  // --- Modal Workflow Handlers ---

  const handleMarkDefect = () => {
    // If previously rectified, archive the old one before starting new
    if (entry?.rectification) {
        archiveCurrentToHistory();
    } else {
        initDefectState(); // Load existing if re-opening
    }
    setShowDefectModal(true);
  };

  const handleDefectConfirm = (jumpToRectify: boolean) => {
      onUpdate(uniqueId, {
          status: 'flagged',
          timestamp: new Date().toISOString(),
          issueNote: defectNote,
          issuePhotos: defectPhotos,
          rectification: undefined 
      });
      setShowDefectModal(false);
      
      if (jumpToRectify) {
          setRectifyMethod('');
          setRectifyPhotos([]);
          setTimeout(() => setShowRectifyModal(true), 200);
      }
  };

  const handleRectifySubmit = () => {
      onUpdate(uniqueId, { 
          status: 'ok', 
          // Req 7: Auto star when rectified
          isStarred: true, 
          timestamp: new Date().toISOString(),
          rectification: {
              method: rectifyMethod || '已现场整改',
              photos: rectifyPhotos,
              timestamp: new Date().toISOString()
          }
      });
      setShowRectifyModal(false);
  };

  const handleRevokeDefect = () => {
      if (window.confirm("确定是误报吗？这将清除当前缺陷记录。")) {
          onUpdate(uniqueId, {
              status: 'unchecked',
              timestamp: null,
              issueNote: undefined,
              issuePhotos: [],
              rectification: undefined
          });
          setShowRectifyModal(false);
      }
  };

  const archiveCurrentToHistory = () => {
      if (!entry) return;
      const newHistoryItem: HistoryEntry = {
          id: Date.now().toString(),
          timestamp: entry.timestamp || new Date().toISOString(),
          issueNote: entry.issueNote || '',
          issuePhotos: entry.issuePhotos || [],
          rectification: entry.rectification
      };
      
      const currentHistory = entry.history || [];
      onUpdate(uniqueId, {
          history: [newHistoryItem, ...currentHistory],
          issueNote: '',
          issuePhotos: [],
          rectification: undefined
      });
      setDefectNote('');
      setDefectPhotos([]);
  };

  const handleRangeSelect = (color: string) => {
    let newStatus = status;
    if (color === 'RED' || color === 'YELLOW') {
      newStatus = 'flagged';
      setTimeout(() => handleMarkDefect(), 100);
    } else if (color === 'GREEN') {
      if (status === 'flagged') newStatus = 'unchecked';
    }
    onUpdate(uniqueId, { value: color, status: newStatus, timestamp: new Date().toISOString() });
  };

  // --- Photo Handling ---

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'defect' | 'rectify' | 'normal') => {
    if (e.target.files && e.target.files[0]) {
      setIsCompressing(true);
      try {
        const compressedBase64 = await compressImage(e.target.files[0]);
        if (target === 'defect') {
            setDefectPhotos(prev => [...prev, compressedBase64]);
        } else if (target === 'rectify') {
            setRectifyPhotos(prev => [...prev, compressedBase64]);
        } else if (target === 'normal') {
            onUpdate(uniqueId, { photos: [...(entry?.photos || []), compressedBase64] });
        }
      } catch (error) {
        alert("图片处理失败");
      } finally {
        setIsCompressing(false);
        if (e.target) e.target.value = '';
      }
    }
  };

  const removeNormalPhoto = (idx: number) => {
    if (!entry?.photos) return;
    const newPhotos = entry.photos.filter((_, i) => i !== idx);
    onUpdate(uniqueId, { photos: newPhotos });
  };

  // --- Share Logic ---
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

  const handleShareDefect = async () => {
    if (!shareCardRef.current) return;
    setIsSharing(true);
    const card = shareCardRef.current;
    card.style.display = 'block';

    try {
        await waitForImages(card);
        await new Promise(resolve => setTimeout(resolve, 300));
        const canvas = await html2canvas(card, { scale: 2.0, useCORS: true, backgroundColor: '#f8fafc' });
        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const filename = `Defect_${uniqueId}_B-${info.registration}.jpg`;
            const file = new File([blob], filename, { type: 'image/jpeg' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: `缺陷报告: ${label}`,
                        text: `缺陷报告 B-${info.registration}: ${label}`
                    });
                } catch (e) {}
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
            setIsSharing(false);
            card.style.display = 'none';
        }, 'image/jpeg', 0.85);
    } catch (e) {
        setIsSharing(false);
        card.style.display = 'none';
        alert("生成分享图片失败");
    }
  };

  const getStatusStyles = () => {
    switch(status) {
      case 'ok': return 'bg-emerald-500 text-white border-emerald-600 shadow-sm';
      case 'flagged': return 'bg-red-600 text-white border-red-700 shadow-sm';
      case 'na': return 'bg-slate-500 text-white border-slate-600 shadow-sm';
      default: return 'bg-white text-slate-100 border-slate-100';
    }
  };

  const getBorderColor = () => {
    switch(status) {
      case 'ok': 
      case 'na': return 'border-emerald-500 bg-emerald-50/20';
      case 'flagged': return 'border-red-500 bg-red-50';
      default: return 'border-blue-500 bg-white';
    }
  };

  const hasHistory = (entry?.history && entry.history.length > 0) || entry?.rectification;

  return (
    <>
      <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />
      
      {showRangeAlert && (
          <PortalModal onClose={() => setShowRangeAlert(false)}>
            <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-xs text-center animate-in zoom-in duration-200">
               <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle size={32} />
               </div>
               <div className="text-lg font-bold text-slate-800 mb-6 leading-relaxed">
                 请先标记作动筒气瓶范围为<br/><span className="text-emerald-500 font-black text-2xl">绿色</span>
               </div>
               <button onClick={() => setShowRangeAlert(false)} className="w-full bg-slate-100 py-3 rounded-xl font-bold text-slate-600 active:bg-slate-200 transition-colors">知道了</button>
            </div>
          </PortalModal>
      )}

      <div className={`relative transition-all duration-300 overflow-hidden ${isSubItem ? 'rounded-xl border shadow-sm' : 'mb-4 rounded-2xl border-l-[6px] shadow-sm'} ${getBorderColor()}`}>
        <div className={`flex items-stretch ${isSubItem ? 'min-h-[4.5rem]' : 'min-h-[5rem]'}`}>
          
          {/* Content Area */}
          <div 
            onMouseDown={(e) => { e.stopPropagation(); startLongPress(); }}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={cancelLongPress}
            className={`flex-1 p-3.5 pl-4 flex items-center select-none transition-colors relative
              ${isPressing ? 'bg-emerald-50' : ''}`}
          >
            {isPressing && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />}
            
            <div className="flex-1 flex flex-col justify-center gap-1.5">
               {subLabel && <span className="inline-block self-start px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-200 text-slate-500 uppercase tracking-tight">{subLabel}</span>}
               
               <div className={`font-bold leading-tight transition-colors ${isSubItem ? 'text-sm' : 'text-[16px]'} ${status === 'ok' || status === 'na' ? 'text-emerald-900' : status === 'flagged' ? 'text-red-900' : 'text-slate-800'}`}>
                 {label}
               </div>

               {/* Interaction Badges Row */}
               <div 
                 className="flex items-center flex-wrap gap-2 mt-1" 
                 onClick={e => e.stopPropagation()}
                 onMouseDown={e => e.stopPropagation()}
                 onTouchStart={e => e.stopPropagation()}
               >
                  
                  {/* Status Badges - Review Badge Moved to First */}
                  {isStarred && (
                      <button onClick={handleStarClick} className="flex items-center gap-1 px-2 py-1 rounded-md border border-yellow-200 bg-yellow-50 text-yellow-600 text-[10px] font-bold">
                          <Star size={10} fill="currentColor" /> 待回顾
                      </button>
                  )}

                  {status === 'flagged' && (
                      <button onClick={() => { initDefectState(); setShowDefectModal(true); }} className="flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-600 text-[10px] font-bold animate-pulse-red-bg">
                          <AlertCircle size={10} /> 查看缺陷
                      </button>
                  )}

                  {status === 'ok' && hasHistory && (
                      <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                          <HistoryIcon size={10} /> 已整改
                      </button>
                  )}

                  {/* Normal Record Indicators */}
                  {entry?.photos?.length ? (
                     <div className="flex items-center text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                       <ImageIcon size={10} className="mr-1" /> {entry.photos.length}张照片
                     </div>
                   ) : null}
                   
                   {entry?.note && <div className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">备注</div>}
                   
                   {/* Inputs */}
                   {requiresInput && pressureType === 'number' && (
                      <div className="flex items-center border border-slate-200 rounded overflow-hidden h-6 bg-white ml-1">
                        <input 
                          type="number" 
                          inputMode="numeric"
                          placeholder="0"
                          className="w-10 text-center font-bold text-xs text-slate-800 outline-none bg-transparent h-full"
                          value={entry?.value || ''}
                          onChange={(e) => onUpdate(uniqueId, { value: e.target.value })}
                        />
                        <span className="bg-slate-100 text-[8px] font-bold text-slate-500 px-1 h-full flex items-center">{inputLabel || 'PSI'}</span>
                      </div>
                   )}
                   {pressureType === 'range' && (
                      <div className="flex gap-2 ml-1 justify-center">
                         {['RED', 'YELLOW', 'GREEN'].map(c => (
                           <button 
                             key={c}
                             onClick={() => handleRangeSelect(c)}
                             className={`w-10 h-6 rounded-md border-2 transition-all shadow-sm ${entry?.value === c ? 'border-slate-800 scale-110 shadow-md ring-2 ring-white' : 'border-transparent opacity-40'} ${c==='RED'?'bg-red-500':c==='YELLOW'?'bg-yellow-400':'bg-emerald-500'}`}
                           />
                         ))}
                      </div>
                   )}
               </div>
            </div>
          </div>

          {/* Right Control Area */}
          <div className={`flex flex-col items-center justify-between p-1.5 bg-slate-50/40 border-l border-slate-100/50 ${isSubItem ? 'w-16' : 'w-20'}`}>
              <button 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={cancelLongPress}
                onMouseDown={startLongPress}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onClick={handleMainButtonClick}
                className={`w-full flex-1 rounded-[14px] flex flex-col items-center justify-center transition-all relative overflow-hidden active:scale-95 select-none touch-none border
                  ${getStatusStyles()}
                  ${isPressing ? 'scale-110 bg-emerald-100 border-emerald-300' : ''}
                  ${(pressureType === 'range' && entry?.value !== 'GREEN' && status === 'unchecked') ? 'opacity-30' : ''}`}
              >
                  {isPressing && <div className="absolute inset-0 bg-emerald-500/20 animate-pulse" />}
                  
                  {status === 'na' ? (
                    <span className="font-black text-[12px] leading-none">N/A</span>
                  ) : status === 'flagged' ? (
                    <AlertTriangle strokeWidth={3} size={isSubItem ? 22 : 28} />
                  ) : (
                    <Check strokeWidth={4} size={isSubItem ? 22 : 28} className={isPressing ? 'text-emerald-600' : ''} />
                  )}
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); setShowTools(!showTools); }}
                className={`mt-1.5 w-full h-5 rounded-md flex items-center justify-center transition-all border border-slate-200/50 shadow-sm active:scale-90 bg-white
                  ${showTools ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-400'}`}
              >
                  {showTools ? <ChevronUp size={10} strokeWidth={4} /> : <ChevronDown size={10} strokeWidth={4} />}
              </button>
          </div>
        </div>

        {/* Dropdown Tools */}
        {showTools && (
          <div className="bg-slate-50/90 backdrop-blur-sm border-t border-slate-200/50 p-4 animate-in slide-in-from-top-2 duration-200">
            
            {/* Control Grid */}
            <div className={`grid gap-2 mb-4 ${isSubItem ? 'grid-cols-2' : 'grid-cols-4'}`}>
               
               {/* 1. N/A */}
               <button 
                 onClick={() => {
                   const isNA = status === 'na';
                   onUpdate(uniqueId, { status: isNA ? 'unchecked' : 'na', timestamp: isNA ? null : new Date().toISOString() });
                 }}
                 className={`h-11 rounded-xl font-black text-xs border-2 transition-all active:scale-95 shadow-sm flex items-center justify-center
                   ${status === 'na' ? 'bg-slate-500 text-white border-slate-600' : 'bg-white text-slate-400 border-slate-200'}`}
               >
                 N/A
               </button>

               {/* 2. Camera (Normal) */}
               {isSubItem && (
                   <button 
                     onClick={() => normalCameraRef.current?.click()}
                     className={`h-11 rounded-xl font-black flex items-center justify-center border-2 transition-all active:scale-95 shadow-sm
                        ${(entry?.photos?.length || 0) > 0 ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-blue-400 border-blue-200'}`}
                   >
                     <Camera size={20} />
                     {(entry?.photos?.length || 0) > 0 && <span className="ml-1 text-xs">{entry?.photos.length}</span>}
                   </button>
               )}

               {/* 3. Star (Review) */}
               <button 
                 onClick={handleStarClick}
                 className={`h-11 rounded-xl font-black flex items-center justify-center border-2 transition-all active:scale-95 shadow-sm
                   ${isStarred ? 'bg-yellow-400 text-white border-yellow-500' : 'bg-white text-yellow-400 border-yellow-200'}`}
               >
                 <Star size={20} fill={isStarred ? "currentColor" : "none"} />
               </button>

               {/* 4. Defect (Flagged) */}
               {status === 'flagged' ? (
                   <button 
                     onClick={() => { initRectifyState(); setShowRectifyModal(true); }}
                     className="h-11 rounded-xl font-black text-xs border-2 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1.5 bg-red-600 text-white border-red-700"
                   >
                     <RotateCcw size={14} /> 撤销
                   </button>
               ) : (
                   <button 
                     onClick={handleMarkDefect}
                     className="h-11 rounded-xl font-black text-xs border-2 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1.5 bg-white text-red-600 border-red-200"
                   >
                     <AlertTriangle size={14} /> 缺陷
                   </button>
               )}

               {/* 5. Camera (Normal) - for Single Item layout it is 4th item */}
               {!isSubItem && (
                   <button 
                     onClick={() => normalCameraRef.current?.click()}
                     className={`h-11 rounded-xl font-black flex items-center justify-center border-2 transition-all active:scale-95 shadow-sm
                        ${(entry?.photos?.length || 0) > 0 ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-blue-400 border-blue-200'}`}
                   >
                     <Camera size={20} />
                     {(entry?.photos?.length || 0) > 0 && <span className="ml-1 text-xs">{entry?.photos.length}</span>}
                   </button>
               )}
            </div>

            {/* Normal Photos Preview - Req 2: Added pt-3 pr-3 to fix cutoff, changed button to red */}
            {(entry?.photos && entry.photos.length > 0) && (
                <div className="flex gap-2 overflow-x-auto mb-3 pb-1 pt-3 pr-3">
                    {entry.photos.map((p, i) => (
                        <div key={i} className="relative w-16 h-16 shrink-0">
                            <img src={p} className="w-full h-full object-cover rounded-lg border border-slate-200" onClick={() => setPreviewImage(p)} />
                             <button onClick={() => removeNormalPhoto(i)} 
                                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md z-10">
                                <X size={12}/>
                              </button>
                        </div>
                    ))}
                </div>
            )}

            <textarea
              placeholder="正常检查备注 (留底)..."
              className="w-full text-sm p-4 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none resize-none bg-white font-bold text-slate-700 shadow-inner"
              rows={2}
              value={entry?.note || ''}
              onChange={(e) => onUpdate(uniqueId, { note: e.target.value })}
            />
            <input type="file" ref={normalCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, 'normal')} />
          </div>
        )}
      </div>

      {/* --- MODAL 1: SUBMIT DEFECT (提交缺陷) --- */}
      {showDefectModal && (
          <PortalModal onClose={() => setShowDefectModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-full shadow-2xl animate-in zoom-in duration-200 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="w-6 h-6" fill="currentColor" />
                          <h3 className="text-xl font-bold text-slate-900">提交缺陷</h3>
                      </div>
                      <button onClick={() => setShowDefectModal(false)} className="p-1 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
                  </div>
                  
                  {/* Defect Description */}
                  <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">缺陷描述</label>
                      <textarea 
                          className="w-full h-24 p-3 border-2 border-slate-200 rounded-xl focus:border-red-500 outline-none text-slate-800 font-medium resize-none bg-slate-50"
                          placeholder="描述发现的缺陷..."
                          value={defectNote}
                          onChange={e => setDefectNote(e.target.value)}
                      />
                  </div>

                  {/* Defect Photos */}
                  <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">缺陷照片</label>
                      {/* Req 2: Updated padding for X button overflow */}
                      <div className="flex gap-3 mb-2 overflow-x-auto pt-5 pr-5 pl-1 pb-1">
                          {defectPhotos.map((p, i) => (
                              <div key={i} className="relative w-16 h-16 shrink-0">
                                  <img src={p} className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-sm" onClick={() => setPreviewImage(p)} />
                                  <button onClick={() => setDefectPhotos(prev => prev.filter((_, idx) => idx !== i))} 
                                      className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md z-10 active:scale-95 transition-transform">
                                    <X size={14}/>
                                  </button>
                              </div>
                          ))}
                          <button onClick={() => defectCameraRef.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-red-300 flex items-center justify-center text-red-400 shrink-0 active:bg-red-50">
                              <Camera size={20} />
                          </button>
                      </div>
                  </div>

                  {/* Req 1 & 5: Updated Layout and Rectify Button Style (Green/White) */}
                  <div className="flex gap-2 mt-2">
                       <button onClick={() => handleDefectConfirm(true)} className="flex-[1] py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-1 text-xs active:bg-emerald-700 shadow-md">
                          <Wrench size={14} /> 前往整改
                       </button>
                       <button onClick={handleShareDefect} className="flex-[1] py-3 bg-blue-50 text-blue-600 border border-blue-100 font-bold rounded-xl flex items-center justify-center gap-1 text-xs active:bg-blue-100">
                          {isSharing ? <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full"/> : <><Share2 size={14}/> 分享</>}
                       </button>
                       <button onClick={() => handleDefectConfirm(false)} className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center gap-1 active:scale-95 transition-transform">
                          <AlertCircle size={16} /> 确认提交
                       </button>
                  </div>
                  
                  <input type="file" ref={defectCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, 'defect')} />
              </div>
          </PortalModal>
      )}

      {/* --- MODAL 2: RECTIFICATION (整改措施) --- */}
      {showRectifyModal && (
          <PortalModal onClose={() => setShowRectifyModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-full shadow-2xl animate-in zoom-in duration-200 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 text-emerald-600">
                          <Wrench className="w-6 h-6" />
                          <h3 className="text-xl font-bold text-slate-900">整改措施</h3>
                      </div>
                      <button onClick={() => setShowRectifyModal(false)} className="p-1 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
                  </div>

                  {/* Original Defect Display */}
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-sm">
                      <div className="font-bold text-[10px] uppercase text-red-400 mb-1">原始缺陷</div>
                      <div className="text-red-800 mb-2">{entry?.issueNote || defectNote || '无描述'}</div>
                      {(entry?.issuePhotos || defectPhotos).length > 0 && (
                          <div className="flex gap-2 overflow-x-auto">
                              {(entry?.issuePhotos || defectPhotos).map((p, i) => (
                                  <img key={i} src={p} className="w-12 h-12 object-cover rounded border border-red-200" onClick={() => setPreviewImage(p)}/>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">整改方案</label>
                      <textarea 
                          className="w-full h-24 p-3 border-2 border-slate-200 rounded-xl focus:border-emerald-500 outline-none text-slate-800 font-medium resize-none"
                          placeholder="描述如何解决的 (默认: 已现场整改)..."
                          value={rectifyMethod}
                          onChange={e => setRectifyMethod(e.target.value)}
                      />
                  </div>

                  <div>
                      <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">整改照片</label>
                      {/* Req 2: Updated padding for X button overflow */}
                      <div className="flex gap-3 mb-2 overflow-x-auto pt-5 pr-5 pl-1 pb-1">
                          {rectifyPhotos.map((p, i) => (
                              <div key={i} className="relative w-16 h-16 shrink-0">
                                  <img src={p} className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-sm" onClick={() => setPreviewImage(p)} />
                                  <button onClick={() => setRectifyPhotos(prev => prev.filter((_, idx) => idx !== i))} 
                                      className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md z-10 active:scale-95 transition-transform">
                                    <X size={14}/>
                                  </button>
                              </div>
                          ))}
                          <button onClick={() => rectifyCameraRef.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-emerald-300 flex items-center justify-center text-emerald-400 shrink-0 active:bg-emerald-50">
                              <Camera size={20} />
                          </button>
                      </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-2">
                      <button onClick={handleRectifySubmit} className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200">
                          确认已解决
                      </button>
                      <button onClick={handleRevokeDefect} className="py-2 text-xs font-bold text-slate-400 flex items-center justify-center gap-1 hover:text-red-500 transition-colors bg-slate-50 rounded-lg">
                          <RotateCcw size={12}/> 撤销缺陷 (误报)
                      </button>
                  </div>
                  <input type="file" ref={rectifyCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, 'rectify')} />
              </div>
          </PortalModal>
      )}

      {/* --- MODAL 3: HISTORY (Req 6) --- */}
      {showHistoryModal && (
          <PortalModal onClose={() => setShowHistoryModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-full shadow-2xl animate-in zoom-in duration-200 flex flex-col gap-4 max-h-[80vh]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 text-slate-800">
                          <HistoryIcon className="w-6 h-6" />
                          <h3 className="text-xl font-bold text-slate-900">检查记录历史</h3>
                      </div>
                      <button onClick={() => setShowHistoryModal(false)} className="p-1 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                      {/* Current Active Record */}
                      {(entry?.rectification || status === 'flagged') && (
                          <div className="border-2 border-slate-200 rounded-xl p-3 bg-white">
                               <div className="flex justify-between items-center mb-2">
                                   <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">当前状态</span>
                                   {/* Req 6: HH:mm */}
                                   <span className="text-xs text-slate-400">{entry.timestamp ? format(new Date(entry.timestamp), 'HH:mm') : ''}</span>
                               </div>
                               {/* Req 6: Translate Issue to 发现缺陷, and timestamp to HH:mm */}
                               <div className="text-sm font-bold text-slate-800 mb-1">发现缺陷: <span className="text-red-600">{entry.issueNote || '无描述'}</span></div>
                               {entry.issuePhotos.length > 0 && (
                                   <div className="flex gap-2 overflow-x-auto mb-2">
                                       {entry.issuePhotos.map((p, i) => <img key={i} src={p} className="w-12 h-12 object-cover rounded border" onClick={() => setPreviewImage(p)}/>)}
                                   </div>
                               )}
                               {entry.rectification && (
                                   <div className="text-sm font-bold text-slate-800 mt-2 pt-2 border-t border-slate-100">
                                       整改措施: <span className="text-emerald-600">{entry.rectification.method}</span>
                                       {entry.rectification.photos.length > 0 && (
                                           <div className="flex gap-2 overflow-x-auto mt-1">
                                               {entry.rectification.photos.map((p, i) => <img key={i} src={p} className="w-12 h-12 object-cover rounded border" onClick={() => setPreviewImage(p)}/>)}
                                           </div>
                                       )}
                                   </div>
                               )}
                          </div>
                      )}

                      {/* History List */}
                      {entry?.history?.map((h, i) => (
                          <div key={i} className="border border-slate-100 rounded-xl p-3 bg-slate-50 opacity-80">
                               <div className="flex justify-between items-center mb-2">
                                   <span className="bg-slate-200 text-slate-500 px-2 py-0.5 rounded text-xs font-bold">历史记录 #{entry.history!.length - i}</span>
                                   {/* Req 6: HH:mm */}
                                   <span className="text-xs text-slate-400">{h.timestamp ? format(new Date(h.timestamp), 'HH:mm') : ''}</span>
                               </div>
                               <div className="text-xs text-slate-600 mb-1"><span className="font-bold">发现缺陷:</span> {h.issueNote || '无描述'}</div>
                               <div className="flex gap-1 overflow-x-auto mb-1">
                                   {h.issuePhotos.map((p, x) => <img key={x} src={p} className="w-8 h-8 object-cover rounded" onClick={() => setPreviewImage(p)}/>)}
                               </div>
                               <div className="text-xs text-slate-600"><span className="font-bold">整改:</span> {h.rectification?.method}</div>
                          </div>
                      ))}
                  </div>

                  <div className="pt-2">
                      <button 
                        onClick={() => { setShowHistoryModal(false); setTimeout(() => handleMarkDefect(), 200); }} 
                        className="w-full py-3 bg-red-50 text-red-600 border border-red-100 font-bold rounded-xl flex items-center justify-center gap-2"
                      >
                         <AlertTriangle size={16} /> 再次标记缺陷
                      </button>
                  </div>
              </div>
          </PortalModal>
      )}

      {/* --- HIDDEN SHARE CARD (For Single Defect Share) --- */}
      <div ref={shareCardRef} style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '600px', zIndex: -1 }}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-red-600 px-6 py-5 flex items-center justify-between">
                 <div className="text-white">
                     <h2 className="text-2xl font-black">发现缺陷报告</h2>
                     <p className="text-sm font-bold opacity-80 uppercase tracking-wider">Defect Report</p>
                 </div>
                 <div className="text-right text-white">
                     <div className="text-3xl font-black font-mono">B-{info.registration}</div>
                     <div className="text-xs font-bold opacity-80">{info.date}</div>
                 </div>
             </div>
             <div className="p-6">
                 <div className="border-l-4 border-red-500 bg-red-50/50 p-4 rounded-r-xl">
                     <div className="flex justify-between items-start mb-2">
                         <div className="font-bold text-slate-900 text-lg pr-4">
                             {label} {subLabel && <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-sm">{subLabel}</span>}
                         </div>
                     </div>
                     <div className="text-red-800 font-medium mb-3">{defectNote || '无详细描述'}</div>
                     {defectPhotos.length > 0 && (
                         <div className="flex flex-col gap-4 mt-3">
                             {defectPhotos.map((p, pIdx) => (
                                 <img key={pIdx} src={p} className="w-full h-auto object-contain rounded-lg border border-red-100 bg-white shadow-sm" style={{maxWidth: '100%', maxHeight: '400px'}} />
                             ))}
                         </div>
                     )}
                 </div>
             </div>
             <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                Inspector: {info.inspectorName}
             </div>
          </div>
      </div>

    </>
  );
};
