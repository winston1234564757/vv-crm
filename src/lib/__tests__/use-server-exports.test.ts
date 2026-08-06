import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Файл із `"use server"` може експортувати ЛИШЕ асинхронні функції.
 *
 * Це не стильова причіпка. `export const paymentSourceSchema = z.object({...})`
 * у `actions/finance.ts` поклала всю сторінку фінансів: модуль падає при
 * завантаженні з «A "use server" file can only export async functions, found
 * object», разом із ним падає граф сторінки, і кожна серверна дія на ній —
 * включно з усіма заглибленнями — відхиляється заглушкою Next.js про Server
 * Components. Причину не видно ні в модалці, ні в збірці.
 *
 * `next build` це пропускає: перевірка рантаймова. Тому вона тут.
 *
 * Типи й інтерфейси не рахуються — вони стираються при компіляції.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Файли з директивою `"use server"` на самому початку. */
function useServerFiles(): { path: string; body: string }[] {
  return walk(SRC)
    .map((path) => ({ path, body: readFileSync(path, "utf8") }))
    .filter(({ body }) => /^\s*["']use server["']\s*;?/.test(body));
}

/* Експорти-значення, які Next відкине. `export async function` і
   `export type`/`export interface` — дозволені; решта `export` із назвою — ні.

   `export const foo = async () => {}` теоретично допустимий, але в цьому
   проєкті дії пишуться через `export async function`, і послаблювати правило
   заради форми, якої ніхто не використовує, означало б пропустити наступний
   `export const schema`. */
const FORBIDDEN = /^export\s+(?!async\s+function\b)(?!type\b)(?!interface\b)(const|let|var|class|function|enum)\b/gm;

describe("файли «use server»", () => {
  const files = useServerFiles();

  it("їх узагалі знайдено (інакше тест нічого не перевіряє)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("експортують лише асинхронні функції", () => {
    const offenders: string[] = [];

    for (const { path, body } of files) {
      for (const m of body.matchAll(FORBIDDEN)) {
        const line = body.slice(0, m.index).split("\n").length;
        offenders.push(
          `${path.replace(process.cwd(), "").replace(/\\/g, "/")}:${line} → ${m[0].trim()}`,
        );
      }
    }

    expect(
      offenders,
      "У файлі з «use server» дозволені лише `export async function` і типи. " +
        "Експортоване значення валить модуль при завантаженні й ламає всю сторінку:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
