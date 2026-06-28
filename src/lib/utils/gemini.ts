const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// ─── Типи Gemini API ──────────────────────────────────────────────────────────

export interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface GeminiGenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "application/json" | "text/plain";
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    index: number;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// ─── Помилка rate-limit ────────────────────────────────────────────────────────

// Спеціальний клас помилки для rate-limit — дозволяє route повернути 429 замість 500
export class GeminiRateLimitError extends Error {
  constructor() {
    super("AI тимчасово недоступний: ліміт запитів вичерпано. Спробуй за хвилину.");
    this.name = "GeminiRateLimitError";
  }
}

// ─── Defensive JSON parser ────────────────────────────────────────────────────

/**
 * Gemini 2.5 Flash іноді обгортає JSON у ```json блок навіть з responseMimeType: application/json.
 * Цей helper очищає обгортку і безпечно парсить результат.
 */
export function safeParseJSON<T>(raw: string, fallback: T): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.warn("[safeParseJSON] Failed to parse Gemini response:", cleaned.slice(0, 200));
    return fallback;
  }
}

// ─── Глобальний Rate Limiter ──────────────────────────────────────────────────

const requestTimestamps: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 13;

function enforceGlobalRateLimit() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift();
  }
  
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    throw new GeminiRateLimitError();
  }
  
  requestTimestamps.push(now);
}

// ─── Core fetch utility ───────────────────────────────────────────────────────

export async function fetchGemini(
  contents: GeminiContent[],
  generationConfig?: GeminiGenerationConfig,
  retries = 3,
  timeoutMs = 15000,
  systemInstruction?: string // ← передаємо окремо, НЕ як user-message
): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  enforceGlobalRateLimit();

  const requestBody: GeminiRequestBody = {
    contents,
  };

  if (generationConfig && Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig;
  }

  // Правильний спосіб передати системний контекст — через systemInstruction, не через user-повідомлення
  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429) {
        if (attempt < retries) {
          const waitMs = Math.pow(2, attempt) * 2000; // 4s, 8s
          console.warn(`Gemini rate limit hit, waiting ${waitMs}ms before retry ${attempt + 1}...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw new GeminiRateLimitError();
      }

      if (res.status === 503) {
        throw new Error("Gemini API returned status 503");
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: { message?: string } };
        const errMsg = errData?.error?.message || `Gemini API returned status ${res.status}`;
        throw new Error(errMsg);
      }

      return await res.json() as GeminiResponse;
    } catch (error) {
      if (error instanceof GeminiRateLimitError) throw error;

      const isTimeout = error instanceof Error && error.name === "TimeoutError";
      const is503 = error instanceof Error && error.message.includes("503");

      console.warn(`Gemini API attempt ${attempt} failed:`, error);

      if (attempt === retries || (!isTimeout && !is503)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  // TypeScript потребує explicit return — цей рядок недосяжний
  throw new Error("fetchGemini: exhausted all retries");
}
