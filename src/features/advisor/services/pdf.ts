/**
 * Utility to parse PDF files in the browser using PDF.js loaded via CDN.
 * This avoids any web worker or bundling issues in Vite environments.
 */

// Global window type utility
interface PdfTextItem {
  str?: string;
}

interface PdfPage {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

interface PdfJsLibrary {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
}

interface ExtendedWindow extends Window {
  pdfjsLib?: PdfJsLibrary;
}

declare const window: ExtendedWindow;

/**
 * Dynamically injects PDF.js CDN scripts and initializes the worker.
 */
function loadPdfJs(): Promise<PdfJsLibrary> {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.async = true;

    script.onload = () => {
      const pdfjsLib = window.pdfjsLib;
      if (pdfjsLib) {
        // Configure the matching web worker path
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
        resolve(pdfjsLib);
      } else {
        reject(new Error("PDF.js library was not bound to window."));
      }
    };

    script.onerror = () => {
      reject(new Error("Failed to fetch PDF.js engine from CDN. Check your internet connection."));
    };

    document.head.appendChild(script);
  });
}

/**
 * Extracts raw textual representation from a local File object.
 * Triggers status updates through the onProgress callback if supplied.
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (progressText: string) => void,
): Promise<string> {
  onProgress?.("Initializing PDF parser engine...");
  const pdfjsLib = await loadPdfJs();

  onProgress?.("Loading PDF file bytes...");
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.("Ingesting raw PDF documents...");
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  onProgress?.(`Found ${numPages} page(s). Beginning text reconstruction...`);

  let extractedText = "";

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(`Processing page ${i} of ${numPages}...`);
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str || "").join(" ");

      // Keep an explicit boundary so every AI-generated citation can be mapped
      // back to the page where its verbatim evidence appears.
      extractedText += `[PDF PAGE ${i}]\n${pageText}\n\n`;
    } catch (pageError) {
      console.warn(`Error parsing page ${i}, skipping:`, pageError);
    }
  }

  const trimmedOutput = extractedText.trim();
  if (!trimmedOutput) {
    throw new Error("This PDF has no extractable text. It might be scanned or image-only.");
  }

  return trimmedOutput;
}
