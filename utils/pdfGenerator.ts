import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AppState } from '../types';

export const generatePDF = async (
  state: AppState,
  contentElement: HTMLElement | null,
  headerElement: HTMLElement | null
): Promise<File> => {
  if (!contentElement) {
    throw new Error('Content element not provided');
  }

  // Ensure all images in content are loaded
  const contentImages = Array.from(contentElement.querySelectorAll('img'));
  await Promise.all(contentImages.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
      });
  }));

  // Render content to canvas
  const contentCanvas = await html2canvas(contentElement, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = contentCanvas.toDataURL('image/jpeg', 0.95);
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const imgProps = pdf.getImageProperties(imgData);
  const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

  let heightLeft = pdfImgHeight;
  let page = 1;

  // Add first page
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfImgHeight);
  heightLeft -= pdfHeight;

  // Prepare header image if available
  let headerData: string | null = null;
  let headerHeight = 0;

  if (headerElement) {
      const headerCanvas = await html2canvas(headerElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
      });
      headerData = headerCanvas.toDataURL('image/jpeg', 0.95);
      const headerProps = pdf.getImageProperties(headerData);
      headerHeight = (headerProps.height * pdfWidth) / headerProps.width;
  }

  while (heightLeft > 0) {
    pdf.addPage();
    // Calculate position to show the next chunk of the long image
    // For page 2, we want to show from Y=297mm onwards.
    // So we position the image at Y=-297mm.
    const position = -(pdfHeight * page);
    
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfImgHeight);

    // Overlay header on top if it exists
    if (headerData && headerHeight > 0) {
        // Draw a white box behind header to ensure it covers content
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, headerHeight, 'F');
        pdf.addImage(headerData, 'JPEG', 0, 0, pdfWidth, headerHeight);
    }
    
    heightLeft -= pdfHeight;
    page++;
  }

  const filename = `Report_B-${state.info.registration}_${state.info.date}.pdf`;
  const blob = pdf.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
};