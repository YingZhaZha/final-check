
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AppState } from '../types';
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

export const generatePDF = async (state: AppState, elementToCapture: HTMLElement, headerElement?: HTMLElement | null): Promise<File> => {
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  
  const clone = elementToCapture.cloneNode(true) as HTMLElement;
  clone.style.display = 'block';
  clone.style.width = '210mm'; 
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  document.body.appendChild(clone);

  await waitForImages(clone);
  
  let headerImgData: string | null = null;
  let headerHeightMM = 0;
  
  if (headerElement) {
    const headerCanvas = await html2canvas(headerElement, { 
      scale: 2.0, // 提升 Header 清晰度
      backgroundColor: '#ffffff',
      logging: false 
    });
    // 使用 0.8 质量，平衡清晰度和体积
    headerImgData = headerCanvas.toDataURL('image/jpeg', 0.8);
    headerHeightMM = (headerCanvas.height / headerCanvas.width) * A4_WIDTH_MM;
  }

  // 计算像素密度
  const pxPerMM = clone.scrollWidth / A4_WIDTH_MM;
  const pageHeightPx = Math.floor(297 * pxPerMM);
  const headerHeightPx = Math.floor(headerHeightMM * pxPerMM); 
  const marginTopPx = Math.floor(15 * pxPerMM); 
  const marginBottomPx = Math.floor(15 * pxPerMM); 
  
  const blocks = Array.from(clone.querySelectorAll('.break-inside-avoid'));

  let accumulatedHeight = 0; 
  clone.style.paddingTop = `${marginTopPx}px`;
  accumulatedHeight += marginTopPx;

  // 智能分页计算
  blocks.forEach((block) => {
    const el = block as HTMLElement;
    const elHeight = el.offsetHeight;
    const proposedEnd = accumulatedHeight + elHeight;
    const startPage = Math.floor(accumulatedHeight / pageHeightPx);
    const currentPageSafeEnd = (startPage + 1) * pageHeightPx - marginBottomPx;
    
    if (proposedEnd > currentPageSafeEnd) {
       const headerSpace = (startPage + 1 > 0 && headerImgData) ? headerHeightPx : 0;
       const nextPageTop = (startPage + 1) * pageHeightPx + marginTopPx + headerSpace;
       const spacerHeight = nextPageTop - accumulatedHeight;
       if (spacerHeight > 0) {
           const spacer = document.createElement('div');
           spacer.style.height = `${spacerHeight}px`;
           spacer.style.display = 'block';
           el.parentNode?.insertBefore(spacer, el);
           accumulatedHeight += spacerHeight;
       }
    }
    accumulatedHeight += elHeight;
  });

  // 主截图：Scale 2.0 保证文字边缘清晰，不再模糊
  const canvas = await html2canvas(clone, {
    scale: 2.0, 
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  document.body.removeChild(clone);

  const pdf = new jsPDF('p', 'mm', 'a4', true); // enable compression
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const pageHeightInPixels = (canvasWidth / A4_WIDTH_MM) * A4_HEIGHT_MM;
  let totalPages = Math.ceil(canvasHeight / pageHeightInPixels);
  
  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage();
    const srcY = i * pageHeightInPixels;
    const srcH = Math.min(pageHeightInPixels, canvasHeight - srcY);
    
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvasWidth;
    sliceCanvas.height = srcH;
    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, srcH);
        ctx.drawImage(canvas, 0, srcY, canvasWidth, srcH, 0, 0, canvasWidth, srcH);
        
        // 关键优化：使用 JPEG 0.8 (80%)。
        // 0.6 会有明显噪点，0.8 几乎无噪点且体积适中。
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.8);
        
        const renderHeightMM = (srcH / canvasWidth) * A4_WIDTH_MM;
        
        // 使用 MEDIUM 或 FAST 压缩模式
        pdf.addImage(sliceData, 'JPEG', 0, 0, A4_WIDTH_MM, renderHeightMM, undefined, 'FAST');
        
        if (i > 0 && headerImgData) {
            pdf.addImage(headerImgData, 'JPEG', 0, 5, A4_WIDTH_MM, headerHeightMM, undefined, 'FAST');
        }
        
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(`Page ${i + 1} of ${totalPages}`, A4_WIDTH_MM / 2, A4_HEIGHT_MM - 8, { align: 'center' });
    }
  }

  const filename = `${state.info.date}_B-${state.info.registration}_FinalCheck.pdf`;
  const blob = pdf.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
};
