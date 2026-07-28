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

// Негативний regex вище прив'язаний до конкретного імені змінної
// (`cashRegisters`). Якщо масив кас перейменують (як-от `registers` у
// ai-chat/route.ts), той regex мовчки перестає щось ловити — рефактор може
// непомітно повернути ручний reduce(...).balance під новим ім'ям, і тест
// все одно буде зелений. Ця перевірка не залежить від імені змінної: вона
// вимагає, щоб у файлі реально був виклик splitByKind.
//
// src/lib/data-finance.ts свідомо не входить сюди: getFinanceData() — це
// шар сирих даних, він повертає cashRegisters як є й не класифікує їх.
// Класифікація відбувається у споживача, src/app/admin/finance/page.tsx,
// який уже охоплений цією перевіркою окремо.
const CLASSIFIES_DIRECTLY = GUARDED.filter((file) => file !== "src/lib/data-finance.ts");

describe("файли, що класифікують каси, дійсно викликають splitByKind", () => {
  for (const file of CLASSIFIES_DIRECTLY) {
    it(`${file} використовує splitByKind`, () => {
      const src = readFileSync(file, "utf8");
      expect(src.includes("splitByKind"), `${file} не викликає splitByKind`).toBe(true);
    });
  }
});
