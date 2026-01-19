import OpenAI from 'openai';

export interface TranslationConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  targetLang: 'zh' | 'en' | 'auto';
}

const SYSTEM_PROMPT = `You are a professional translator. 
Translate the following text content directly, keeping the original meaning and tone.
Do not output any explanation or extra text.
If the text contains markdown formatting, preserve it.
If the text contains XML tags (like in DOCX), preserve the tags and only translate the text content within valid text nodes.`;

export async function translateText(
  text: string, 
  config: TranslationConfig,
  onProgress?: (chunk: string) => void
): Promise<string> {
  if (!text || !text.trim()) return text;

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || "https://api.openai.com/v1",
    dangerouslyAllowBrowser: true // Client-side usage
  });

  const languagePrompt = config.targetLang === 'auto' 
    ? "Detect the source language. If it is Chinese, translate to English. If it is English, translate to Chinese."
    : `Translate to ${config.targetLang === 'zh' ? 'Chinese (Simplified)' : 'English'}.`;

  try {
    const response = await client.chat.completions.create({
      model: config.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n${languagePrompt}` },
        { role: "user", content: text }
      ],
      stream: true,
    });

    let result = "";
    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        result += content;
        onProgress?.(result);
      }
    }
    return result;

  } catch (error: any) {
    console.error("Translation error:", error);
    throw new Error(error.message || "Translation failed");
  }
}

// Helper to batch process text chunks to avoid token limits
export async function translateBatch(
  texts: string[],
  config: TranslationConfig,
  onBatchProgress?: (completed: number, total: number) => void,
  onLog?: (message: string, type?: 'info' | 'success' | 'error', duration?: number) => void
): Promise<string[]> {
  const results: string[] = [];
  // Simple serial processing for now to avoid rate limits
  // Production would use a p-limit queue
  
  for (let i = 0; i < texts.length; i++) {
    const startTime = Date.now();
    try {
      const previewText = texts[i].substring(0, 30).replace(/\n/g, ' ') + (texts[i].length > 30 ? '...' : '');
      onLog?.(`正在翻译第 ${i + 1}/${texts.length} 部分: "${previewText}"`, 'info');

      const translated = await translateText(texts[i], config);
      const duration = Date.now() - startTime;
      
      results.push(translated);
      onLog?.(`第 ${i + 1}/${texts.length} 部分翻译完成`, 'success', duration);
      
      onBatchProgress?.(i + 1, texts.length);
    } catch (e: any) {
      const duration = Date.now() - startTime;
      console.error(`Failed to translate chunk ${i}`, e);
      onLog?.(`第 ${i + 1}/${texts.length} 部分翻译失败: ${e.message}`, 'error', duration);
      
      results.push(texts[i]); // Fallback to original
    }
  }
  
  return results;
}
