import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Виторг рахує рівно один модуль — `lib/profit.ts`. Найімовірніший спосіб це
 * зламати — підсумувати `total_amount` чи `price` reduce-ом у новому місці:
 * число вийде правдоподібне, а від дашборду розійдеться мовчки. Саме так
 * жили «Звіти» (32 610 ₴ проти 27 460 ₴) і аналітика до 30.07.
 *
 * Тест ловить форму запису, а не наслідок. `data-analytics.ts` тут навмисно:
 * він рахує партнерські суми напряму, але тільки над рядками, які вже
 * відфільтровані епохою, і жоден із них не називається виторгом магазину.
 * Якщо колись назветься — тест має впасти, і це правильно.
 *
 * `data-day.ts` у списку немає свідомо: файл з'явиться у слайсі 2, і додати
 * його має той слайс. Рядок із `try/catch` на неіснуючий файл був би тестом,
 * який нічого не стверджує, — гірше за відсутній.
 */
const GUARDED = ["src/lib/data-dashboard.ts", "src/lib/data-sales.ts"];

const RAW_SUM = /reduce\([\s\S]{0,120}\.(total_amount|total_price)\b/g;

describe("виторг рахується лише через profit.ts", () => {
  for (const file of GUARDED) {
    it(`${file} не підсумовує total_amount/total_price напряму`, () => {
      expect(readFileSync(file, "utf8").match(RAW_SUM)).toBeNull();
    });
  }
});
