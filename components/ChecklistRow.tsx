import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, Flag, Camera, X, AlertCircle, ImagePlus, CheckCircle, Trash2, RotateCw } from 'lucide-react';
import { ChecklistItemConfig } from '../types';
import { format } from 'date-fns';

interface ItemState {
  isChecked?: boolean;
  isNA?: boolean;
  isFlagged?: boolean;
  inputValue?: string;
  issueNote?: string;
  evidencePhotos?: string[];
  issuePhotos?: string[];
}

interface Props {
  config: ChecklistItemConfig;
  state: ItemState | undefined;
  subStates: Record<string, ItemState>;
  onToggle: (id: string, isNA: boolean) => void;
  onUndo: (id: string) => void;
  onUpdateFlag: (id: string, isFlagged: boolean, note?: string, photos?: string[]) => void;
  onAddEvidence: (id: string, photo: string | null, evidenceList?: string[]) => void;
  onResolveIssue: (id: string, isNA: boolean, note?: string, photos?: string[]) => void;
  onInputChange: (id: string, value: string) => void;
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 1000 / img.width; 
        const width = 1000;
        const height = img.height * scale;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const PhotoGalleryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  photos: string[];
  onAddPhoto: (photo: string) => void;
  onUpdatePhotos: (photos: string[]) => void;
}> = ({ isOpen, onClose, photos, onAddPhoto, onUpdatePhotos }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) setPreviewIndex(null);
  }, [isOpen]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          const base64 = await compressImage(e.target.files[0]);
          if(previewIndex !== null) {
              const newPhotos = [...photos];
              newPhotos[previewIndex] = base64;
              onUpdatePhotos(newPhotos);
              setPreviewIndex(null); // 重拍后自动返回缩略图列表
          } else {
              onAddPhoto(base64);
          }
      }
      if(e.target) e.target.value = '';
  };

  const deletePhotoDirectly = (e: React.MouseEvent, idx: number) => {
      e.stopPropagation();
      if(window.confirm('确认删除这张照片吗？')) {
          const newPhotos = photos.filter((_, i) => i !== idx);
          onUpdatePhotos(newPhotos);
      }
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-[110] bg-white flex flex-col animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-4 flex justify-between items-center bg-white border-b border-slate-100 shadow-sm z-10">
             <button onClick={() => previewIndex !== null ? setPreviewIndex(null) : onClose()} className="p-2 text-slate-600 active:bg-slate-50 rounded-lg">
                 {previewIndex !== null ? '返回列表' : <X />}
             </button>
             <span className="font-bold text-slate-800">{previewIndex !== null ? '照片预览' : `照片管理 (${photos.length})`}</span>
             <div className="w-10"></div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
             {previewIndex !== null ? (
                 <div className="h-full flex flex-col justify-center items-center gap-10">
                     <img src={photos[previewIndex]} className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl bg-black" />
                     <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform">
                         <RotateCw size={20} /> 重拍并替换
                     </button>
                 </div>
             ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                     {photos.map((p, i) => (
                         <div key={i} onClick={() => setPreviewIndex(i)} className="relative aspect-square bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 group active:scale-95 transition-transform">
                             <img src={p} className="w-full h-full object-cover" />
                             {/* 直接在缩略图界面删除 */}
                             <button onClick={(e) => deletePhotoDirectly(e, i)} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full shadow-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={14} />
                             </button>
                         </div>
                     ))}
                     <button onClick={() => fileInputRef.current?.click()} className="aspect-square bg-white rounded-xl flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 active:bg-slate-50 transition-colors">
                         <Camera size={32} className="mb-2" />
                         <span className="text-xs font-bold">添加照片</span>
                     </button>
                 </div>
             )}
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleUpload} />
      </div>
  );
};

const CheckButton: React.FC<{
  label?: string;
  itemId: string;
  state: ItemState | undefined;
  requiresInput?: boolean;
  pressureType?: 'number' | 'range';
  inputLabel?: string;
  isSingleLayout?: boolean;
  onToggle: (isNA: boolean) => void;
  onUndo: () => void;
  onUpdateFlag: (isFlagged: boolean, note?: string, photos?: string[]) => void;
  onAddEvidence: (photo: string | null, list?: string[]) => void;
  onResolveIssue: (isNA: boolean, note?: string, photos?: string[]) => void;
  onInputChange: (value: string) => void;
}> = ({ label, itemId, state, requiresInput, pressureType, inputLabel, isSingleLayout, onToggle, onUndo, onUpdateFlag, onAddEvidence, onResolveIssue, onInputChange }) => {
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showResolveConfirm, setShowResolveConfirm] = useState<boolean | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const issueInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isChecked = state?.isChecked === true;
  const isNA = state?.isNA === true;
  const isFlagged = state?.isFlagged === true;
  const evidencePhotos = state?.evidencePhotos || [];
  const issuePhotos = state?.issuePhotos || [];
  const isInputValid = !requiresInput || isNA || (state?.inputValue && state.inputValue.trim() !== '');

  const handleCameraAction = () => {
    if (evidencePhotos.length === 0) cameraInputRef.current?.click(); else setShowGallery(true);
  };

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const base64 = await compressImage(e.target.files[0]);
      onAddEvidence(base64, [...evidencePhotos, base64]);
    }
    if (e.target) e.target.value = '';
  };

  const handleToggleClick = (targetIsNA: boolean) => {
    if (targetIsNA) { 
      if (isNA) onUndo(); else onToggle(true); 
    } else { 
      if (isChecked) onUndo(); else onToggle(false); 
    }
  };

  return (
    <>
      <PhotoGalleryModal isOpen={showGallery} onClose={() => setShowGallery(false)} photos={evidencePhotos} onAddPhoto={(p) => onAddEvidence(p, [...evidencePhotos, p])} onUpdatePhotos={(list) => onAddEvidence(null, list)} />
      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleEvidenceUpload} />

      {showIssueModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 relative">
            <button onClick={() => setShowIssueModal(false)} className="absolute top-2 right-2 p-2 text-slate-400 hover:text-slate-600"><X size={20}/></button>
            <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-slate-800"><AlertCircle className="text-orange-500" /> 标记新问题</h3>
            <textarea className="w-full border border-slate-300 rounded-lg p-3 text-[15px] mb-4 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="描述故障内容..." rows={3} value={state?.issueNote || ''} onChange={(e) => onUpdateFlag(true, e.target.value, issuePhotos)} />
            <div className="mb-4 space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">{issuePhotos.map((p, i) => <img key={i} src={p} className="h-16 w-16 object-cover rounded border" />)}</div>
              <button onClick={() => issueInputRef.current?.click()} className="w-full h-12 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 font-bold flex items-center justify-center gap-2 active:bg-slate-50 transition-colors"><ImagePlus size={18} /> 添加证据照片</button>
              <input type="file" ref={issueInputRef} className="hidden" accept="image/*" capture="environment" onChange={async (e) => {
                if (e.target.files?.[0]) {
                    const b = await compressImage(e.target.files[0]);
                    onUpdateFlag(true, state?.issueNote || '', [...issuePhotos, b]);
                }
              }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => { setShowIssueModal(false); }} className="h-12 bg-slate-100 text-slate-600 rounded-lg font-bold">取消</button>
               <button onClick={() => { onUpdateFlag(true, state?.issueNote || '', issuePhotos); setShowIssueModal(false); }} className="h-12 bg-blue-600 text-white rounded-lg font-bold shadow-md">保存标记</button>
            </div>
          </div>
        </div>
      )}

      {showResolveConfirm !== null && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
           <div className="bg-white rounded-xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in duration-200 text-center">
             <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4"><CheckCircle size={32} /></div>
             <h3 className="text-xl font-bold mb-2">确认整改完成？</h3>
             <p className="text-slate-500 text-sm mb-8 leading-relaxed">确认后将清除红旗并标记为 <span className="text-emerald-600 font-bold">已通过 (OK)</span>。</p>
             <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setShowResolveConfirm(null)} className="h-12 bg-slate-100 rounded-lg text-slate-600 font-bold">暂不</button>
               <button onClick={() => { onResolveIssue(showResolveConfirm === true, state?.issueNote, state?.issuePhotos); setShowResolveConfirm(null); }} className="h-12 bg-emerald-600 rounded-lg text-white font-bold shadow-lg shadow-emerald-200">确认解决</button>
             </div>
           </div>
        </div>
      )}

      <div className={`w-full ${isSingleLayout ? 'flex items-center gap-3' : 'flex flex-col gap-3'}`}>
          {requiresInput && (
              <div className={isSingleLayout ? 'w-36' : 'w-full mb-1'}>
                  {pressureType === 'range' ? (
                      <div className="flex gap-2 w-full h-11">
                        {['RED', 'YELLOW', 'GREEN'].map(v => (
                          <button key={v} onClick={() => onInputChange(v)} className={`flex-1 rounded-lg border-2 transition-all active:scale-95 ${state?.inputValue === v ? `border-slate-800 scale-105 ${v==='RED'?'bg-red-500':v==='YELLOW'?'bg-yellow-400':'bg-emerald-500'}` : `border-transparent opacity-30 ${v==='RED'?'bg-red-500':v==='YELLOW'?'bg-yellow-400':'bg-emerald-500'}`}`} />
                        ))}
                      </div>
                  ) : (
                      <div className={`flex items-center bg-white rounded-lg border-2 px-3 h-11 ${isInputValid ? 'border-slate-200' : 'border-red-400 bg-red-50'}`}>
                        <input type="number" inputMode="numeric" placeholder="0" value={state?.inputValue || ''} disabled={isNA} onChange={(e) => onInputChange(e.target.value)} className="w-full bg-transparent outline-none font-bold text-lg text-center" />
                        <span className="text-[10px] font-black text-slate-400 ml-1">{inputLabel}</span>
                    </div>
                  )}
              </div>
          )}
          <div className={isSingleLayout ? 'flex items-center gap-2 flex-1' : 'grid grid-cols-2 gap-2'}>
                {/* N/A 选中后变为深灰色 */}
                <button onClick={() => handleToggleClick(true)} className={`h-11 px-3 rounded-lg font-bold text-sm border-2 transition-all active:scale-95 ${isNA ? 'bg-slate-500 text-white border-slate-600' : 'bg-white text-slate-300 border-slate-100'}`}>N/A</button>
                <button onClick={handleCameraAction} className={`h-11 w-full flex items-center justify-center rounded-lg border-2 transition-all active:scale-95 ${evidencePhotos.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}><Camera size={20} /></button>
                <button disabled={!isInputValid} onClick={() => isFlagged ? setShowResolveConfirm(false) : handleToggleClick(false)} className={`flex-1 h-11 rounded-lg flex items-center justify-center border-2 transition-all active:scale-95 ${isChecked ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-100 border-slate-100'}`}><Check size={28} strokeWidth={4} /></button>
                <button onClick={() => isFlagged ? setShowResolveConfirm(false) : setShowIssueModal(true)} className={`h-11 w-full flex items-center justify-center rounded-lg border-2 transition-all active:scale-95 ${isFlagged ? 'bg-red-600 text-white border-red-700 shadow-md' : 'bg-white text-slate-100 border-slate-100'}`}><Flag size={18} fill={isFlagged ? "currentColor" : "none"} /></button>
          </div>
      </div>
    </>
  );
};

export const ChecklistRow: React.FC<Props> = ({ config, state, subStates, onToggle, onUndo, onUpdateFlag, onAddEvidence, onResolveIssue, onInputChange }) => {
  // 使用 useMemo 确保状态变化时颜色立即同步响应
  const isRowComplete = useMemo(() => {
    if (config.type === 'simple') return state?.isChecked || state?.isNA;
    return config.subItems?.every(s => {
        const st = subStates[`${config.id}_${s.id}`];
        return st?.isChecked || st?.isNA;
    });
  }, [state?.isChecked, state?.isNA, subStates, config.id, config.subItems, config.type]);

  const hasIssues = useMemo(() => {
    if (config.type === 'simple') return state?.isFlagged;
    return config.subItems?.some(s => subStates[`${config.id}_${s.id}`]?.isFlagged);
  }, [state?.isFlagged, subStates, config.id, config.subItems, config.type]);

  let borderClass = 'border-l-[6px] border-slate-200'; 
  let bgClass = 'bg-white';
  if (hasIssues) {
      borderClass = 'border-l-[6px] border-red-600';
      bgClass = 'bg-red-50/40';
  } else if (isRowComplete) {
      borderClass = 'border-l-[6px] border-emerald-500';
  }

  return (
    <div id={`row-${config.id}`} className={`p-5 mb-4 rounded-xl shadow-sm transition-all duration-300 break-inside-avoid border border-slate-100 ${borderClass} ${bgClass}`}>
      <div className="flex flex-col gap-4">
        <div className="text-[17px] font-bold leading-relaxed text-slate-900">
          {hasIssues && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white mr-2 align-middle shadow-sm">问题中</span>}
          {config.text}
        </div>
        <div className="w-full">
          {config.type === 'simple' ? (
            <CheckButton itemId={config.id} state={state} requiresInput={config.requiresInput} pressureType={config.pressureType} inputLabel={config.inputLabel} isSingleLayout={true} onToggle={(isNA) => onToggle(config.id, isNA)} onUndo={() => onUndo(config.id)} onUpdateFlag={(isFlagged, note, photos) => onUpdateFlag(config.id, isFlagged, note, photos)} onAddEvidence={(photo, list) => onAddEvidence(config.id, photo, list)} onResolveIssue={(isNA, note, photos) => onResolveIssue(config.id, isNA, note, photos)} onInputChange={(val) => onInputChange(config.id, val)} />
          ) : (
            <div className="space-y-4 mt-1">
                {config.subItems?.map((sub) => (
                    <div key={sub.id} className="p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                        <div className="font-bold text-sm text-slate-500 mb-3 flex items-center gap-2"><div className="w-1.5 h-3 bg-slate-300 rounded-full"></div>{sub.label}</div>
                        <CheckButton itemId={`${config.id}_${sub.id}`} state={subStates[`${config.id}_${sub.id}`]} requiresInput={config.requiresInput} pressureType={config.pressureType} inputLabel={config.inputLabel} isSingleLayout={false} onToggle={(isNA) => onToggle(`${config.id}_${sub.id}`, isNA)} onUndo={() => onUndo(`${config.id}_${sub.id}`)} onUpdateFlag={(isFlagged, note, photos) => onUpdateFlag(`${config.id}_${sub.id}`, isFlagged, note, photos)} onAddEvidence={(photo, list) => onAddEvidence(`${config.id}_${sub.id}`, photo, list)} onResolveIssue={(isNA, note, photos) => onResolveIssue(`${config.id}_${sub.id}`, isNA, note, photos)} onInputChange={(val) => onInputChange(`${config.id}_${sub.id}`, val)} />
                    </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};