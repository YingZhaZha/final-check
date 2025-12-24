
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

  // Layout Constants (mm)
  const headerHeight = 25; // Adjusted for header content
  const footerHeight = 15; // Space for page number
  const margin = 0; // Left/Right margin if needed, currently 0 for full width
  
  // Calculate printable area height
  const printableHeight = pdfHeight - headerHeight - footerHeight;

  const imgProps = pdf.getImageProperties(imgData);
  // Calculate the total height the image would take on PDF
  const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

  // Calculate total pages needed
  const totalPages = Math.ceil(pdfImgHeight / printableHeight);

  // Prepare header image if available
  let headerData: string | null = null;
  let headerImgHeight = 0;

  if (headerElement) {
      const headerCanvas = await html2canvas(headerElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
      });
      headerData = headerCanvas.toDataURL('image/jpeg', 0.95);
      const headerProps = pdf.getImageProperties(headerData);
      // Scale header to fit width, but constrain height
      headerImgHeight = (headerProps.height * pdfWidth) / headerProps.width;
  }

  for (let page = 1; page <= totalPages; page++) {
    if (page > 1) {
      pdf.addPage();
    }

    // 1. Draw the Content Image
    // The key is to shift the image up by (page - 1) * printableHeight
    // AND shift it down by headerHeight so it starts after the header.
    // The negative offset moves the "seen" part of the image into the view.
    const yOffset = -(printableHeight * (page - 1)) + headerHeight;
    
    pdf.addImage(imgData, 'JPEG', margin, yOffset, pdfWidth, pdfImgHeight);

    // 2. MASKING: Cover the overlap areas with white rectangles
    // Mask Header Area (Top)
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pdfWidth, headerHeight, 'F');
    
    // Mask Footer Area (Bottom)
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, pdfHeight - footerHeight, pdfWidth, footerHeight, 'F');

    // 3. Draw Header (on top of mask)
    if (headerData && headerImgHeight > 0) {
        // Center vertically in the header area if needed, or stick to top
        pdf.addImage(headerData, 'JPEG', 0, 0, pdfWidth, headerImgHeight);
    }

    // 4. Draw Footer (Separator Line + Page Number)
    const footerYStart = pdfHeight - footerHeight;
    
    // Separator Line
    pdf.setDrawColor(0, 0, 0); // Black
    pdf.setLineWidth(0.1); // Thin line
    pdf.line(10, footerYStart, pdfWidth - 10, footerYStart); // Line with 10mm margin

    // Page Number
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100); // Gray
    const pageText = `Page ${page} of ${totalPages}`;
    const textWidth = pdf.getTextWidth(pageText);
    pdf.text(pageText, (pdfWidth / 2) - (textWidth / 2), pdfHeight - 5);
  }

  // Req 3: Filename change to include "B-" explicitly
  const filename = `B-${state.info.registration}_${state.info.inspectorName}_finacheck_${state.info.date}.pdf`;
  const blob = pdf.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
};
