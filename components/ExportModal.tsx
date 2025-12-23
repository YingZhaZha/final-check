import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import SignatureCanvas from 'react-signature-canvas';
import { Camera, RefreshCw, CheckCircle, Trash2, X, Smartphone, RotateCw, PenTool } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selfie: string, signature: string) => void;
  isProcessing: boolean;
}

export const ExportModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, isProcessing }) => {
  const webcamRef = useRef<Webcam>(null);
  const sigPadRef = useRef<SignatureCanvas>(null);
  
  const [selfie, setSelfie] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1); // 1: Selfie, 2: Signature
  const [isLandscapeMode, setIsLandscapeMode] = useState(false);

  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 150 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 2 && containerRef.current) {
        const timer = setTimeout(() => {
            if(containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                setCanvasSize({ width: clientWidth, height: clientHeight });
            }
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [step, isLandscapeMode]);

  const captureSelfie = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) setSelfie(imageSrc);
  }, [webcamRef]);

  const saveSignature = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      if (isLandscapeMode) {
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
            setSignature(tempCanvas.toDataURL("image/png"));
         }
      } else {
         setSignature(sigPadRef.current.toDataURL("image/png"));
      }
    }
  };

  const handleFinalSubmit = () => {
    if (selfie && signature) {
      onConfirm(selfie, signature);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
      {/* Remove bg-white on container in landscape to prevent blue bars if any padding */}
      <div className={`w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${isLandscapeMode ? 'fixed inset-0 z-[60] bg-white' : 'relative bg-white'}`}>
        
        {/* Header - Strictly conditionally rendered */}
        {!isLandscapeMode && (
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
            <h2 className="text-xl font-bold text-slate-800">
                {step === 1 ? '步骤 1/2: 检查员自拍' : '步骤 2/2: 电子签名'}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2">
                <X size={24} />
            </button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto flex flex-col relative bg-slate-100">
          
          {/* STEP 1: SELFIE */}
          {step === 1 && (
            <div className="p-6 flex flex-col items-center justify-center h-full space-y-6">
              <div className="relative w-full max-w-md aspect-[3/4] sm:aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-2xl">
                {selfie ? (
                  <img src={selfie} alt="Selfie" className="w-full h-full object-cover" />
                ) : (
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="w-full h-full object-cover"
                    mirrored={false}
                    disablePictureInPicture={false}
                    forceScreenshotSourceSize={false}
                    imageSmoothing={true}
                    onUserMedia={() => {}}
                    onUserMediaError={() => {}}
                    screenshotQuality={0.92}
                  />
                )}
              </div>
              
              <div className="flex gap-4 w-full max-w-md">
                {!selfie ? (
                  <button onClick={captureSelfie} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl">
                    <Camera size={24} /> 拍照
                  </button>
                ) : (
                  <>
                    <button onClick={() => setSelfie(null)} className="flex-1 bg-white text-slate-700 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-sm border">
                      <RefreshCw size={20} /> 重拍
                    </button>
                    <button onClick={() => setStep(2)} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl">
                      下一步 <CheckCircle size={24} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: SIGNATURE */}
          {step === 2 && (
            <div className={`flex flex-col h-full ${isLandscapeMode ? 'bg-white' : 'p-4'}`}>
              
              {/* Landscape Toggle */}
              <div className={`flex justify-between items-center mb-2 shrink-0 ${isLandscapeMode ? 'absolute top-4 right-4 z-20 flex-col-reverse gap-4 pointer-events-none' : ''}`}>
                 {!signature && !isLandscapeMode && (
                    <div className="text-sm text-slate-500 flex items-center gap-1"><Smartphone size={16}/> 建议横屏签署</div>
                 )}
                 {!signature && (
                    <button 
                        onClick={() => setIsLandscapeMode(!isLandscapeMode)}
                        className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm border border-indigo-100 shadow-sm ${isLandscapeMode ? 'bg-indigo-600 text-white shadow-lg rotate-90 origin-center' : ''}`}
                    >
                        <RotateCw size={16} /> {isLandscapeMode ? '退出横屏' : '横屏模式'}
                    </button>
                 )}
              </div>

              <div ref={containerRef} className={`relative flex-1 bg-white overflow-hidden touch-none shadow-inner ${isLandscapeMode ? 'fixed inset-0 z-10' : 'rounded-xl border-2 border-slate-300 min-h-[300px]'}`}>
                {!signature ? (
                  <SignatureCanvas
                    ref={sigPadRef}
                    penColor="black"
                    velocityFilterWeight={0.7}
                    minWidth={2.0}
                    maxWidth={4.0}
                    throttle={8}
                    canvasProps={{ width: canvasSize.width, height: canvasSize.height, className: 'cursor-crosshair block' }}
                    backgroundColor="rgba(255, 255, 255, 1)"
                  />
                ) : (
                  <img src={signature} alt="Signature" className="w-full h-full object-contain p-4" />
                )}
                
                {!signature && (
                   <div className={`absolute pointer-events-none select-none text-slate-300 text-4xl font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${isLandscapeMode ? 'rotate-90' : ''}`}>在此区域签名</div>
                )}
              </div>

              <div className={`mt-4 flex gap-3 shrink-0 ${isLandscapeMode ? 'absolute bottom-8 left-0 w-full px-8 z-20 flex-row-reverse pointer-events-none' : ''}`}>
                {!signature ? (
                  <>
                    <button onClick={() => sigPadRef.current?.clear()} className={`pointer-events-auto px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl shadow-sm ${isLandscapeMode ? 'rotate-90' : ''}`}>
                      <Trash2 size={24} />
                    </button>
                    <button onClick={saveSignature} className={`pointer-events-auto flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl ${isLandscapeMode ? 'rotate-90' : ''}`}>
                      <PenTool size={20} className="inline mr-2"/> 确认签名
                    </button>
                  </>
                ) : (
                  <>
                   {/* Layout based on mode */}
                   {isLandscapeMode ? (
                        <>
                           {/* Landscape: Confirm Top Right (visually), Reset Top Left (visually) */}
                           {/* The flex container is row-reverse in landscape */}
                           
                           {/* Confirm (Right side visually) */}
                           <button onClick={handleFinalSubmit} disabled={isProcessing} className={`pointer-events-auto flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl rotate-90`}>
                            {isProcessing ? '生成中...' : '导出报告'}
                           </button>

                           {/* Resign (Left side visually) */}
                           <button onClick={() => { setSignature(null); setIsLandscapeMode(false); }} className={`pointer-events-auto flex-1 bg-white border border-slate-200 text-slate-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 rotate-90`}>
                            <RefreshCw size={20} /> 重签
                           </button>
                        </>
                   ) : (
                       <>
                        <button onClick={() => { setSignature(null); setIsLandscapeMode(false); }} className="flex-1 bg-white border border-slate-200 text-slate-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                        <RefreshCw size={20} /> 重签
                        </button>
                        <button onClick={handleFinalSubmit} disabled={isProcessing} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl">
                        {isProcessing ? '生成中...' : '导出报告'}
                        </button>
                       </>
                   )}
                  </>
                )}
              </div>
              
              {!isLandscapeMode && (
                <button onClick={() => setStep(1)} className="mt-4 text-slate-500 text-sm py-2"> &larr; 返回上一步 </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};