import JSZip from 'jszip';
import { translateBatch, type TranslationConfig } from './translator';

// Updated type definition to include 'warning'
type LogCallback = (message: string, type?: 'info' | 'success' | 'error' | 'warning', duration?: number) => void;

export async function translateDocx(
  zip: JSZip, 
  config: TranslationConfig,
  onProgress: (percent: number) => void,
  onLog?: LogCallback
): Promise<Blob> {
  onLog?.('开始解析 DOCX 文档...', 'info');
  // 1. Extract text nodes from document.xml
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new Error("word/document.xml not found");

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, "application/xml");
  
  const paragraphs = Array.from(xmlDoc.getElementsByTagName("w:p"));
  const textsToTranslate: { index: number; text: string }[] = [];
  
  paragraphs.forEach((p, pIndex) => {
    const textNodes = p.getElementsByTagName("w:t");
    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      const text = node.textContent || "";
      if (text.trim().length > 0) {
        textsToTranslate.push({
          index: -1, 
          text: text
        });
        // @ts-ignore
        node._pendingTranslation = true;
      }
    }
  });

  const rawTexts = textsToTranslate.map(t => t.text);
  const total = rawTexts.length;
  
  onLog?.(`解析完成，共发现 ${total} 个文本片段待翻译`, 'info');

  if (total === 0) {
    onLog?.('未发现可翻译内容，跳过翻译', 'warning');
    return await zip.generateAsync({ type: "blob" });
  }

  // 2. Translate in batches
  const translatedTexts = await translateBatch(rawTexts, config, (completed, total) => {
    onProgress(Math.round((completed / total) * 100));
  }, onLog);

  onLog?.('翻译完成，正在重组文档...', 'info');

  // 3. Write back
  let tIndex = 0;
  paragraphs.forEach(p => {
    const textNodes = p.getElementsByTagName("w:t");
    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      // @ts-ignore
      if (node._pendingTranslation) {
        if (translatedTexts[tIndex]) {
          node.textContent = translatedTexts[tIndex];
        }
        tIndex++;
      }
    }
  });

  // 4. Serialize back to XML
  const serializer = new XMLSerializer();
  const newDocXml = serializer.serializeToString(xmlDoc);
  
  zip.file("word/document.xml", newDocXml);
  onLog?.('文档重组完成，准备下载', 'success');
  
  return await zip.generateAsync({ type: "blob" });
}

export async function translateMarkdown(
  content: string,
  config: TranslationConfig,
  onProgress: (percent: number) => void,
  onLog?: LogCallback
): Promise<Blob> {
  onLog?.('开始解析 Markdown 文档...', 'info');
  const paragraphs = content.split(/\n\n+/);
  onLog?.(`解析完成，共 ${paragraphs.length} 个段落`, 'info');
  
  const translatedParagraphs = await translateBatch(paragraphs, config, (completed, total) => {
    onProgress(Math.round((completed / total) * 100));
  }, onLog);
  
  const finalContent = translatedParagraphs.join('\n\n');
  onLog?.('Markdown 重组完成', 'success');
  return new Blob([finalContent], { type: 'text/markdown' });
}

export async function translatePlainFile(
    content: string,
    config: TranslationConfig,
    onProgress: (percent: number) => void,
    onLog?: LogCallback
): Promise<Blob> {
    onLog?.('开始翻译纯文本文件...', 'info');
    const translated = await translateBatch([content], config, (c, t) => onProgress(100), onLog);
    return new Blob([translated[0]], { type: 'text/plain' });
}

export async function translatePdfPages(
    pages: string[],
    config: TranslationConfig,
    onProgress: (completed: number, total: number) => void,
    onLog?: LogCallback
): Promise<Blob> {
    onLog?.(`开始翻译 PDF，共 ${pages.length} 页`, 'info');
    const translatedPages = await translateBatch(pages, config, (completed, total) => {
        onProgress(completed, total);
    }, onLog);
    
    onLog?.('PDF 内容翻译完成，正在生成结果文件...', 'info');
    // Join with double newlines to simulate page breaks/paragraphs in text file
    const finalContent = translatedPages.join('\n\n' + '-'.repeat(20) + ' Page Break ' + '-'.repeat(20) + '\n\n');
    return new Blob([finalContent], { type: 'text/plain' });
}
