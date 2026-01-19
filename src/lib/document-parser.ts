import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ParsedDocument {
  type: 'docx' | 'md' | 'pdf' | 'txt';
  content: string; // Plain text or structure representation
  originalData: ArrayBuffer | string; // To keep original file for reconstruction
  structure?: any; // For complex docs like docx to hold XML
  pages?: string[]; // Optional array of page content for PDFs
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const fileType = getFileType(file.name);

  if (fileType === 'docx') {
    return parseDocx(arrayBuffer);
  } else if (fileType === 'pdf') {
    return parsePdf(arrayBuffer);
  } else {
    // text based
    const text = await file.text();
    return {
      type: fileType as 'md' | 'txt',
      content: text,
      originalData: text
    };
  }
}

function getFileType(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'docx') return 'docx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown') return 'md';
  return 'txt';
}

async function parseDocx(buffer: ArrayBuffer): Promise<ParsedDocument> {
  const zip = new JSZip();
  await zip.loadAsync(buffer);
  
  // Minimal Docx parsing: we just want to ensure it is valid
  // and maybe extract text for preview if needed.
  // Real translation happens by modifying XML directly later.
  
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("Invalid DOCX file");
  }

  return {
    type: 'docx',
    content: "DOCX content loaded",
    originalData: buffer,
    structure: zip
  };
}

async function parsePdf(buffer: ArrayBuffer): Promise<ParsedDocument> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  const pages: string[] = [];
  const maxPages = pdf.numPages; 
  
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      // @ts-ignore
      .map(item => item.str)
      .join(' ');
    
    fullText += pageText + '\n\n';
    pages.push(pageText);
  }

  return {
    type: 'pdf',
    content: fullText,
    originalData: buffer,
    pages: pages
  };
}
