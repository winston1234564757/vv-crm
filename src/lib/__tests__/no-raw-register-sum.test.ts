import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Найімовірніший спосіб зламати розділення — підсумувати каси напряму в
 * новому місці й отримати картку в складі готівки. Помилка тиха: цифра
 * виглядає правдоподібно. Тест ловить саме форму запису.
 */
const GUARDED = [
  "src/lib/data-dashboard.ts",
  "src/lib/data-finance.ts",
  "src/app/admin/finance/page.tsx",
  "src/app/api/ai-chat/route.ts",
];

describe("баланси кас підсумовуються лише через splitByKind", () => {
  for (const file of GUARDED) {
    it(`${file} не складає balance напряму`, () => {
      const src = readFileSync(file, "utf8");
      // reduce, який додає c.balance/r.balance — саме той шаблон, що рахував
      // «готівку» до цієї зміни.
      const rawSum = /cashRegisters[\s\S]{0,40}reduce\([\s\S]{0,80}\.balance/g;
      expect(src.match(rawSum)).toBeNull();
    });
  }
});
