/**
 * Utility to parse PDF files in the browser using PDF.js loaded via CDN.
 * This avoids any web worker or bundling issues in Vite environments.
 */

// Global window type utility
interface ExtendedWindow extends Window {
  pdfjsLib?: any;
}

declare const window: ExtendedWindow;

/**
 * Dynamically injects PDF.js CDN scripts and initializes the worker.
 */
function loadPdfJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.async = true;
    
    script.onload = () => {
      const pdfjsLib = window.pdfjsLib;
      if (pdfjsLib) {
        // Configure the matching web worker path
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        resolve(pdfjsLib);
      } else {
        reject(new Error('PDF.js library was not bound to window.'));
      }
    };
    
    script.onerror = () => {
      reject(new Error('Failed to fetch PDF.js engine from CDN. Check your internet connection.'));
    };

    document.head.appendChild(script);
  });
}

async function extractImagePdfWithOcr(
  pdf: any,
  onProgress?: (progressText: string) => void,
) {
  const { createWorker } = await import('tesseract.js');
  onProgress?.('Image-only PDF detected. Loading OCR engine...');
  const worker = await createWorker('eng');
  let ocrText = '';

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(`OCR reading page ${i} of ${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The browser could not create an OCR canvas.');

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      ocrText += `[PAGE ${i}]\n${result.data.text.trim()}\n\n`;

      // Release the page bitmap before rendering the next one.
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup?.();
    }
  } finally {
    await worker.terminate();
  }

  return ocrText.trim();
}

/**
 * Extracts raw textual representation from a local File object.
 * Triggers status updates through the onProgress callback if supplied.
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (progressText: string) => void
): Promise<string> {
  onProgress?.('Initializing PDF parser engine...');
  const pdfjsLib = await loadPdfJs();

  onProgress?.('Loading PDF file bytes...');
  const arrayBuffer = await file.arrayBuffer();
  
  onProgress?.('Ingesting raw PDF documents...');
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  onProgress?.(`Found ${numPages} page(s). Beginning text reconstruction...`);

  let extractedText = '';
  let nativeCharacterCount = 0;

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(`Processing page ${i} of ${numPages}...`);
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      nativeCharacterCount += pageText.replace(/\s/g, '').length;
      
      extractedText += `[PAGE ${i}]\n${pageText}\n\n`;
    } catch (pageError) {
      console.warn(`Error parsing page ${i}, skipping:`, pageError);
    }
  }

  // Page markers alone previously made a scanned PDF appear to contain text,
  // causing downstream AI scans to receive only "[PAGE n]" and return 0.
  if (nativeCharacterCount < 50) {
    extractedText = await extractImagePdfWithOcr(pdf, onProgress);
  }

  const trimmedOutput = extractedText.trim();
  const meaningfulOutput = trimmedOutput.replace(/\[PAGE \d+\]/gi, '').replace(/\s/g, '');
  if (meaningfulOutput.length < 50) {
    throw new Error('OCR could not recover enough readable text from this PDF. Try a clearer copy.');
  }

  return trimmedOutput;
}
