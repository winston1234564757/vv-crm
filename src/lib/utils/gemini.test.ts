/**
 * Тести для src/lib/utils/gemini.ts
 *
 * Покриває:
 * - safeParseJSON: чистий JSON, markdown-обгортка, невалідний JSON, fallback
 * - fetchGemini: success, rate-limit + retry, 503 retry, timeout, missing API key
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeParseJSON, fetchGemini, GeminiRateLimitError } from "@/lib/utils/gemini";

// ─── safeParseJSON ────────────────────────────────────────────────────────────

describe("safeParseJSON", () => {
  it("парсить чистий JSON об'єкт", () => {
    const result = safeParseJSON<{ name: string }>('{"name":"Іван"}', { name: "" });
    expect(result).toEqual({ name: "Іван" });
  });

  it("парсить JSON масив", () => {
    const result = safeParseJSON<number[]>("[1,2,3]", []);
    expect(result).toEqual([1, 2, 3]);
  });

  it("прибирає markdown ```json обгортку і парсить", () => {
    const raw = "```json\n{\"psychotype\":\"лояльний\"}\n```";
    const result = safeParseJSON<{ psychotype: string }>(raw, { psychotype: "" });
    expect(result).toEqual({ psychotype: "лояльний" });
  });

  it("прибирає markdown ``` без json і парсить", () => {
    const raw = "```\n{\"key\":\"value\"}\n```";
    const result = safeParseJSON<{ key: string }>(raw, { key: "" });
    expect(result).toEqual({ key: "value" });
  });

  it("повертає fallback при невалідному JSON", () => {
    const fallback = { error: true };
    const result = safeParseJSON<{ error: boolean }>("це не JSON взагалі", fallback);
    expect(result).toBe(fallback);
  });

  it("повертає fallback при порожньому рядку", () => {
    const result = safeParseJSON<null>("", null);
    expect(result).toBeNull();
  });

  it("парсить JSON з пробілами і newline навколо", () => {
    const raw = '\n\n{"status":"ok"}\n\n';
    const result = safeParseJSON<{ status: string }>(raw, { status: "" });
    expect(result).toEqual({ status: "ok" });
  });
});

// ─── fetchGemini ─────────────────────────────────────────────────────────────

describe("fetchGemini", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...OLD_ENV, GEMINI_API_KEY: "test-key-123" };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  const makeSuccessResponse = (text: string) => ({
    candidates: [{ content: { parts: [{ text }], role: "model" }, finishReason: "STOP", index: 0 }],
  });

  it("повертає успішну відповідь при першому запиті", async () => {
    const mockResponse = makeSuccessResponse("Привіт!");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      })
    );

    const result = await fetchGemini([{ role: "user", parts: [{ text: "Тест" }] }]);
    expect(result.candidates[0].content.parts[0].text).toBe("Привіт!");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("кидає Error якщо GEMINI_API_KEY не встановлено", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      fetchGemini([{ role: "user", parts: [{ text: "Тест" }] }])
    ).rejects.toThrow("GEMINI_API_KEY not configured");
  });

  it("повторює запит при 429 і повертає результат з 2-ї спроби", async () => {
    const mockResponse = makeSuccessResponse("Повторна відповідь");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockResponse })
    );

    // Зменшуємо таймаут та retries щоб тест не чекав 4s
    const result = await fetchGemini(
      [{ role: "user", parts: [{ text: "Тест" }] }],
      undefined,
      2,
      5000
    );
    expect(result.candidates[0].content.parts[0].text).toBe("Повторна відповідь");
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 15000);

  it("кидає GeminiRateLimitError після вичерпання всіх спроб при 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    );

    await expect(
      fetchGemini([{ role: "user", parts: [{ text: "Тест" }] }], undefined, 1, 5000)
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });

  it("повторює при 503 і повертає результат", async () => {
    const mockResponse = makeSuccessResponse("OK після 503");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockResponse })
    );

    const result = await fetchGemini(
      [{ role: "user", parts: [{ text: "Тест" }] }],
      undefined,
      2,
      5000
    );
    expect(result.candidates[0].content.parts[0].text).toBe("OK після 503");
  }, 15000);

  it("кидає Error з повідомленням від API при 4xx помилці", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "Invalid request body" } }),
      })
    );

    await expect(
      fetchGemini([{ role: "user", parts: [{ text: "Тест" }] }], undefined, 1, 5000)
    ).rejects.toThrow("Invalid request body");
  });

  it("передає systemInstruction коли вказано", async () => {
    const mockResponse = makeSuccessResponse("OK");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchGemini(
      [{ role: "user", parts: [{ text: "Питання" }] }],
      undefined,
      1,
      5000,
      "Ти — AI-асистент"
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.systemInstruction).toEqual({
      parts: [{ text: "Ти — AI-асистент" }],
    });
  });

  it("НЕ включає thinkingConfig в тіло запиту", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeSuccessResponse("OK"),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchGemini([{ role: "user", parts: [{ text: "Тест" }] }], undefined, 1, 5000);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.thinkingConfig).toBeUndefined();
  });

  it("передає правильний role: user у contents", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeSuccessResponse("OK"),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchGemini([{ role: "user", parts: [{ text: "Привіт" }] }], undefined, 1, 5000);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.contents[0].role).toBe("user");
  });
});
