import React, { useState, useRef } from 'react';
import { Check, AlertTriangle, Camera, ChevronDown, ChevronUp, Image as ImageIcon, Share2, Trash2, X } from 'lucide-react';
import { CheckEntry, ItemStatus } from '../types';
import html2canvas from 'html2canvas';

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

// 图片压缩工具函数
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // 提升分辨率限制：从 1024 -> 1600，保证照片细节
        let width = img.width;
        let height = img.height;
        const maxDimension = 1600;

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
            ctx.fillStyle = '#FFFFFF'; // 防止透明背景变黑
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            // 提升压缩质量：从 0.6 -> 0.8，减少照片本身的噪点
            resolve(canvas.toDataURL('image/jpeg', 0.8));
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
  const [showTools, setShowTools] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false); // 压缩状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  // --- 核心逻辑 ---

  const startLongPress = () => {
    if (status !== 'unchecked') return; 
    
    if (pressureType === 'range' && entry?.value !== 'GREEN') {
      if (navigator.vibrate) navigator.vibrate(100);
      return;
    }

    setIsPressing(true);
    longPressTimer.current = window.setTimeout(() => {
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
    
    // 如果移动超过 10px，则认为是滑动，取消长按
    const moveThreshold = 10;
    const diffX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const diffY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    
    if (diffX > moveThreshold || diffY > moveThreshold) {
      cancelLongPress();
    }
  };

  const handleMainButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status !== 'unchecked') {
      if (status === 'flagged' && pressureType === 'range' && entry?.value !== 'GREEN' && entry?.value) {
        alert("检测到气压异常，请先将压力标记为 GREEN 后再取消标记。");
        return;
      }
      onUpdate(uniqueId, { status: 'unchecked', timestamp: null });
      if (navigator.vibrate) navigator.vibrate(30);
    }
  };

  const handleCommitOk = () => {
    if (requiresInput && !entry?.value && pressureType === 'number') {
      alert(`请先填写 ${inputLabel || '信息'}`);
      return;
    }
    onUpdate(uniqueId, { status: 'ok', timestamp: new Date().toISOString() });
  };

  const handleRangeSelect = (color: string) => {
    let newStatus = status;
    if (color === 'RED' || color === 'YELLOW') {
      newStatus = 'flagged';
    } else if (color === 'GREEN') {
      if (status === 'flagged') newStatus = 'unchecked';
    }
    onUpdate(uniqueId, { value: color, status: newStatus, timestamp: new Date().toISOString() });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsCompressing(true);
      try {
        // 使用压缩函数处理图片
        const compressedBase64 = await compressImage(e.target.files[0]);
        const currentPhotos = entry?.photos || [];
        onUpdate(uniqueId, { photos: [...currentPhotos, compressedBase64] });
      } catch (error) {
        console.error("Image compression failed:", error);
        alert("图片处理失败，请重试");
      } finally {
        setIsCompressing(false);
        if (e.target) e.target.value = ''; // 重置 input
      }
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (window.confirm('删除这张照片?')) {
      const currentPhotos = entry?.photos || [];
      const newPhotos = currentPhotos.filter((_, i) => i !== index);
      onUpdate(uniqueId, { photos: newPhotos });
    }
  };

  // 等待图片加载 helper
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

  const handleShareItem = async () => {
    if (!shareCardRef.current) return;
    setIsSharing(true);
    
    // 临时显示隐藏的 div 以便渲染
    shareCardRef.current.style.display = 'block';

    try {
        // 确保所有图片加载完毕
        await waitForImages(shareCardRef.current);
        // 额外等待一下渲染
        await new Promise(resolve => setTimeout(resolve, 300));

        const canvas = await html2canvas(shareCardRef.current, {
            scale: 2.0, // 提升单项分享清晰度
            useCORS: true,
            backgroundColor: '#f8fafc' // 使用浅灰色背景
        });

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const filename = `Issue_${uniqueId}_B-${info.registration}.jpg`; // 改为 jpg
            const file = new File([blob], filename, { type: 'image/jpeg' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: `Finding Report: ${label}`,
                        text: `Finding reported on B-${info.registration}: ${label}`
                    });
                } catch (e) {
                    // 用户取消分享
                }
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
            setIsSharing(false);
            shareCardRef.current!.style.display = 'none'; // 恢复隐藏
        }, 'image/jpeg', 0.85); // 提升单项分享质量到 0.85
    } catch (e) {
        console.error(e);
        setIsSharing(false);
        shareCardRef.current!.style.display = 'none';
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
      default: return 'border-blue-500 bg-white'; // Default to blue to match multi-item cards
    }
  };

  const canManualToggleFlag = pressureType === 'range' ? (entry?.value === 'GREEN' || !entry?.value) : true;

  return (
    <div className={`relative transition-all duration-300 overflow-hidden ${isSubItem ? 'rounded-xl border shadow-sm' : 'mb-4 rounded-2xl border-l-[6px] shadow-sm'} ${getBorderColor()}`}>
      <div className={`flex items-stretch ${isSubItem ? 'min-h-[4.5rem]' : 'min-h-[5rem]'}`}>
        
        {/* 内容显示区 */}
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
          
          <div className="flex-1 flex items-center justify-between gap-2">
            <div className="flex-1">
               {subLabel && <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-200 text-slate-500 mb-1 uppercase tracking-tight">{subLabel}</span>}
               <div className={`font-bold leading-tight transition-colors ${isSubItem ? 'text-sm' : 'text-[16px]'} ${status === 'ok' || status === 'na' ? 'text-emerald-900' : status === 'flagged' ? 'text-red-900' : 'text-slate-800'}`}>
                 {label}
               </div>

               {((entry?.photos?.length || 0) > 0 || entry?.issueNote) && (
                 <div className="flex items-center gap-2 mt-1.5">
                   {entry?.photos?.length ? (
                     <div className="flex items-center text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                       <ImageIcon size={10} className="mr-1" /> {entry.photos.length}P
                     </div>
                   ) : null}
                   {entry?.issueNote && <div className="text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 uppercase">Note</div>}
                 </div>
               )}
            </div>

            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {requiresInput && pressureType === 'number' && (
                <div className="flex flex-col items-center justify-center bg-white border-2 border-slate-100 rounded-xl overflow-hidden focus-within:border-blue-400 transition-all shadow-sm h-11 w-14">
                  <input 
                    type="number" 
                    inputMode="numeric"
                    placeholder="0"
                    className="w-full flex-1 text-center font-black text-sm text-slate-700 outline-none bg-transparent pt-1"
                    value={entry?.value || ''}
                    onChange={(e) => onUpdate(uniqueId, { value: e.target.value })}
                  />
                  <span className="w-full h-4 flex items-center justify-center bg-slate-50 text-[8px] font-black text-slate-400 border-t border-slate-100 leading-none pb-0.5">PSI</span>
                </div>
              )}

              {pressureType === 'range' && (
                <div className="flex flex-row gap-1.5 px-1 py-1.5 bg-slate-100/50 rounded-xl">
                   {['RED', 'YELLOW', 'GREEN'].map(c => (
                     <button 
                       key={c}
                       onClick={() => handleRangeSelect(c)}
                       className={`w-5 h-8 rounded-full border transition-all active:scale-90 
                         ${entry?.value === c ? 'border-slate-900 scale-110 shadow-sm opacity-100' : 'border-transparent opacity-30'} 
                         ${c==='RED'?'bg-red-500':c==='YELLOW'?'bg-yellow-400':'bg-emerald-500'}`}
                     />
                   ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧交互控制区 */}
        <div className={`flex flex-col items-center justify-between p-1.5 bg-slate-50/40 border-l border-slate-100/50 ${isSubItem ? 'w-16' : 'w-20'}`}>
            <button 
              onClick={handleMainButtonClick}
              onMouseDown={(e) => { e.stopPropagation(); startLongPress(); }}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={cancelLongPress}
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

                {status === 'unchecked' && (
                  <span className="text-[6px] font-black absolute bottom-0.5 uppercase opacity-50 tracking-tighter">Hold</span>
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

      {/* 展开的工具面板 */}
      {showTools && (
        <div className="bg-slate-50/90 backdrop-blur-sm border-t border-slate-200/50 p-4 animate-in slide-in-from-top-2 duration-200">
          
          {/* 照片展示区 */}
          {entry?.photos && entry.photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
              {entry.photos.map((p, i) => (
                <div key={i} className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm group">
                  <img src={p} className="w-full h-full object-cover" />
                  <button onClick={() => handleRemovePhoto(i)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-80 hover:opacity-100">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
             <button 
               onClick={() => {
                 const isNA = status === 'na';
                 onUpdate(uniqueId, { status: isNA ? 'unchecked' : 'na', timestamp: isNA ? null : new Date().toISOString() });
               }}
               className={`h-11 flex-1 rounded-xl font-black text-xs border-2 transition-all active:scale-95 shadow-sm
                 ${status === 'na' ? 'bg-slate-500 text-white border-slate-600' : 'bg-white text-slate-400 border-slate-200'}`}
             >
               N/A
             </button>

             <button 
               onClick={() => {
                 if (canManualToggleFlag) {
                   onUpdate(uniqueId, { status: status === 'flagged' ? 'unchecked' : 'flagged', timestamp: status === 'flagged' ? null : new Date().toISOString() });
                 } else {
                   alert("检测到气压异常，请先将压力标记为 GREEN 后再取消问题标记。");
                 }
               }}
               className={`h-11 flex-[1.2] rounded-xl font-black text-xs border-2 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1.5
                 ${status === 'flagged' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-orange-600 border-orange-200'}`}
             >
               <AlertTriangle size={14} /> {status === 'flagged' ? '取消问题' : '标记问题'}
             </button>

             <button 
               onClick={() => fileInputRef.current?.click()} 
               className={`h-11 w-11 bg-white border border-slate-200 rounded-xl flex items-center justify-center active:bg-blue-50 shadow-sm ${isCompressing ? 'opacity-50' : 'text-blue-600'}`}
               disabled={isCompressing}
             >
               {isCompressing ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/> : <Camera size={20} />}
             </button>

             {/* 分享按钮 */}
             {(status === 'flagged' || (entry?.photos?.length || 0) > 0 || entry?.issueNote) && (
               <button 
                 onClick={handleShareItem} 
                 className="h-11 w-11 bg-blue-50 border border-blue-200 rounded-xl text-blue-600 flex items-center justify-center active:scale-95 shadow-sm"
               >
                 {isSharing ? <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/> : <Share2 size={20} />}
               </button>
             )}
          </div>

          <textarea
            placeholder="备注故障或详细信息..."
            className="w-full text-sm p-4 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none resize-none bg-white font-bold text-slate-700 shadow-inner"
            rows={2}
            value={entry?.issueNote || ''}
            onChange={(e) => onUpdate(uniqueId, { issueNote: e.target.value })}
          />
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handlePhotoUpload} />
        </div>
      )}

      {/* 隐藏的分享卡片 DOM 结构 - 使用 display: none 默认隐藏，生成时临时显示 */}
      <div 
        ref={shareCardRef} 
        style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: '600px', backgroundColor: '#f8fafc', padding: '30px', borderRadius: '16px', zIndex: -1 }}
      >
        <div className="border-b-4 border-slate-900 pb-4 mb-6 flex items-end justify-between">
           <div>
               <h2 className="text-3xl font-black text-slate-900 leading-none">发现报告</h2>
               <div className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">FINDING REPORT</div>
           </div>
        </div>
        
        <div className="flex justify-between bg-white p-5 rounded-2xl border border-slate-200 mb-8 shadow-sm">
           <div><div className="text-xs font-bold text-slate-400 uppercase mb-1">注册号 REG</div><div className="text-2xl font-black text-slate-900 font-mono">B-{info.registration}</div></div>
           <div><div className="text-xs font-bold text-slate-400 uppercase mb-1">检查员 INSPECTOR</div><div className="text-2xl font-bold text-slate-900">{info.inspectorName}</div></div>
           <div className="text-right"><div className="text-xs font-bold text-slate-400 uppercase mb-1">日期 DATE</div><div className="text-2xl font-mono font-bold text-slate-900">{info.date}</div></div>
        </div>

        {/* 醒目的条目卡片设计 */}
        <div className="bg-white border-l-[16px] border-red-500 pl-8 py-6 mb-8 rounded-r-3xl shadow-xl border-y border-r border-slate-200">
           {subLabel && (
             <div className="mb-4">
                <span className="inline-block bg-slate-900 text-white text-2xl font-black px-5 py-2 rounded-xl shadow-md uppercase">
                    {subLabel}
                </span>
             </div>
           )}
           <div className="text-3xl font-black text-slate-900 leading-tight">{label}</div>
           {status === 'flagged' && (
               <div className="mt-5 inline-flex items-center gap-3 bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-sm border border-red-200">
                   <AlertTriangle size={20} fill="currentColor" />
                   <span>Issue Identified 已发现问题</span>
               </div>
           )}
        </div>

        {entry?.issueNote && (
          <div className="mb-8 px-2">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-yellow-400 rounded-full"></div>
                <div className="text-sm font-bold text-slate-400 uppercase">备注 / Note</div>
            </div>
            <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-200 text-xl font-medium text-slate-800 leading-relaxed shadow-sm">
               {entry.issueNote}
            </div>
          </div>
        )}

        {entry?.photos && entry.photos.length > 0 && (
          <div className="px-2">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                 <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                 <div className="text-sm font-bold text-slate-400 uppercase">现场照片 / Photos ({entry.photos.length})</div>
            </div>
            <div className="flex flex-col gap-6">
              {entry.photos.map((p, i) => (
                <div key={i} className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-white relative">
                  {/* 图片以块级元素显示，宽度100% */}
                  <img src={p} className="w-full h-auto block" />
                  <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-bold">
                      照片 Photo {i+1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 卡片底部水印 */}
        <div className="mt-10 pt-6 border-t-2 border-slate-200 flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wide">
             <span>Aircraft Final Inspection App</span>
             <span>生成时间 Generated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};